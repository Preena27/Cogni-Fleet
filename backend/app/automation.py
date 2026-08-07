import datetime
from sqlalchemy.orm import Session
from .models import Trip, Driver, Vehicle, Alert, Invoice, ProofOfDelivery, AutomationLog
from .websocket import manager
import asyncio
import json

async def log_automation_step(db: Session, trigger: str, step: str, details: str, status: str = "Completed", manager_id: int = None, driver_id: int = None, vehicle_number: str = None):
    """Saves an automation pipeline step to the DB and broadcasts it via WebSocket."""
    log = AutomationLog(
        trigger_event=trigger,
        pipeline_step=step,
        status=status,
        details=details,
        timestamp=datetime.datetime.utcnow(),
        manager_id=manager_id
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    
    # Broadcast event
    await manager.broadcast({
        "type": "AUTOMATION_LOG",
        "log": {
            "id": log.id,
            "timestamp": log.timestamp.isoformat(),
            "trigger_event": log.trigger_event,
            "pipeline_step": log.pipeline_step,
            "status": log.status,
            "details": log.details,
            "manager_id": log.manager_id,
            "driver_id": driver_id,
            "vehicle_number": vehicle_number
        }
    })

async def run_trip_assigned_pipeline(trip_id: int, db: Session):
    """Pipeline: Trip Assigned -> Notify Driver"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        return
    
    driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
    driver_name = driver.name if driver else "Unknown Driver"
    
    await log_automation_step(db, "Trip Assigned", "Notify Driver", f"Sent SMS & push notification to driver {driver_name} for Trip #{trip_id}", manager_id=trip.manager_id, driver_id=trip.driver_id)
    
    # Create Low severity Alert for driver notification
    alert = Alert(
        severity="Low",
        title="Trip Assigned",
        description=f"Trip #{trip_id} (Customer: {trip.customer}) has been assigned to driver {driver_name}.",
        driver_name=driver_name,
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id,
        driver_id=trip.driver_id,
        manager_id=trip.manager_id
    )
    db.add(alert)
    db.commit()
    
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})

async def run_driver_response_pipeline(trip_id: int, accepted: bool, reason: str, db: Session):
    """Pipeline: Driver Accepts/Rejects -> Status & Vehicle updates"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        return
        
    driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).first()
    
    driver_name = driver.name if driver else "Unknown Driver"
    vehicle_no = vehicle.vehicle_number if vehicle else "Unknown Vehicle"
    
    if accepted:
        trip.status = "Accepted"
        if driver:
            driver.availability = "On Duty"
        if vehicle:
            vehicle.availability = "On Duty"
            vehicle.gps = "Online"
            vehicle.current_trip_id = trip_id
            
        db.commit()
        
        await log_automation_step(db, "Driver Accepted", "Update Asset Status", f"Driver {driver_name} accepted Trip #{trip_id}. Vehicle {vehicle_no} and Driver status set to 'On Duty'.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    else:
        # Rejected
        old_driver_id = trip.driver_id
        trip.status = "Unassigned"
        trip.driver_id = None
        trip.vehicle_id = None
        db.commit()
        
        await log_automation_step(db, "Driver Rejected", "Reassign Request", f"Driver {driver_name} rejected Trip #{trip_id}. Trip reset to 'Unassigned'. Reason: {reason or 'Not provided'}.", "Failed", manager_id=trip.manager_id, driver_id=old_driver_id, vehicle_number=vehicle_no)
        
        # Create Alert
        alert = Alert(
            severity="High",
            title="Trip Assignment Rejected",
            description=f"Driver {driver_name} rejected assignment for Trip #{trip_id} to {trip.destination}. Reason: {reason or 'Not provided'}.",
            driver_name=driver_name,
            timestamp=datetime.datetime.utcnow(),
            trip_id=trip_id,
            driver_id=old_driver_id,
            manager_id=trip.manager_id
        )
        db.add(alert)
        db.commit()

    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})

