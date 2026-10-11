"""Proof of Delivery (POD) routes."""
import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user, require_manager
from ..websocket import manager
from ..automation import log_automation_step, run_trip_completed_pipeline

router = APIRouter(prefix="/api/pods", tags=["pods"])


def _owned_pod_or_404(db: Session, pod_id: int, current_user: models.User) -> models.ProofOfDelivery:
    pod = (
        db.query(models.ProofOfDelivery)
        .join(models.Trip, models.ProofOfDelivery.trip_id == models.Trip.id)
        .filter(
            models.ProofOfDelivery.id == pod_id,
            models.Trip.manager_id == current_user.id,
        )
        .first()
    )
    if not pod:
        raise HTTPException(status_code=404, detail="POD record not found")
    return pod


@router.get("", response_model=list[schemas.ProofOfDeliveryResponse])
def get_pods(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "driver":
        driver = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if driver:
            return (
                db.query(models.ProofOfDelivery)
                .join(models.Trip)
                .filter(models.Trip.driver_id == driver.id)
                .all()
            )
        return []
    return (
        db.query(models.ProofOfDelivery)
        .join(models.Trip)
        .filter(models.Trip.manager_id == current_user.id)
        .all()
    )


@router.delete("/{pod_id}")
async def delete_pod(
    pod_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    pod = _owned_pod_or_404(db, pod_id, current_user)
    trip_id = pod.trip_id
    db.delete(pod)
    db.commit()

    await log_automation_step(db, "POD Deleted", "Document Flow", f"Proof of Delivery record #{pod_id} was deleted by management.", manager_id=current_user.id)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "pods"})
    if trip_id:
        await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    return {"message": "POD record deleted successfully"}


@router.put("/{pod_id}", response_model=schemas.ProofOfDeliveryResponse)
async def update_pod(
    pod_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    pod = _owned_pod_or_404(db, pod_id, current_user)

    pod.status = status
    db.commit()
    db.refresh(pod)

    trip = db.query(models.Trip).filter(models.Trip.id == pod.trip_id).first()
    if trip:
        if status == "Approved":
            trip.status = "Completed"
            driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
            if driver:
                driver.availability = "Available"
            vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
            if vehicle:
                vehicle.availability = "Available"
                vehicle.current_trip_id = None

            history = json_load(trip.history)
            history.append({
                "status": "Completed",
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "notes": "Proof of Delivery approved by manager. Trip completed successfully.",
            })
            trip.history = dump_json(history)
            db.commit()

            # Idempotent: if the trip was already finalised via the driver flow
            # this is a no-op and will not create a duplicate invoice.
            await run_trip_completed_pipeline(trip.id, db)

            await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
            await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
            await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})

        elif status in ("Rejected", "Re-upload Requested"):
            trip.status = "Problem"
            note = (
                "Proof of Delivery REJECTED by manager."
                if status == "Rejected"
                else "Proof of Delivery flagged: Re-upload requested by manager."
            )
            history = json_load(trip.history)
            history.append({
                "status": "Problem",
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "notes": note,
            })
            trip.history = dump_json(history)
            db.commit()
            await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})

    await log_automation_step(db, f"POD {status}", "Document Flow", f"Proof of Delivery record #{pod_id} was marked {status} by management.", manager_id=current_user.id)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "pods"})
    return pod


@router.post("/submit")
async def driver_submit_pod(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    trip_id = payload.get("trip_id")
    signature = payload.get("signature_path")
    photo = payload.get("photo_path")
    latitude = payload.get("latitude")
    longitude = payload.get("longitude")

    if not trip_id:
        raise HTTPException(status_code=400, detail="trip_id is required")

    db_trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not db_trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    driver_id = None
    vehicle_id = None

    if current_user.role == "driver":
        drv = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if not drv or db_trip.driver_id != drv.id:
            raise HTTPException(status_code=403, detail="You can only submit POD for your assigned trips.")
        driver_id = drv.id
        vehicle_id = drv.vehicle_id
    elif db_trip.manager_id != current_user.id:
        raise HTTPException(status_code=404, detail="Trip not found")

    pod = db.query(models.ProofOfDelivery).filter(models.ProofOfDelivery.trip_id == trip_id).first()
    if not pod:
        pod = models.ProofOfDelivery(trip_id=trip_id, manager_id=db_trip.manager_id)
        db.add(pod)

    pod.signature_path = signature
    pod.photo_path = photo
    pod.status = "Pending"
    pod.submitted_at = datetime.datetime.utcnow()
    pod.latitude = latitude
    pod.longitude = longitude
    pod.driver_id = driver_id
    pod.vehicle_id = vehicle_id
    pod.manager_id = db_trip.manager_id
    db.commit()
    db.refresh(pod)

    db.add(models.Alert(
        severity="Medium",
        title="POD Pending Review",
        description=f"Driver {current_user.full_name or current_user.username} submitted POD for Trip #{trip_id}. Verification required.",
        location=db_trip.destination,
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id,
        driver_id=driver_id,
        manager_id=db_trip.manager_id,
    ))
    db.commit()

    await manager.broadcast({"type": "REFRESH_DATA", "module": "pods"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return pod


# Small local JSON helpers to keep the route readable.
def json_load(value):
    import json
    return json.loads(value or "[]")


def dump_json(value):
    import json
    return json.dumps(value)
