import os
import json
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from .models import Driver, Vehicle, Trip, Warehouse, Invoice, Alert
from openai import OpenAI

# Initialize OpenAI client if key exists
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

def get_fleet_summary_data(db: Session) -> Dict[str, Any]:
    """Helper to collect database stats for LLM context or fallback response."""
    drivers = db.query(Driver).all()
    vehicles = db.query(Vehicle).all()
    trips = db.query(Trip).all()
    alerts = db.query(Alert).filter(Alert.resolved == False).all()
    
    return {
        "drivers": [
            {
                "id": d.id, "name": d.name, "availability": d.availability,
                "rating": d.rating, "violations": d.violations, "health": d.health,
                "performance": d.performance, "working_hours": d.working_hours
            } for d in drivers
        ],
        "vehicles": [
            {
                "id": v.id, "vehicle_number": v.vehicle_number, "type": v.type,
                "capacity": v.capacity, "health": v.health, "fuel": v.fuel,
                "availability": v.availability, "mileage": v.mileage, "gps": v.gps
            } for v in vehicles
        ],
        "trips": [
            {
                "id": v.id, "customer": v.customer, "pickup": v.pickup,
                "destination": v.destination, "status": v.status, "priority": v.priority,
                "revenue": v.revenue, "fuel_cost": v.fuel_cost, "eta": v.eta
            } for v in trips
        ],
        "alerts": [
            {
                "id": a.id, "severity": a.severity, "title": a.title,
                "vehicle_number": a.vehicle_number, "driver_name": a.driver_name,
                "description": a.description
            } for a in alerts
        ]
    }

