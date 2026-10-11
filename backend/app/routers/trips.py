"""Trip / load routes.

This module owns the full trip lifecycle: creation, assignment, driver
acceptance, in-transit actions and completion. Every route is authenticated and
scoped to the caller's tenant (manager) or assignment (driver).
"""
import datetime
import json
from typing import List, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..access import owned_trip_or_404
from ..database import get_db
from ..security import get_current_user, require_manager
from ..websocket import manager
from ..automation import (
    log_automation_step,
    run_breakdown_pipeline,
    run_driver_response_pipeline,
    run_traffic_detected_pipeline,
    run_trip_assigned_pipeline,
    run_trip_completed_pipeline,
)

router = APIRouter(prefix="/api/trips", tags=["trips"])

# Fields a driver is permitted to change via PUT /api/trips/{id}.
DRIVER_EDITABLE_FIELDS = {
    "status",
    "notes",
    "eta",
    "trip_duration",
    "average_speed",
    "idle_time",
    "route_taken",
    "remaining_distance",
    "fuel_used",
    "history",
    "stops",
    "instructions",
}


def _load_trip(db: Session, trip_id: int) -> models.Trip:
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.get("", response_model=List[schemas.TripResponse])
def get_trips(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "driver":
        driver = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if driver:
            return db.query(models.Trip).filter(models.Trip.driver_id == driver.id).all()
        return []
    return db.query(models.Trip).filter(models.Trip.manager_id == current_user.id).all()


@router.get("/driver/{username}", response_model=List[schemas.TripResponse])
def get_driver_trips(
    username: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not user.driver_profile:
        return []
    # Ensure the driver belongs to this manager before exposing their trips.
    if user.driver_profile.manager_id != current_user.id:
        return []
    return (
        db.query(models.Trip)
        .filter(
            models.Trip.driver_id == user.driver_profile.id,
            models.Trip.manager_id == current_user.id,
        )
        .all()
    )


@router.post("", response_model=schemas.TripResponse)
async def create_trip(
    trip: schemas.TripCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    route_coords = [[37.7749, -122.4194], [34.0522, -118.2437]]

    trip_dict = trip.model_dump()
    if not trip_dict.get("route_coordinates"):
        trip_dict["route_coordinates"] = json.dumps(route_coords)
    trip_dict["manager_id"] = current_user.id
    if not trip_dict.get("stops"):
        trip_dict["stops"] = json.dumps([
            {"location": trip.pickup, "type": "Pickup", "status": "Pending"},
            {"location": trip.destination, "type": "Delivery", "status": "Pending"},
        ])
    if not trip_dict.get("history"):
        trip_dict["history"] = json.dumps([
            {"status": "Unassigned", "timestamp": datetime.datetime.utcnow().isoformat(), "notes": "Load created."}
        ])
    if not trip_dict.get("revenue"):
        weight_val = trip.weight if trip.weight is not None else 0.0
        trip_dict["revenue"] = round(weight_val * 450 + 800, 2)
    if not trip_dict.get("fuel_cost"):
        trip_dict["fuel_cost"] = round(trip_dict["revenue"] * 0.22, 2)
    if not trip_dict.get("distance"):
        trip_dict["distance"] = 620.0
    if not trip_dict.get("remaining_distance"):
        # Default the outstanding distance to the full trip distance. Using a
        # fixed 620 here previously desynced mileage tracking for custom trips.
        trip_dict["remaining_distance"] = trip_dict["distance"]

    db_trip = models.Trip(**trip_dict)
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)

    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await log_automation_step(
        db, "Load Created", "Database Update",
        f"New Load #{db_trip.id} registered for customer '{db_trip.customer}'. Weight: {db_trip.weight} tons.",
        manager_id=current_user.id,
    )
    return db_trip


@router.post("/bulk")
async def bulk_create_trips(
    trips: List[schemas.TripBulkImportItem],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    success_count = 0
    skipped_count = 0
    failed_count = 0
    route_coords = [[37.7749, -122.4194], [34.0522, -118.2437]]

    for item in trips:
        try:
            if item.id is not None:
                existing_by_id = (
                    db.query(models.Trip)
                    .filter(models.Trip.id == item.id, models.Trip.manager_id == current_user.id)
                    .first()
                )
                if existing_by_id:
                    skipped_count += 1
                    continue

            existing_by_fields = db.query(models.Trip).filter(
                models.Trip.customer == item.customer,
                models.Trip.pickup == item.pickup,
                models.Trip.destination == item.destination,
                models.Trip.manager_id == current_user.id,
            ).first()
            if existing_by_fields:
                skipped_count += 1
                continue

            trip_dict = item.model_dump()
            trip_dict["manager_id"] = current_user.id
            if not trip_dict.get("route_coordinates"):
                trip_dict["route_coordinates"] = json.dumps(route_coords)
            if not trip_dict.get("stops"):
                trip_dict["stops"] = json.dumps([
                    {"location": item.pickup, "type": "Pickup", "status": "Pending"},
                    {"location": item.destination, "type": "Delivery", "status": "Pending"},
                ])
            if not trip_dict.get("history"):
                trip_dict["history"] = json.dumps([
                    {"status": "Unassigned", "timestamp": datetime.datetime.utcnow().isoformat(), "notes": "Load imported via CSV."}
                ])
            if not trip_dict.get("revenue"):
                weight_val = item.weight if item.weight is not None else 0.0
                trip_dict["revenue"] = round(weight_val * 450 + 800, 2)
            if not trip_dict.get("fuel_cost"):
                trip_dict["fuel_cost"] = round(trip_dict["revenue"] * 0.22, 2)
            if not trip_dict.get("distance"):
                trip_dict["distance"] = 620.0
            if not trip_dict.get("remaining_distance"):
                trip_dict["remaining_distance"] = trip_dict["distance"]

            db.add(models.Trip(**trip_dict))
            success_count += 1
        except Exception as e:  # noqa: BLE001
            print(f"Error importing row: {e}")
            failed_count += 1

    if success_count > 0:
        db.commit()
        await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})

    return {"success": success_count, "skipped": skipped_count, "failed": failed_count}


@router.post("/{trip_id}/manual-assign", response_model=schemas.TripResponse)
async def manual_assign_trip(
    trip_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    db_trip = owned_trip_or_404(db, trip_id, current_user)

    driver_id = payload.get("driver_id")
    vehicle_id = payload.get("vehicle_id")

    # FIX: driver and vehicle must belong to this manager.
    driver = (
        db.query(models.Driver)
        .filter(models.Driver.id == driver_id, models.Driver.manager_id == current_user.id)
        .first()
    )
    vehicle = (
        db.query(models.Vehicle)
        .filter(models.Vehicle.id == vehicle_id, models.Vehicle.manager_id == current_user.id)
        .first()
    )
    if not driver or not vehicle:
        raise HTTPException(status_code=400, detail="Invalid driver or vehicle selection")

    db_trip.driver_id = driver.id
    db_trip.vehicle_id = vehicle.id
    db_trip.status = "Assigned"
    db_trip.assignment_reason = "Manually Assigned by Dispatch Manager"
    db_trip.assignment_confidence = 100.0
    db_trip.assignment_time = datetime.datetime.utcnow()

    driver.availability = "On Duty"
    vehicle.availability = "On Duty"
    vehicle.current_trip_id = db_trip.id

    history = json.loads(db_trip.history) if db_trip.history else []
    history.append({
        "status": "Assigned",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": f"Manually assigned to Driver {driver.name} and Vehicle {vehicle.vehicle_number}.",
    })
    db_trip.history = json.dumps(history)

    db.commit()
    db.refresh(db_trip)

    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await log_automation_step(
        db, "Manual Assignment", "Database Update",
        f"Trip #{db_trip.id} manually assigned to Driver {driver.name} and Vehicle {vehicle.vehicle_number}.",
        manager_id=current_user.id, driver_id=driver.id, vehicle_number=vehicle.vehicle_number,
    )
    return db_trip


@router.post("/{trip_id}/auto-assign", response_model=schemas.TripResponse)
async def auto_assign_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    db_trip = owned_trip_or_404(db, trip_id, current_user)

    avail_drivers = db.query(models.Driver).filter(
        models.Driver.availability == "Available",
        models.Driver.manager_id == current_user.id,
    ).all()
    avail_vehicles = db.query(models.Vehicle).filter(
        models.Vehicle.availability == "Available",
        models.Vehicle.manager_id == current_user.id,
    ).all()

    webhook_payload = {
        "trip_id": str(db_trip.id),
        "pickup": db_trip.pickup,
        "destination": db_trip.destination,
        "priority": db_trip.priority,
        "available_drivers": [
            {"id": str(d.id), "name": d.name, "experience": d.experience, "rating": d.rating}
            for d in avail_drivers
        ],
        "available_vehicles": [
            {"id": str(v.id), "vehicle_number": v.vehicle_number, "capacity": v.capacity, "type": v.type}
            for v in avail_vehicles
        ],
    }

    driver_id = None
    vehicle_id = None
    reason = "Auto assignment decision from SNS Workbench."
    confidence = 100.0

    try:
        response = requests.post(
            "https://api.agents.snsihub.ai/webhook-test/fleet/trip",
            json=webhook_payload,
            timeout=8.0,
        )
        if response.status_code == 200:
            res_data = response.json()
            assignment = None
            if "output" in res_data and isinstance(res_data["output"], dict):
                output_data = res_data["output"]
                if "items" in output_data and len(output_data["items"]) > 0:
                    item_json = output_data["items"][0].get("json", {})
                    if "driver_id" in item_json or "vehicle_id" in item_json:
                        assignment = item_json
            if not assignment and ("driver_id" in res_data or "vehicle_id" in res_data):
                assignment = res_data

            if assignment:
                driver_id = assignment.get("driver_id")
                vehicle_id = assignment.get("vehicle_id")
                reason = assignment.get("reason", "SNS Workbench Auto-Assign Algorithm recommendation.")
                try:
                    confidence = float(assignment.get("confidence", 95.0))
                except (TypeError, ValueError):
                    confidence = 95.0
    except Exception as e:  # noqa: BLE001
        print(f"WEBHOOK ERROR during auto-assign: {e}")

    final_driver = None
    final_vehicle = None

    # FIX: resolve agent-recommended assets only within this manager's tenant.
    if driver_id:
        if isinstance(driver_id, str) and not driver_id.isdigit():
            final_driver = (
                db.query(models.Driver)
                .filter(models.Driver.name == driver_id, models.Driver.manager_id == current_user.id)
                .first()
            )
        else:
            final_driver = (
                db.query(models.Driver)
                .filter(models.Driver.id == int(driver_id), models.Driver.manager_id == current_user.id)
                .first()
            )

    if vehicle_id:
        if isinstance(vehicle_id, str) and not vehicle_id.isdigit():
            final_vehicle = (
                db.query(models.Vehicle)
                .filter(models.Vehicle.vehicle_number == vehicle_id, models.Vehicle.manager_id == current_user.id)
                .first()
            )
        else:
            final_vehicle = (
                db.query(models.Vehicle)
                .filter(models.Vehicle.id == int(vehicle_id), models.Vehicle.manager_id == current_user.id)
                .first()
            )

    if not final_driver or not final_vehicle:
        # FIX: fallback previously selected ANY tenant's assets.
        final_driver = (
            db.query(models.Driver)
            .filter(models.Driver.availability == "Available", models.Driver.manager_id == current_user.id)
            .first()
        )
        final_vehicle = (
            db.query(models.Vehicle)
            .filter(models.Vehicle.availability == "Available", models.Vehicle.manager_id == current_user.id)
            .first()
        )
        reason = "System Fallback Auto-Assignment (No valid agent response)."
        confidence = 70.0

    if not (final_driver and final_vehicle):
        raise HTTPException(status_code=400, detail="No available drivers or vehicles to complete assignment.")

    db_trip.driver_id = final_driver.id
    db_trip.vehicle_id = final_vehicle.id
    db_trip.status = "Assigned"
    db_trip.assignment_reason = reason
    db_trip.assignment_confidence = confidence
    db_trip.assignment_time = datetime.datetime.utcnow()

    final_driver.availability = "On Duty"
    final_vehicle.availability = "On Duty"
    final_vehicle.current_trip_id = db_trip.id

    history = json.loads(db_trip.history) if db_trip.history else []
    history.append({
        "status": "Assigned",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": f"Auto-assigned to Driver {final_driver.name} and Vehicle {final_vehicle.vehicle_number}. Reason: {reason} (Confidence: {confidence}%).",
    })
    db_trip.history = json.dumps(history)

    db.commit()
    db.refresh(db_trip)

    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await log_automation_step(
        db, "Auto Assignment", "Agent Decision",
        f"Trip #{db_trip.id} auto-assigned to Driver {final_driver.name} and Vehicle {final_vehicle.vehicle_number} (Conf: {confidence}%).",
        manager_id=current_user.id, driver_id=final_driver.id, vehicle_number=final_vehicle.vehicle_number,
    )
    return db_trip


@router.put("/{trip_id}", response_model=schemas.TripResponse)
async def update_trip(
    trip_id: int,
    trip_data: schemas.TripBase,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_trip = owned_trip_or_404(db, trip_id, current_user)

    old_status = db_trip.status
    old_driver = db_trip.driver_id

    update_data = trip_data.model_dump(exclude_unset=True)
    if current_user.role == "driver":
        # FIX: drivers may only mutate an explicit whitelist of fields and can
        # never reassign a trip or change its tenant/ownership.
        update_data = {k: v for k, v in update_data.items() if k in DRIVER_EDITABLE_FIELDS}

    for key, value in update_data.items():
        if key in ("driver_id", "vehicle_id") and current_user.role != "manager":
            continue
        if key == "manager_id":
            continue
        if hasattr(db_trip, key):
            setattr(db_trip, key, value)

    db.commit()
    db.refresh(db_trip)

    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})

    if db_trip.driver_id and db_trip.driver_id != old_driver:
        await run_trip_assigned_pipeline(db_trip.id, db)

    if db_trip.status != old_status:
        history = json.loads(db_trip.history or "[]")
        history.append({
            "status": db_trip.status,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "notes": f"Status updated from {old_status} to {db_trip.status}.",
        })
        db_trip.history = json.dumps(history)
        db.commit()

        if db_trip.status == "In Transit":
            await log_automation_step(db, "Trip In Transit", "GPS Tracking Activated", f"Trip #{db_trip.id} is now live on GPS mapping. Dispatch center initialized.", manager_id=db_trip.manager_id)
        elif db_trip.status == "Completed":
            await run_trip_completed_pipeline(db_trip.id, db)
        elif db_trip.status == "Problem":
            await log_automation_step(db, "Trip Flagged Problem", "Alert Triggered", f"Trip #{db_trip.id} has manual problem flag applied.", manager_id=db_trip.manager_id)

    return db_trip


@router.delete("/{trip_id}")
async def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    db_trip = owned_trip_or_404(db, trip_id, current_user)
    if db_trip.status not in ("Unassigned", "Draft"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete load #{trip_id} because it is currently '{db_trip.status}' (assigned or in progress).",
        )
    db.delete(db_trip)
    db.commit()
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    return {"message": "Trip deleted successfully"}


@router.post("/{trip_id}/accept")
async def accept_trip(
    trip_id: int,
    accept: bool = True,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Handle both manager load acceptance and driver accept/reject.

    FIX: the original code registered two handlers for this path, so the driver
    handler was dead code and driver accept/reject always failed. This single
    handler routes to the correct behaviour based on role.
    """
    trip = owned_trip_or_404(db, trip_id, current_user)

    if current_user.role == "manager":
        trip.status = "Accepted"
        db.commit()
        db.refresh(trip)
        await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
        return {"status": "success", "accepted": True}

    await run_driver_response_pipeline(trip_id, accept, reason, db)
    return {"status": "success", "accepted": accept}


@router.post("/{trip_id}/simulate-event")
async def simulate_trip_event(
    trip_id: int,
    event_type: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Simulate background automation events: traffic, breakdown, or completing."""
    owned_trip_or_404(db, trip_id, current_user)
    if event_type == "traffic":
        await run_traffic_detected_pipeline(trip_id, db)
    elif event_type == "breakdown":
        await run_breakdown_pipeline(trip_id, db)
    elif event_type == "complete":
        await run_trip_completed_pipeline(trip_id, db)
    else:
        raise HTTPException(status_code=400, detail="Invalid event type")
    return {"status": "success", "event": event_type}


@router.post("/{trip_id}/start")
async def start_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip = owned_trip_or_404(db, trip_id, current_user)
    trip.status = "In Transit"
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    if driver:
        driver.availability = "On Duty"
    if vehicle:
        vehicle.availability = "In Transit"
        vehicle.gps = "Online"
        vehicle.speed = 55.0
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "In Transit",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": "Trip started. Driver departed warehouse dock.",
    })
    trip.history = json.dumps(history)
    db.commit()
    await log_automation_step(db, "Trip Started", "GPS Tracking Activated", f"Trip #{trip_id} started. GPS tracking initialized. Driver set to 'Driving'.", manager_id=trip.manager_id, driver_id=trip.driver_id)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return {"status": "success"}


