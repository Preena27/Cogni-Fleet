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

def _next_invoice_number(db: Session, manager_id: int) -> str:
    """Generate a unique invoice number for the current year.

    Previously hard-coded as ``INV-2026-{trip_id:04d}`` which collided with the
    seeded invoices and with re-used trip ids. We now derive the next sequence
    from existing invoices and guarantee uniqueness.
    """
    year = datetime.datetime.utcnow().year
    prefix = f"INV-{year}-"
    existing = [
        row[0]
        for row in db.query(Invoice.invoice_number).filter(
            Invoice.invoice_number.like(f"{prefix}%")
        )
    ]
    used = set()
    for number in existing:
        try:
            used.add(int(number.rsplit("-", 1)[-1]))
        except (ValueError, AttributeError):
            continue
    sequence = 1
    while sequence in used:
        sequence += 1
    return f"{prefix}{sequence:04d}"


async def run_trip_completed_pipeline(trip_id: int, db: Session):
    """Pipeline: Trip Completed -> Invoice -> Report -> Store POD -> Update Analytics.

    Idempotent: if the trip has already been finalised (an invoice exists), the
    pipeline exits early so mileage, hours and invoices are never double-counted.
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        return

    # Idempotency guard: this pipeline may be triggered by both the driver
    # "end trip" flow and the manager POD-approval flow.
    if db.query(Invoice).filter(Invoice.trip_id == trip_id).first():
        trip.status = "Completed"
        db.commit()
        return

    driver = db.query(Driver).filter(Driver.id == trip.driver_id).first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == trip.vehicle_id).first()

    driver_name = driver.name if driver else "Unknown Driver"
    vehicle_no = vehicle.vehicle_number if vehicle else "Unknown Vehicle"

    # Only account for the distance that has NOT already been applied by
    # incremental /progress updates, to avoid double counting.
    mileage_kml = vehicle.mileage_kml if (vehicle and (vehicle.mileage_kml or 0) > 0) else 10.0
    trip_distance = trip.distance if trip.distance and trip.distance > 0 else 250.0
    trip.distance = trip_distance
    remaining_distance = (
        trip.remaining_distance if trip.remaining_distance is not None else trip_distance
    )
    already_applied = max(0.0, min(trip_distance, trip_distance - remaining_distance))
    distance_to_apply = max(0.0, trip_distance - already_applied)
    fuel_used = round(distance_to_apply / mileage_kml, 2)
    fuel_price = trip.fuel_price if (trip.fuel_price and trip.fuel_price > 0) else 95.0

    trip.fuel_used = round((trip.fuel_used or 0.0) + fuel_used, 2)
    trip.fuel_price = fuel_price
    trip.fuel_cost = round(trip.fuel_used * fuel_price, 2)
    trip.remaining_distance = 0.0

    # Reset statuses
    trip.status = "Completed"
    if driver:
        driver.availability = "Available"
        avg_speed = trip.average_speed if (trip.average_speed and trip.average_speed > 0) else 52.5
        driver.working_hours = round(
            (driver.working_hours or 0.0) + (distance_to_apply / avg_speed), 2
        )
        driver.current_location = trip.destination
    if vehicle:
        vehicle.availability = "Available"
        vehicle.current_trip_id = None
        vehicle.mileage = (vehicle.mileage or 0.0) + distance_to_apply
        vehicle.odometer = (vehicle.odometer or 0.0) + distance_to_apply

        # Location tracking
        vehicle.current_location = trip.destination

        # Fuel calculations
        capacity = vehicle.fuel_capacity or 100.0
        current_f = vehicle.current_fuel if vehicle.current_fuel is not None else capacity
        vehicle.current_fuel = max(0.0, current_f - fuel_used)
        if capacity > 0:
            vehicle.fuel = int((vehicle.current_fuel / capacity) * 100)
        else:
            vehicle.fuel = 0
            
        # Maintenance calculations
        next_due = vehicle.next_service_due or 10000.0
        remaining_km = next_due - (vehicle.odometer or 0.0)

        if remaining_km <= 0:
            vehicle.availability = "Maintenance Due"
            existing_alert = db.query(Alert).filter(
                Alert.vehicle_number == vehicle_no,
                Alert.manager_id == trip.manager_id,
                Alert.title == f"Maintenance Overdue: {vehicle_no}",
                Alert.resolved == False  # noqa: E712
            ).first()
            if not existing_alert:
                db.add(Alert(
                    severity="Critical",
                    priority="Critical",
                    title=f"Maintenance Overdue: {vehicle_no}",
                    description=f"Vehicle {vehicle_no} is overdue for maintenance by {-remaining_km} km.",
                    vehicle_number=vehicle_no,
                    manager_id=trip.manager_id
                ))
        elif remaining_km <= 500:
            existing_alert = db.query(Alert).filter(
                Alert.vehicle_number == vehicle_no,
                Alert.manager_id == trip.manager_id,
                Alert.title == f"Maintenance Required Soon: {vehicle_no}",
                Alert.resolved == False  # noqa: E712
            ).first()
            if not existing_alert:
                db.add(Alert(
                    severity="High",
                    priority="High",
                    title=f"Maintenance Required Soon: {vehicle_no}",
                    description=f"Vehicle {vehicle_no} requires maintenance in {remaining_km} km.",
                    vehicle_number=vehicle_no,
                    manager_id=trip.manager_id
                ))
        elif remaining_km <= 1000:
            existing_alert = db.query(Alert).filter(
                Alert.vehicle_number == vehicle_no,
                Alert.manager_id == trip.manager_id,
                Alert.title == f"Maintenance Due Soon: {vehicle_no}",
                Alert.resolved == False  # noqa: E712
            ).first()
            if not existing_alert:
                db.add(Alert(
                    severity="Medium",
                    priority="Warning",
                    title=f"Maintenance Due Soon: {vehicle_no}",
                    description=f"Vehicle {vehicle_no} requires maintenance in {remaining_km} km.",
                    vehicle_number=vehicle_no,
                    manager_id=trip.manager_id
                ))
    db.commit()
    
    await log_automation_step(db, "Trip Completed", "Update Analytics", f"Trip #{trip_id} marked Completed. Driver/Vehicle returned to available pool. Total distance {trip.distance} km logged.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    
    # Generate Invoice (unique number, tenant-scoped)
    inv_num = _next_invoice_number(db, trip.manager_id)
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
    
    # Store POD (only if a POD record does not already exist for the trip)
    existing_pod = db.query(ProofOfDelivery).filter(ProofOfDelivery.trip_id == trip_id).first()
    if not existing_pod:
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
