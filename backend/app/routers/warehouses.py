"""Warehouse routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user

router = APIRouter(prefix="/api/warehouses", tags=["warehouses"])


@router.get("", response_model=list[schemas.WarehouseResponse])
def get_warehouses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "driver":
        driver = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if driver:
            return (
                db.query(models.Warehouse)
                .filter(models.Warehouse.manager_id == driver.manager_id)
                .all()
            )
        return []
    return db.query(models.Warehouse).filter(models.Warehouse.manager_id == current_user.id).all()
