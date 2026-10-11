"""Tenant/ownership helpers shared by the route modules.

Every manager owns the records where ``manager_id`` matches their user id.
Drivers may only touch the trips/assets assigned to them. Centralising this
here prevents the per-route omissions that previously allowed cross-tenant
access.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models


def owned_trip_or_404(db: Session, trip_id: int, current_user: models.User) -> models.Trip:
    """Return the trip if the caller may access it, otherwise 404/403."""
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    if current_user.role == "manager":
        if trip.manager_id != current_user.id:
            # Do not reveal the existence of other tenants' trips.
            raise HTTPException(status_code=404, detail="Trip not found")
    else:
        driver = (
            db.query(models.Driver)
            .filter(models.Driver.user_id == current_user.id)
            .first()
        )
        if not driver or trip.driver_id != driver.id:
            raise HTTPException(
                status_code=403, detail="You can only access trips assigned to you."
            )
    return trip


def owned_driver_or_404(db: Session, driver_id: int, current_user: models.User) -> models.Driver:
    driver = (
        db.query(models.Driver)
        .filter(
            models.Driver.id == driver_id,
            models.Driver.manager_id == current_user.id,
        )
        .first()
    )
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


def owned_vehicle_or_404(db: Session, vehicle_id: int, current_user: models.User) -> models.Vehicle:
    vehicle = (
        db.query(models.Vehicle)
        .filter(
            models.Vehicle.id == vehicle_id,
            models.Vehicle.manager_id == current_user.id,
        )
        .first()
    )
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle
