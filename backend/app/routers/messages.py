"""Direct messaging routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user
from ..websocket import manager

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.post("", response_model=schemas.MessageResponse)
async def send_message(
    msg: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    receiver = db.query(models.User).filter(models.User.id == msg.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient not found")

    db_msg = models.Message(
        sender_id=current_user.id,
        receiver_id=msg.receiver_id,
        content=msg.content,
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)

    if current_user.role == "driver":
        driver = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        driver_name = driver.name if driver else (current_user.full_name or current_user.username)
        vehicle_no = driver.vehicle.vehicle_number if (driver and driver.vehicle) else "TRK"
        db.add(
            models.Alert(
                severity="Low",
                priority="Low",
                title=f"Driver Message from {driver_name}",
                description=f'Driver: {driver_name} | Vehicle: {vehicle_no} | Message: "{msg.content}"',
                driver_name=driver_name,
                vehicle_number=vehicle_no,
                driver_id=driver.id if driver else None,
                manager_id=msg.receiver_id,
            )
        )
        db.commit()
        await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})

    msg_data = schemas.MessageResponse.model_validate(db_msg).model_dump()
    msg_data["timestamp"] = msg_data["timestamp"].isoformat()
    await manager.broadcast({"type": "NEW_MESSAGE", "message": msg_data})
    return db_msg


@router.get("/{other_user_id}", response_model=list[schemas.MessageResponse])
def get_messages(
    other_user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    msgs = (
        db.query(models.Message)
        .filter(
            ((models.Message.sender_id == current_user.id) & (models.Message.receiver_id == other_user_id))
            | ((models.Message.sender_id == other_user_id) & (models.Message.receiver_id == current_user.id))
        )
        .order_by(models.Message.timestamp.asc())
        .all()
    )
    unread = [m for m in msgs if m.receiver_id == current_user.id and not m.is_read]
    for m in unread:
        m.is_read = True
    if unread:
        db.commit()
    return msgs
