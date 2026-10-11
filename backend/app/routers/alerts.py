"""Alert routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user, require_manager
from ..websocket import manager

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[schemas.AlertResponse])
def get_alerts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "driver":
        driver = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if not driver:
            return []
        vehicle_number = None
        if driver.vehicle_id:
            vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == driver.vehicle_id).first()
            if vehicle:
                vehicle_number = vehicle.vehicle_number
        return (
            db.query(models.Alert)
            .filter(
                (models.Alert.driver_id == driver.id)
                | (models.Alert.vehicle_number == vehicle_number)
            )
            .order_by(models.Alert.timestamp.desc())
            .all()
        )
    return (
        db.query(models.Alert)
        .filter(models.Alert.manager_id == current_user.id)
        .order_by(models.Alert.timestamp.desc())
        .all()
    )


@router.post("", response_model=schemas.AlertResponse)
async def create_alert(
    alert_data: schemas.AlertCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    db_alert = models.Alert(**alert_data.model_dump(), manager_id=current_user.id)
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return db_alert


@router.put("/{alert_id}", response_model=schemas.AlertResponse)
async def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    alert = (
        db.query(models.Alert)
        .filter(models.Alert.id == alert_id, models.Alert.manager_id == current_user.id)
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved = True
    alert.severity = "Resolved"
    db.commit()
    db.refresh(alert)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return alert


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # FIX: previously any authenticated user could acknowledge any alert.
    query = db.query(models.Alert).filter(models.Alert.id == alert_id)
    if current_user.role == "manager":
        query = query.filter(models.Alert.manager_id == current_user.id)
    else:
        driver = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        query = query.filter(models.Alert.driver_id == (driver.id if driver else -1))

    alert = query.first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    alert.resolved = True
    db.commit()
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return {"message": "Alert acknowledged successfully"}
