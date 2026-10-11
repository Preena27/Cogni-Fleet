"""Vehicle routes."""
import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..access import owned_vehicle_or_404
from ..database import get_db
from ..security import get_current_user, require_manager
from ..websocket import manager

router = APIRouter(prefix="/api/vehicles", tags=["vehicles"])


@router.get("", response_model=list[schemas.VehicleResponse])
def get_vehicles(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "driver":
        driver = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if driver and driver.vehicle_id:
            return db.query(models.Vehicle).filter(models.Vehicle.id == driver.vehicle_id).all()
        return []
    return db.query(models.Vehicle).filter(models.Vehicle.manager_id == current_user.id).all()


@router.post("", response_model=schemas.VehicleResponse)
async def create_vehicle(
    vehicle: schemas.VehicleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    db_vehicle = models.Vehicle(**vehicle.model_dump(), manager_id=current_user.id)
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return db_vehicle


@router.put("/{vehicle_id}", response_model=schemas.VehicleResponse)
async def update_vehicle(
    vehicle_id: int,
    vehicle_data: schemas.VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    db_vehicle = owned_vehicle_or_404(db, vehicle_id, current_user)

    update_data = vehicle_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_vehicle, key, value)

    if {"odometer", "last_service_odometer", "service_interval"} & update_data.keys():
        db_vehicle.next_service_due = (db_vehicle.last_service_odometer or 0) + (
            db_vehicle.service_interval or 10000.0
        )

    db.commit()
    db.refresh(db_vehicle)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return db_vehicle


@router.post("/{vehicle_id}/refuel", response_model=schemas.VehicleResponse)
async def refuel_vehicle(
    vehicle_id: int,
    req: schemas.RefuelRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    db_vehicle = owned_vehicle_or_404(db, vehicle_id, current_user)

    if req.fuel_added <= 0:
        raise HTTPException(status_code=400, detail="Fuel added must be positive")

    capacity = db_vehicle.fuel_capacity or 100.0
    current = db_vehicle.current_fuel or 0.0
    if current + req.fuel_added > capacity:
        raise HTTPException(status_code=400, detail="Cannot exceed tank capacity")

    db_vehicle.current_fuel = current + req.fuel_added
    db_vehicle.fuel = int((db_vehicle.current_fuel / capacity) * 100)

    db.commit()
    db.refresh(db_vehicle)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return db_vehicle


@router.post("/{vehicle_id}/maintenance/complete", response_model=schemas.VehicleResponse)
async def complete_maintenance(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    db_vehicle = owned_vehicle_or_404(db, vehicle_id, current_user)

    db_vehicle.last_service_odometer = db_vehicle.odometer
    db_vehicle.next_service_due = (db_vehicle.odometer or 0) + (db_vehicle.service_interval or 10000.0)
    db_vehicle.availability = "Available"
    db_vehicle.health = 100
    db_vehicle.last_service_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")

    maintenance_alerts = (
        db.query(models.Alert)
        .filter(
            models.Alert.vehicle_number == db_vehicle.vehicle_number,
            models.Alert.manager_id == current_user.id,
            models.Alert.resolved == False,  # noqa: E712
            models.Alert.title.like("%Maintenance%"),
        )
        .all()
    )
    for alert in maintenance_alerts:
        alert.resolved = True

    db.commit()
    db.refresh(db_vehicle)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return db_vehicle


@router.delete("/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    db_vehicle = owned_vehicle_or_404(db, vehicle_id, current_user)
    db.delete(db_vehicle)
    db.commit()
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return {"message": "Vehicle deleted successfully"}