def ask_ai_assistant(query: str, db: Session, conversation: List[Dict[str, str]] | None = None) -> str:
    """Answers user fleet queries using OpenAI (with database state in context) or custom local heuristics if no API key."""
    summary_data = get_fleet_summary_data(db)
    conversation = conversation or []
    
    # 1. Try OpenAI if API key is provided
    if client:
        try:
            system_prompt = (
                "You are the AI Fleet Management Assistant. You have real-time access to the company's database state. "
                "Below is the current snapshot of the database (in JSON format). Use it to answer the manager's question "
                "accurately, professionally, and concisely. If they ask to calculate something, compute it based on the data. "
                "Stay aware of the full conversation history so you can answer follow-up questions naturally and reference prior context. "
                "Formatting with markdown list or table is highly encouraged.\n\n"
                f"DATABASE SNAPSHOT:\n{json.dumps(summary_data, indent=2)}"
            )
            messages = [{"role": "system", "content": system_prompt}]
            for msg in conversation:
                role = msg.get("role")
                content = msg.get("content")
                if role in {"user", "assistant", "system"} and content:
                    messages.append({"role": role, "content": content})
            messages.append({"role": "user", "content": query})

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=600,
                temperature=0.3
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"OpenAI API error: {e}. Falling back to local NLP heuristics.")
            # Fall back to local rule-based response

    # 2. Local Fallback Heuristics Engine
    q = query.lower()
    
    # Check for available drivers
    if "driver" in q and ("available" in q or "free" in q or "on duty" in q):
        avail_drivers = [d["name"] for d in summary_data["drivers"] if d["availability"] == "Available"]
        if avail_drivers:
            return f"**Available Drivers:**\n" + "\n".join([f"- {name}" for name in avail_drivers])
        return "No drivers are currently marked as 'Available'."
        
    # Check for vehicles needing maintenance
    elif "maintenance" in q or "truck" in q and "repair" in q or "health" in q:
        needs_maint = [v for v in summary_data["vehicles"] if v["health"] < 80 or v["availability"] == "Maintenance"]
        if needs_maint:
            res = "**Vehicles Needing Maintenance or Having Health Issues:**\n\n"
            res += "| Vehicle No | Type | Health | Status |\n|---|---|---|---|\n"
            for v in needs_maint:
                res += f"| {v['vehicle_number']} | {v['type']} | {v['health']}% | {v['availability']} |\n"
            return res
        return "All fleet vehicles are in good health (>80%) and none are currently in maintenance."

    # Check for delayed or problem trips
    elif "delayed" in q or "problem" in q or "late" in q:
        problems = [t for t in summary_data["trips"] if t["status"] == "Problem" or t["priority"] == "Critical"]
        if problems:
            res = "**Delayed or Critical Status Trips:**\n"
            for t in problems:
                res += f"- **Trip #{t['id']}** ({t['customer']}) from {t['pickup']} to {t['destination']}: Status is *{t['status']}*, Priority is *{t['priority']}* (ETA: {t['eta'] or 'N/A'})\n"
            return res
        return "No trips are currently flagged with problems or delay alerts."

    # Highest revenue customer
    elif "highest revenue" in q or "best customer" in q or "top customer" in q:
        revenue_map = {}
        for t in summary_data["trips"]:
            revenue_map[t["customer"]] = revenue_map.get(t["customer"], 0.0) + t["revenue"]
        if revenue_map:
            sorted_cust = sorted(revenue_map.items(), key=lambda x: x[1], reverse=True)
            res = "**Top Customers by Revenue:**\n\n"
            res += "| Customer | Total Revenue ($) |\n|---|---|\n"
            for cust, rev in sorted_cust[:5]:
                res += f"| {cust} | ${rev:,.2f} |\n"
            return res
        return "No revenue data is available yet."

    # Lowest fuel efficiency
    elif "fuel efficiency" in q or "fuel cost" in q or "fuel consumption" in q:
        vehicles = summary_data["vehicles"]
        if vehicles:
            # Simulate efficiency based on mileage and a static calculation
            sorted_v = sorted(vehicles, key=lambda x: x["mileage"] / max(x["health"], 1), reverse=True)
            res = "**Fleet Fuel Consumption Analysis:**\n"
            res += "The vehicle with the lowest estimated fuel efficiency based on health index and mileage is:\n"
            res += f"- **Truck {sorted_v[0]['vehicle_number']}** ({sorted_v[0]['type']}) with health at {sorted_v[0]['health']}% and total mileage {sorted_v[0]['mileage']:.1f} km.\n\n"
            res += "Recommendations:\n1. Schedule engine check for vehicles below 85% health.\n2. Optimize cargo load weights."
            return res
        return "No vehicle data available to calculate fuel efficiency."

    # General today's dispatch summary
    elif "summary" in q or "today" in q or "dashboard" in q:
        trips = summary_data["trips"]
        vehicles = summary_data["vehicles"]
        drivers = summary_data["drivers"]
        
        active_trips = sum(1 for t in trips if t["status"] in ["Assigned", "Loading", "In Transit"])
        completed_trips = sum(1 for t in trips if t["status"] in ["Completed", "Delivered"])
        total_rev = sum(t["revenue"] for t in trips)
        avg_health = sum(v["health"] for v in vehicles) / max(len(vehicles), 1)
        drivers_on_duty = sum(1 for d in drivers if d["availability"] == "On Duty")
        
        res = f"### Today's Dispatch & Fleet Summary\n\n"
        res += f"- **Active Shipments:** {active_trips} trips currently in transit/assigned.\n"
        res += f"- **Completed Deliveries:** {completed_trips} loads delivered.\n"
        res += f"- **Drivers On Duty:** {drivers_on_duty} active drivers.\n"
        res += f"- **Total Revenue:** ${total_rev:,.2f}\n"
        res += f"- **Average Fleet Health:** {avg_health:.1f}%\n\n"
        res += "*Everything looks stable. High traffic is expected on Route 80, suggesting dynamic detours.*"
        return res

    # Maintenance prediction
    elif "predict" in q or "maintenance prediction" in q:
        predict_v = [v for v in summary_data["vehicles"] if v["health"] < 90 and v["health"] >= 80]
        if predict_v:
            res = "**Predictive Maintenance Report:**\nBased on mileage progression and slight engine thermal alerts, the following trucks are projected to require maintenance in the next 15 days:\n"
            for v in predict_v:
                res += f"- **Truck {v['vehicle_number']}** (Health: {v['health']}%, Mileage: {v['mileage']} km). Suggested action: Brake pad inspection and oil replacement.\n"
            return res
        return "Predictive analysis shows all vehicles are in excellent health. No maintenance is predicted within the next 30 days."

    # Route optimization suggestion
    elif "route" in q or "traffic" in q or "suggest" in q:
        return (
            "**Route Optimization Advice:**\n"
            "1. **Route East Coast (I-95):** Normal traffic, clear weather. Recommended for standard transit.\n"
            "2. **Route Midwest (I-80):** High construction traffic detected between Mile 120 and 145. "
            "Recommend detouring via Highway 30 to save approximately 25 minutes and 12 gallons of fuel."
        )

    # General fallback response
    else:
        return (
            f"Hello! I am your AI Fleet Assistant. I can see {len(summary_data['drivers'])} drivers, "
            f"{len(summary_data['vehicles'])} vehicles, and {len(summary_data['trips'])} trips in the database.\n\n"
            "Try asking me questions like:\n"
            "- *Which driver is available?*\n"
            "- *Which truck needs maintenance?*\n"
            "- *Highest revenue customer?*\n"
            "- *Generate today's summary.*"
        )


