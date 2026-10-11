"""System maintenance routes (automation logs, tenant-scoped data reset)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import require_manager
from ..websocket import manager
from ..automation import log_automation_step

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/automation-logs", response_model=list[schemas.AutomationLogResponse])
def get_automation_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    return (
        db.query(models.AutomationLog)
        .filter(models.AutomationLog.manager_id == current_user.id)
        .order_by(models.AutomationLog.timestamp.desc())
        .all()
    )


@router.post("/system/reset")
async def reset_system_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    """Reset ONLY the current manager's data.

    FIX: the previous implementation issued global ``.delete()`` calls that
    wiped every tenant's records. All operations are now scoped by manager.
    """
    manager_id = current_user.id

    trip_ids = [row[0] for row in db.query(models.Trip.id).filter(models.Trip.manager_id == manager_id)]
    driver_user_ids = [
        row[0]
        for row in db.query(models.Driver.user_id).filter(
            models.Driver.manager_id == manager_id,
            models.Driver.user_id.isnot(None),
        )
    ]

    if trip_ids:
        db.query(models.ProofOfDelivery).filter(
            models.ProofOfDelivery.trip_id.in_(trip_ids)
        ).delete(synchronize_session=False)
        db.query(models.Invoice).filter(models.Invoice.trip_id.in_(trip_ids)).delete(
            synchronize_session=False
        )

    db.query(models.Alert).filter(models.Alert.manager_id == manager_id).delete(synchronize_session=False)
    db.query(models.AutomationLog).filter(
        models.AutomationLog.manager_id == manager_id
    ).delete(synchronize_session=False)
    db.query(models.Trip).filter(models.Trip.manager_id == manager_id).delete(synchronize_session=False)
    db.query(models.Driver).filter(models.Driver.manager_id == manager_id).delete(synchronize_session=False)
    if driver_user_ids:
        db.query(models.User).filter(
            models.User.id.in_(driver_user_ids),
            models.User.role == "driver",
        ).delete(synchronize_session=False)

    for vehicle in db.query(models.Vehicle).filter(models.Vehicle.manager_id == manager_id).all():
        vehicle.availability = "Available"
        vehicle.current_trip_id = None
        vehicle.speed = 0.0
        vehicle.gps = "Offline"

    db.commit()

    for module in ("trips", "drivers", "vehicles", "pods", "alerts", "invoices"):
        await manager.broadcast({"type": "REFRESH_DATA", "module": module})

    await log_automation_step(
        db, "System Reset", "Database Cleaned",
        "Manager triggered a database purge of their own tenant data. Manager account preserved.",
        manager_id=manager_id,
    )
    return {"message": "Your fleet data has been reset. Manager account preserved."}