@router.post("/{trip_id}/pause")
async def pause_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip = owned_trip_or_404(db, trip_id, current_user)
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    if driver:
        driver.availability = "Off Duty"
    if vehicle:
        vehicle.speed = 0.0
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "Stopped",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": "Transit paused. Driver registered rest stop.",
    })
    trip.history = json.dumps(history)
    db.commit()
    await log_automation_step(db, "Trip Paused", "Asset Stopped", f"Trip #{trip_id} paused. Vehicle speed set to 0.0.", manager_id=trip.manager_id, driver_id=trip.driver_id)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return {"status": "success"}


@router.post("/{trip_id}/resume")
async def resume_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip = owned_trip_or_404(db, trip_id, current_user)
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    if driver:
        driver.availability = "Driving"
    if vehicle:
        vehicle.speed = 55.0
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "In Transit",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": "Transit resumed. Driver back behind the wheel.",
    })
    trip.history = json.dumps(history)
    db.commit()
    await log_automation_step(db, "Trip Resumed", "Asset Moving", f"Trip #{trip_id} resumed. Vehicle speed restored to 55.0.", manager_id=trip.manager_id, driver_id=trip.driver_id)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return {"status": "success"}


@router.post("/{trip_id}/stopped-reason")
async def stopped_reason(
    trip_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip = owned_trip_or_404(db, trip_id, current_user)
    reason = payload.get("reason", "Waiting")
    location = payload.get("location", "Unknown Location")
    duration = payload.get("duration", 5.0)
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    driver_name = driver.name if driver else "Driver"
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    vehicle_no = vehicle.vehicle_number if vehicle else "TRK"
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "Stopped",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": f"Stopped at {location} for {duration} mins. Reason: {reason}.",
    })
    trip.history = json.dumps(history)
    alert = models.Alert(
        severity="Warning",
        title="Vehicle Stopped Alert",
        description=f"Driver {driver_name} (Vehicle {vehicle_no}) stopped at {location}. Reason: {reason}. Duration: {duration} mins.",
        driver_name=driver_name,
        vehicle_number=vehicle_no,
        location=location,
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id,
        driver_id=trip.driver_id,
        manager_id=trip.manager_id,
    )
    db.add(alert)
    db.commit()
    await log_automation_step(db, "Stop Registered", "Incident Log", f"Trip #{trip_id} registered stop reason: '{reason}' at {location}.", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return {"status": "success"}


@router.post("/{trip_id}/report-issue")
async def report_issue(
    trip_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip = owned_trip_or_404(db, trip_id, current_user)
    issue_type = payload.get("issue_type", "Problem")
    description = payload.get("description", "")
    priority = payload.get("priority", "High")
    gps = payload.get("gps", "Unknown")

    if issue_type in ["Accident", "Vehicle Breakdown", "Medical Emergency", "Engine Problem"]:
        priority = "Critical"

    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    driver_name = driver.name if driver else "Driver"
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    vehicle_no = vehicle.vehicle_number if vehicle else "TRK"

    history = json.loads(trip.history or "[]")
    history.append({
        "status": "Problem",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": f"Incident reported: {issue_type}. Priority: {priority.upper()}. Details: {description}.",
    })
    trip.history = json.dumps(history)
    trip.status = "Problem"
    if vehicle and issue_type in ["Vehicle Breakdown", "Engine Problem", "Flat Tyre", "Accident"]:
        vehicle.availability = "Maintenance"
        vehicle.speed = 0.0

    time_str = datetime.datetime.utcnow().strftime("%I:%M %p")
    location_str = gps if (gps and gps != "Unknown") else (vehicle.current_location if vehicle else f"{trip.pickup} -> {trip.destination}")

    title_text = f"🔴 CRITICAL - {issue_type.upper()}" if priority.upper() == "CRITICAL" else f"Incident Reported: {issue_type}"
    desc_text = f"Driver: {driver_name} | Vehicle: {vehicle_no} | Trip #{trip_id}: {trip.pickup} -> {trip.destination} | Reason: {description or issue_type} | Location: {location_str} | Time: {time_str} | Priority: {priority.upper()}"

    alert = models.Alert(
        severity=priority,
        priority=priority,
        title=title_text,
        description=desc_text,
        driver_name=driver_name,
        vehicle_number=vehicle_no,
        location=location_str,
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id,
        driver_id=trip.driver_id,
        manager_id=trip.manager_id,
    )
    db.add(alert)
    db.commit()

    await log_automation_step(db, "Issue Filed", "Incident Log", f"Trip #{trip_id} flagged with problem '{issue_type}' (Priority: {priority.upper()}).", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    return {"status": "success"}


@router.post("/{trip_id}/sos")
async def trigger_sos(
    trip_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip = owned_trip_or_404(db, trip_id, current_user)
    gps = payload.get("gps", "Unknown")
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    driver_name = driver.name if driver else "Driver"
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    vehicle_no = vehicle.vehicle_number if vehicle else "TRK"
    trip.status = "Problem"
    if vehicle:
        vehicle.speed = 0.0
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "Problem",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": f"EMERGENCY SOS TRIGGERED from coordinates: {gps}.",
    })
    trip.history = json.dumps(history)
    alert = models.Alert(
        severity="Critical",
        title="EMERGENCY SOS",
        description=f"Driver {driver_name} (Vehicle {vehicle_no}) triggered SOS from coordinates {gps}!",
        driver_name=driver_name,
        vehicle_number=vehicle_no,
        location=gps,
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id,
        driver_id=trip.driver_id,
        manager_id=trip.manager_id,
    )
    db.add(alert)
    db.commit()
    await log_automation_step(db, "EMERGENCY SOS", "Critical Alarm", f"CRITICAL SOS alarm activated for Trip #{trip_id} at location: {gps}.", "Failed", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return {"status": "success"}


@router.post("/{trip_id}/end")
async def end_trip(
    trip_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip = owned_trip_or_404(db, trip_id, current_user)
    pod = db.query(models.ProofOfDelivery).filter(models.ProofOfDelivery.trip_id == trip_id).first()
    if not pod or not pod.signature_path or not pod.photo_path:
        raise HTTPException(status_code=400, detail="Cannot end trip: Proof of Delivery is incomplete")

    trip.trip_duration = payload.get("duration", 240.0)
    trip.average_speed = payload.get("average_speed", 52.5)
    trip.idle_time = payload.get("idle_time", 15.0)
    trip.route_taken = json.dumps(payload.get("route_taken", []))
    # NOTE: remaining_distance is intentionally NOT zeroed here. The completion
    # pipeline uses it to determine how much distance has not yet been applied
    # by incremental /progress updates, preventing double-counted mileage.
    trip.status = "Completed"

    history = json.loads(trip.history or "[]")
    distance = trip.distance if trip.distance is not None else 0.0
    history.append({
        "status": "Completed",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": f"Trip finished successfully. Duration: {trip.trip_duration} mins. Distance: {distance} km.",
    })
    trip.history = json.dumps(history)
    stops = json.loads(trip.stops or "[]")
    for stop in stops:
        stop["status"] = "Completed"
    trip.stops = json.dumps(stops)
    db.commit()

    await run_trip_completed_pipeline(trip_id, db)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "pods"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "invoices"})
    return {"status": "success"}


@router.post("/{trip_id}/progress")
async def progress_trip(
    trip_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip = owned_trip_or_404(db, trip_id, current_user)

    distance_delta = float(payload.get("distance_delta", 0.0))
    lat = payload.get("lat")
    lng = payload.get("lng")
    speed = payload.get("speed", 55.0)
    current_location = payload.get("current_location")

    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first() if trip.vehicle_id else None
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first() if trip.driver_id else None

    is_idle = payload.get("is_idle", False)
    idle_duration = float(payload.get("idle_duration", 0.0))
    idle_reason = payload.get("idle_reason", "Stopped / Break")
    trigger_5min_alert = payload.get("trigger_5min_alert", False)

    if is_idle and vehicle:
        vehicle.speed = 0.0
        vehicle.availability = "IDLE"
        if driver:
            driver.availability = "On Duty"

        trip.idle_time = round((trip.idle_time or 0.0) + (idle_duration / 60.0), 2)

        if trigger_5min_alert or idle_duration >= 300.0:
            driver_name = driver.name if driver else "Driver"
            vehicle_no = vehicle.vehicle_number if vehicle else "TRK"
            duration_mins = round(idle_duration / 60.0, 1)
            location_str = current_location or f"GPS ({lat or 13.08}, {lng or 80.27})"

            existing_alert = db.query(models.Alert).filter(
                models.Alert.trip_id == trip_id,
                models.Alert.manager_id == trip.manager_id,
                models.Alert.title.like("%Excessive Vehicle Idle Alert%"),
            ).first()

            if not existing_alert:
                db.add(models.Alert(
                    severity="Warning",
                    priority="Warning",
                    title="Excessive Vehicle Idle Alert (>5 mins)",
                    description=f"Driver {driver_name} (Vehicle {vehicle_no}) idle for {duration_mins} mins during Trip #{trip_id}. Reason: {idle_reason}. Location: {location_str}.",
                    driver_name=driver_name,
                    vehicle_number=vehicle_no,
                    location=location_str,
                    timestamp=datetime.datetime.utcnow(),
                    trip_id=trip_id,
                    driver_id=trip.driver_id,
                    manager_id=trip.manager_id,
                ))
                db.commit()
                await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})

        db.commit()
        await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})

    elif distance_delta > 0 and vehicle:
        mileage_kml = vehicle.mileage_kml if (vehicle.mileage_kml and vehicle.mileage_kml > 0) else 10.0
        fuel_consumed = distance_delta / mileage_kml

        current_f = vehicle.current_fuel if vehicle.current_fuel is not None else (vehicle.fuel_capacity or 100.0)
        vehicle.current_fuel = max(0.0, current_f - fuel_consumed)

        capacity = vehicle.fuel_capacity or 100.0
        if capacity > 0:
            vehicle.fuel = int((vehicle.current_fuel / capacity) * 100)

        vehicle.odometer = (vehicle.odometer or 0.0) + distance_delta
        vehicle.mileage = (vehicle.mileage or 0.0) + distance_delta
        if lat is not None and lng is not None:
            vehicle.latitude = lat
            vehicle.longitude = lng
        if current_location:
            vehicle.current_location = current_location
        vehicle.speed = speed
        vehicle.gps = "Online"
        vehicle.availability = "In Transit"

        remaining = trip.remaining_distance if trip.remaining_distance is not None else (trip.distance or 0.0)
        trip.remaining_distance = max(0.0, remaining - distance_delta)
        trip.fuel_used = (trip.fuel_used or 0.0) + fuel_consumed

        if driver:
            driver.availability = "On Duty"
            driver.working_hours = round((driver.working_hours or 0.0) + (distance_delta / speed if speed > 0 else 0.05), 2)
            if current_location:
                driver.current_location = current_location

        db.commit()

        await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})

    return {
        "status": "success",
        "remaining_distance": trip.remaining_distance,
        "current_fuel": vehicle.current_fuel if vehicle else None,
        "fuel_percentage": vehicle.fuel if vehicle else None,
    }
