"""AI / intelligence routes.

All endpoints require a manager and are scoped to that manager's tenant, which
fixes the previous behaviour where the intelligence feed leaked every tenant's
data and was reachable without authentication.
"""
import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..access import owned_trip_or_404
from ..database import get_db
from ..security import require_manager
from ..websocket import manager
from ..automation import log_automation_step, run_trip_assigned_pipeline
from ..ai_service import (
    ask_ai_assistant,
    evaluate_auto_assignment,
    get_full_fleet_intelligence,
)

router = APIRouter(tags=["ai"])


@router.get("/api/ai/intelligence")
def get_ai_intelligence(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    return get_full_fleet_intelligence(db, manager_id=current_user.id)


@router.post("/api/ai/execute-recommendation")
async def execute_ai_recommendation(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    action_type = payload.get("action_type")
    action_data = payload.get("action_payload", {})
    manager_id = current_user.id

    if action_type == "assign_load":
        trip_id = action_data.get("trip_id")
        driver_id = action_data.get("driver_id")
        vehicle_id = action_data.get("vehicle_id")

        trip = owned_trip_or_404(db, trip_id, current_user) if trip_id is not None else None
        driver = (
            db.query(models.Driver)
            .filter(models.Driver.id == driver_id, models.Driver.manager_id == manager_id)
            .first()
        )
        vehicle = (
            db.query(models.Vehicle)
            .filter(models.Vehicle.id == vehicle_id, models.Vehicle.manager_id == manager_id)
            .first()
        )

        if trip and driver and vehicle:
            trip.driver_id = driver.id
            trip.vehicle_id = vehicle.id
            trip.status = "Assigned"
            trip.assignment_reason = "Recommended by CogniFleet Proactive AI Engine"
            trip.assignment_confidence = 96.0
            trip.assignment_time = datetime.datetime.utcnow()
            driver.availability = "On Duty"
            vehicle.availability = "On Duty"
            vehicle.current_trip_id = trip.id
            db.commit()

            await run_trip_assigned_pipeline(trip.id, db)
            return {
                "message": f"Successfully assigned Load #{trip_id} to Driver {driver.name} & Vehicle {vehicle.vehicle_number}."
            }
        raise HTTPException(status_code=400, detail="Invalid load, driver or vehicle selection.")

    if action_type == "schedule_maintenance":
        vehicle_id = action_data.get("vehicle_id")
        vehicle = (
            db.query(models.Vehicle)
            .filter(models.Vehicle.id == vehicle_id, models.Vehicle.manager_id == manager_id)
            .first()
        )
        if vehicle:
            vehicle.availability = "Maintenance"
            db.commit()
            db.add(models.Alert(
                severity="Critical",
                priority="Critical",
                title=f"Maintenance Scheduled: {vehicle.vehicle_number}",
                description=f"Maintenance ticket created via AI Advisor 1-Click Action for {vehicle.vehicle_number}.",
                vehicle_number=vehicle.vehicle_number,
                timestamp=datetime.datetime.utcnow(),
                manager_id=manager_id,
            ))
            db.commit()
            await log_automation_step(db, "AI Action", "Schedule Maintenance", f"Scheduled maintenance for vehicle {vehicle.vehicle_number} via AI Proactive Engine.", manager_id=manager_id, vehicle_number=vehicle.vehicle_number)
            await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
            await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
            return {"message": f"Service inspection scheduled for Vehicle {vehicle.vehicle_number}."}
        raise HTTPException(status_code=404, detail="Vehicle not found")

    if action_type == "renew_license":
        driver_id = action_data.get("driver_id")
        driver = (
            db.query(models.Driver)
            .filter(models.Driver.id == driver_id, models.Driver.manager_id == manager_id)
            .first()
        )
        if driver:
            await log_automation_step(db, "AI Action", "License Renewal", f"Initiated commercial license renewal workflow for Driver {driver.name}.", manager_id=manager_id, driver_id=driver.id)
            await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
            return {"message": f"License renewal request generated for Driver {driver.name}."}
        raise HTTPException(status_code=404, detail="Driver not found")

    return {"message": "AI recommendation recorded successfully."}


@router.post("/api/ai-assistant")
def ai_assistant_chat(
    payload: schemas.AIQuery,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    response = ask_ai_assistant(
        payload.query,
        db,
        [m.model_dump() for m in payload.conversation] if payload.conversation else None,
        manager_id=current_user.id,
    )
    return {"response": response}


@router.get("/api/trips/{trip_id}/ai-assign")
def ai_auto_assign(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    owned_trip_or_404(db, trip_id, current_user)
    recommendations = evaluate_auto_assignment(trip_id, db, manager_id=current_user.id)
    return {"recommendations": recommendations}