def evaluate_auto_assignment(trip_id: int, db: Session) -> List[Dict[str, Any]]:
    """Evaluates all available drivers and vehicles and ranks the top 5 combinations for a specific trip."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        return []

    # Get available/matching assets
    # For a robust demonstration, we evaluate all drivers and vehicles, even if their status is busy,
    # but we penalize busy ones in the scoring engine.
    drivers = db.query(Driver).all()
    vehicles = db.query(Vehicle).all()
    
    recommendations = []
    
    for driver in drivers:
        for vehicle in vehicles:
            # Start with a base score
            score = 80
            reasons = []
            
            # 1. Check driver availability
            if driver.availability == "Available":
                score += 10
                reasons.append("Driver is available immediately.")
            elif driver.availability == "Off Duty":
                score -= 40
                reasons.append("Driver is off duty.")
            else:
                score -= 20
                reasons.append("Driver is currently on another assignment.")
                
            # 2. Check driver license expiry or validity (simulated check)
            # Penalize low rating or violations
            if driver.rating >= 4.7:
                score += 5
                reasons.append(f"Excellent driver rating ({driver.rating:.1f}/5.0).")
            elif driver.rating < 4.0:
                score -= 15
                reasons.append(f"Lower driver rating ({driver.rating:.1f}/5.0).")
                
            if driver.violations > 0:
                score -= 10
                reasons.append(f"Driver has {driver.violations} safety violation(s).")
                
            # 3. Vehicle Type match
            if trip.vehicle_type and vehicle.type.lower() == trip.vehicle_type.lower():
                score += 10
                reasons.append(f"Perfect vehicle type match ({vehicle.type}).")
            else:
                # Slight penalty for mismatch
                score -= 10
                reasons.append(f"Vehicle type is {vehicle.type} (requested: {trip.vehicle_type or 'Any'}).")
                
            # 4. Vehicle Capacity match
            if vehicle.capacity >= trip.weight:
                score += 5
                reasons.append(f"Vehicle capacity ({vehicle.capacity} tons) meets cargo weight ({trip.weight} tons).")
            else:
                score -= 50
                reasons.append(f"Insufficient vehicle capacity ({vehicle.capacity} tons < requested {trip.weight} tons).")
                
            # 5. Vehicle Health
            if vehicle.health >= 90:
                score += 5
                reasons.append("Vehicle is in peak health condition.")
            elif vehicle.health < 75:
                score -= 20
                reasons.append(f"Vehicle health is lower ({vehicle.health}%). Maintenance suggested soon.")
                
            # 6. Fuel level
            if vehicle.fuel >= 60:
                score += 5
                reasons.append(f"Good fuel level ({vehicle.fuel}%).")
            elif vehicle.fuel < 25:
                score -= 15
                reasons.append(f"Low fuel ({vehicle.fuel}%). Will require refuel stop.")

            # Calculate a simulated distance / ETA / cost
            # Let's base it on location (simulated coords offset)
            d_lat, d_lng = 37.7749, -122.4194  # Base center
            v_lat, v_lng = vehicle.latitude or d_lat, vehicle.longitude or d_lng
            
            # Simple Euclidean distance as proxy
            distance_factor = ((v_lat - 37.8)**2 + (v_lng - -122.4)**2)**0.5
            sim_distance = max(15.0, distance_factor * 1000.0)  # in km
            sim_eta = f"{int(sim_distance / 60)}h {int((sim_distance % 60))}m"
            sim_cost = float(sim_distance * 1.5 + (100 - vehicle.health) * 2)

            # Proximity penalty
            if sim_distance < 50:
                score += 5
                reasons.append("Vehicle is highly proximate to cargo pickup.")
            else:
                score -= int(sim_distance / 100)
                
            # Bound score between 0 and 100
            final_score = max(10, min(100, score))
            
            # Create recommendation object
            recommendations.append({
                "driver_id": driver.id,
                "driver_name": driver.name,
                "driver_rating": driver.rating,
                "vehicle_id": vehicle.id,
                "vehicle_number": vehicle.vehicle_number,
                "vehicle_type": vehicle.type,
                "score": final_score,
                "distance": f"{sim_distance:.1f} km",
                "cost": round(sim_cost, 2),
                "eta": sim_eta,
                "reasons": reasons
            })

    # Sort by score descending and take top 5
    recommendations.sort(key=lambda x: x["score"], reverse=True)
    return recommendations[:5]
