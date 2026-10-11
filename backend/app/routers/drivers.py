"""Driver routes."""
import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user, get_password_hash, require_manager
from ..websocket import manager
from ..automation import log_automation_step

router = APIRouter(prefix="/api/drivers", tags=["drivers"])


@router.get("", response_model=list[schemas.DriverResponse])
def get_drivers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "driver":
        return db.query(models.Driver).filter(models.Driver.user_id == current_user.id).all()
    # FIX: managers only ever see their own drivers (previously returned ALL).
    return db.query(models.Driver).filter(models.Driver.manager_id == current_user.id).all()


@router.post("", response_model=schemas.DriverResponse)
async def create_driver(
    driver: schemas.DriverCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    existing = db.query(models.User).filter(models.User.username == driver.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken.")

    db_user = models.User(
        username=driver.username,
        hashed_password=get_password_hash(driver.password),
        role="driver",
        phone=driver.phone,
        company_name=current_user.company_name,
    )
    db.add(db_user)
    db.flush()

    db_driver = models.Driver(
        user_id=db_user.id,
        manager_id=current_user.id,
        name=driver.name,
        license=driver.license,
        phone=driver.phone,
        email=driver.email,
        address=driver.address,
        emergency_contact=driver.emergency_contact,
        current_location=driver.current_location,
        experience=driver.experience,
        availability="Available",
        working_hours=0.0,
        rating=5.0,
        violations=0,
        health="Good",
        performance=100.0,
    )
    db.add(db_driver)
    db.commit()
    db.refresh(db_driver)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    return db_driver


@router.put("/{driver_id}", response_model=schemas.DriverResponse)
async def update_driver(
    driver_id: int,
    driver_data: schemas.DriverUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "driver":
        db_driver = (
            db.query(models.Driver)
            .filter(models.Driver.id == driver_id, models.Driver.user_id == current_user.id)
            .first()
        )
        if not db_driver:
            raise HTTPException(status_code=403, detail="Not authorized to update this driver.")
    else:
        # FIX: managers can only update drivers they own.
        db_driver = (
            db.query(models.Driver)
            .filter(models.Driver.id == driver_id, models.Driver.manager_id == current_user.id)
            .first()
        )
        if not db_driver:
            raise HTTPException(status_code=404, detail="Driver not found")

    for key, value in driver_data.model_dump(exclude_unset=True).items():
        if key == "username" and value is not None and db_driver.user:
            existing = (
                db.query(models.User)
                .filter(models.User.username == value, models.User.id != db_driver.user_id)
                .first()
            )
            if existing:
                raise HTTPException(status_code=400, detail="Username already exists")
            db_driver.user.username = value
        elif hasattr(db_driver, key):
            setattr(db_driver, key, value)

    db.commit()
    db.refresh(db_driver)

    # License-expiry compliance alert (<=30 days).
    if db_driver.license_expiry:
        try:
            date_str = str(db_driver.license_expiry).split("T")[0]
            if "-" in date_str:
                parts = date_str.split("-")
                if len(parts[0]) == 4:
                    exp_dt = datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
                else:
                    exp_dt = datetime.date(int(parts[2]), int(parts[1]), int(parts[0]))
                days_left = (exp_dt - datetime.date.today()).days
                if days_left <= 30:
                    alert_title = f"Driver License Expiry Warning: {db_driver.name}"
                    existing_alert = (
                        db.query(models.Alert)
                        .filter(
                            models.Alert.title == alert_title,
                            models.Alert.manager_id == db_driver.manager_id,
                            models.Alert.resolved == False,  # noqa: E712
                        )
                        .first()
                    )
                    description = (
                        f"Driver {db_driver.name}'s commercial license expires in {days_left} "
                        f"day(s) ({db_driver.license_expiry}). Please initiate renewal."
                    )
                    severity = "Critical" if days_left <= 7 else "Warning"
                    priority = "High" if days_left <= 15 else "Medium"
                    if existing_alert:
                        existing_alert.description = description
                        existing_alert.severity = severity
                        existing_alert.priority = priority
                        existing_alert.timestamp = datetime.datetime.utcnow()
                    else:
                        db.add(
                            models.Alert(
                                severity=severity,
                                priority=priority,
                                title=alert_title,
                                description=description,
                                driver_name=db_driver.name,
                                timestamp=datetime.datetime.utcnow(),
                                manager_id=db_driver.manager_id,
                            )
                        )
                    db.commit()
                    await log_automation_step(
                        db, "Compliance Warning", "License Expiry Alert",
                        f"License for {db_driver.name} expires in {days_left} days ({db_driver.license_expiry}). Alert broadcasted.",
                        manager_id=db_driver.manager_id,
                    )
                    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
        except Exception as e:  # noqa: BLE001
            print(f"[drivers] License expiry parse error: {e}")

    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    return db_driver


@router.delete("/{driver_id}")
async def delete_driver(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    db_driver = (
        db.query(models.Driver)
        .filter(models.Driver.id == driver_id, models.Driver.manager_id == current_user.id)
        .first()
    )
    if not db_driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    db.delete(db_driver)
    db.commit()
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    return {"message": "Driver deleted successfully"}