async def run_traffic_detected_pipeline(trip_id: int, db: Session):
    """Pipeline: Traffic Detected -> Suggest Better Route -> Update Route"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip or trip.status != "In Transit":
        return
        
    vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).first()
    vehicle_no = vehicle.vehicle_number if vehicle else "Unknown Vehicle"
    
    await log_automation_step(db, "Traffic Detected", "Rerouting Analysis", f"Heavy congestion detected on route for vehicle {vehicle_no}. Calculating alternative route...", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    
    # Suggest better route
    new_eta = "45 mins faster"
    await log_automation_step(db, "Traffic Detected", "Suggest Better Route", f"Alternative Route calculated: Detour via SR-21. Suggested ETA savings: {new_eta}.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    
    # Auto-approve route update in simulation
    trip.eta = "1h 15m"  # Updated ETA
    db.commit()
    await log_automation_step(db, "Traffic Detected", "Route Updated", f"Dynamic route update completed for Trip #{trip_id}. Driver notified of new navigation path.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    
    # Add info Alert
    alert = Alert(
        severity="Medium",
        title="Route Detour Active",
        description=f"Heavy traffic detected for Trip #{trip_id}. Rerouted via SR-21, saving 45 minutes.",
        vehicle_number=vehicle_no,
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id,
        driver_id=trip.driver_id,
        manager_id=trip.manager_id
    )
    db.add(alert)
    db.commit()

    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})

async def run_breakdown_pipeline(trip_id: int, db: Session):
    """Pipeline: Breakdown -> Alert -> Maintenance Ticket"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        return
        
    driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).first()
    
    driver_name = driver.name if driver else "Unknown Driver"
    vehicle_no = vehicle.vehicle_number if vehicle else "Unknown Vehicle"
    
    # Update statuses
    trip.status = "Problem"
    if vehicle:
        vehicle.availability = "Maintenance"
        vehicle.health = 45  # Dropped due to breakdown
        vehicle.speed = 0.0
    db.commit()
    
    await log_automation_step(db, "Breakdown", "Create Alert", f"Engine critical fault code active on vehicle {vehicle_no}. Status changed to Breakdown.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    
    # Create Critical Alert
    alert = Alert(
        severity="Critical",
        title="Vehicle Breakdown Alert",
        description=f"Vehicle {vehicle_no} (Driver: {driver_name}) broke down during Trip #{trip_id}. Location: Hwy 101, Mile 45.",
        vehicle_number=vehicle_no,
        driver_name=driver_name,
        location="Hwy 101, Mile 45",
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id,
        driver_id=trip.driver_id,
        manager_id=trip.manager_id
    )
    db.add(alert)
    db.commit()
    await log_automation_step(db, "Breakdown", "Notify Manager", f"Pushed critical alerts to fleet managers. Alert ID #{alert.id} opened.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    
    # Create Maintenance ticket log
    await log_automation_step(db, "Breakdown", "Maintenance Ticket", f"Auto-scheduled maintenance ticket for vehicle {vehicle_no} and dispatched replacement towing truck.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)

    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})

async def run_trip_completed_pipeline(trip_id: int, db: Session):
    """Pipeline: Trip Completed -> Invoice -> Report -> Store POD -> Update Analytics"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        return
        
    driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).first()
    
    driver_name = driver.name if driver else "Unknown Driver"
    vehicle_no = vehicle.vehicle_number if vehicle else "Unknown Vehicle"
    
    # Calculate automatic fuel consumption and cost
    mileage_kml = getattr(vehicle, "mileage_kml", 10.0) if vehicle and getattr(vehicle, "mileage_kml", 0) > 0 else 10.0
    trip_distance = trip.distance if trip.distance and trip.distance > 0 else 250.0
    trip.distance = trip_distance
    fuel_used = round(trip_distance / mileage_kml, 2)
    fuel_price = trip.fuel_price if (trip.fuel_price and trip.fuel_price > 0) else 95.0
    fuel_cost = round(fuel_used * fuel_price, 2)
    
    trip.fuel_used = fuel_used
    trip.fuel_price = fuel_price
    trip.fuel_cost = fuel_cost
    
    # Reset statuses
    trip.status = "Completed"
    if driver:
        driver.availability = "Available"
        driver.working_hours += 6.5  # Add trip hours
        driver.current_location = trip.destination
    if vehicle:
        vehicle.availability = "Available"
        vehicle.current_trip_id = None
        vehicle.mileage += trip.distance
        vehicle.odometer = (vehicle.odometer or 0) + trip.distance
        
        # Location tracking
        vehicle.current_location = trip.destination
        
        # Fuel calculations
        capacity = vehicle.fuel_capacity or 100.0
        current_f = vehicle.current_fuel or 100.0
        vehicle.current_fuel = max(0, current_f - fuel_used)
        if capacity > 0:
            vehicle.fuel = int((vehicle.current_fuel / capacity) * 100)
        else:
            vehicle.fuel = 0
            
        # Maintenance calculations
        next_due = vehicle.next_service_due or 10000.0
        remaining = next_due - vehicle.odometer
        
        if remaining <= 0:
            vehicle.availability = "Maintenance Due"
            existing_alert = db.query(Alert).filter(
                Alert.vehicle_number == vehicle_no,
                Alert.title == f"Maintenance Overdue: {vehicle_no}",
                Alert.resolved == False
            ).first()
            if not existing_alert:
                db.add(Alert(
                    severity="Critical",
                    priority="Critical",
                    title=f"Maintenance Overdue: {vehicle_no}",
                    description=f"Vehicle {vehicle_no} is overdue for maintenance by {-remaining} km.",
                    vehicle_number=vehicle_no,
                    manager_id=trip.manager_id
                ))
        elif remaining <= 500:
            existing_alert = db.query(Alert).filter(
                Alert.vehicle_number == vehicle_no,
                Alert.title == f"Maintenance Required Soon: {vehicle_no}",
                Alert.resolved == False
            ).first()
            if not existing_alert:
                db.add(Alert(
                    severity="High",
                    priority="High",
                    title=f"Maintenance Required Soon: {vehicle_no}",
                    description=f"Vehicle {vehicle_no} requires maintenance in {remaining} km.",
                    vehicle_number=vehicle_no,
                    manager_id=trip.manager_id
                ))
        elif remaining <= 1000:
            existing_alert = db.query(Alert).filter(
                Alert.vehicle_number == vehicle_no,
                Alert.title == f"Maintenance Due Soon: {vehicle_no}",
                Alert.resolved == False
            ).first()
            if not existing_alert:
                db.add(Alert(
                    severity="Medium",
                    priority="Warning",
                    title=f"Maintenance Due Soon: {vehicle_no}",
                    description=f"Vehicle {vehicle_no} requires maintenance in {remaining} km.",
                    vehicle_number=vehicle_no,
                    manager_id=trip.manager_id
                ))
    db.commit()
    
    await log_automation_step(db, "Trip Completed", "Update Analytics", f"Trip #{trip_id} marked Completed. Driver/Vehicle returned to available pool. Total distance {trip.distance} km logged.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    
    # Generate Invoice
    inv_num = f"INV-2026-{trip_id:04d}"
    sub = trip.revenue
    tax = round(sub * 0.18, 2)
    disc = 0.0
    tot = round(sub + tax - disc, 2)
    
    invoice = Invoice(
        invoice_number=inv_num,
        trip_id=trip_id,
        customer=trip.customer,
        subtotal=sub,
        tax=tax,
        discount=disc,
        total=tot,
        status="Pending",
        created_at=datetime.datetime.utcnow(),
        manager_id=trip.manager_id
    )
    db.add(invoice)
    db.commit()
    await log_automation_step(db, "Trip Completed", "Generate Invoice", f"Auto-generated Billing Invoice {inv_num} for customer '{trip.customer}'. Total amount: ${tot:,.2f}.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    
    # Generate Report
    await log_automation_step(db, "Trip Completed", "Generate Report", f"Appended Trip #{trip_id} metrics to weekly fuel and utilization logs.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    
    # Store POD (Initialize POD placeholder for manager review)
    pod = ProofOfDelivery(
        trip_id=trip_id,
        status="Pending",
        barcode=f"BARCODE-{trip_id}",
        qr_code=f"QR-{trip_id}",
        submitted_at=datetime.datetime.utcnow(),
        manager_id=trip.manager_id
    )
    db.add(pod)
    db.commit()
    await log_automation_step(db, "Trip Completed", "Store POD", f"Initialized Proof of Delivery tracker. Waiting for driver uploads.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    
    # Create Success alert
    alert = Alert(
        severity="Resolved",
        title="Delivery Completed Successfully",
        description=f"Trip #{trip_id} (Customer: {trip.customer}) successfully delivered by driver {driver_name}.",
        driver_name=driver_name,
        vehicle_number=vehicle_no,
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id,
        resolved=True,
        driver_id=trip.driver_id,
        manager_id=trip.manager_id
    )
    db.add(alert)
    db.commit()

    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "invoices"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "pods"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
