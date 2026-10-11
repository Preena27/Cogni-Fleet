"""Authentication and account routes."""
import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import (
    MIN_PASSWORD_LENGTH,
    create_access_token,
    get_current_user,
    get_password_hash,
    require_manager,
    verify_password,
)
from ..websocket import manager

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if user.role != "manager":
        raise HTTPException(
            status_code=400,
            detail="Only Managers can sign up. Drivers must be registered by a Manager.",
        )
    if len(user.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.",
        )

    existing = db.query(models.User).filter(models.User.username.ilike(user.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    if user.email:
        existing_email = db.query(models.User).filter(models.User.email.ilike(user.email)).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        hashed_password=get_password_hash(user.password),
        role="manager",
        company_name=user.company_name,
        phone=user.phone,
    )
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username or Email already registered")


@router.post("/drivers", response_model=schemas.DriverResponse)
async def create_driver_auth(
    req: schemas.DriverCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    existing = db.query(models.User).filter(models.User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = models.User(
        username=req.username,
        full_name=req.name,
        hashed_password=get_password_hash(req.password),
        role="driver",
        phone=req.phone,
        company_name=current_user.company_name,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    driver = models.Driver(
        user_id=new_user.id,
        manager_id=current_user.id,  # FIX: was previously omitted
        name=req.name,
        license=req.license,
        phone=req.phone,
        email=req.email,
        address=req.address,
        emergency_contact=req.emergency_contact,
        current_location=req.current_location,
        experience=req.experience,
        availability="Available",
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)

    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    return driver


@router.post("/login")
def login(form_data: schemas.LoginRequest, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not db_user or not verify_password(form_data.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if form_data.role and db_user.role != form_data.role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"User is not registered as a {form_data.role}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": db_user.username, "role": db_user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": db_user.role,
        "username": db_user.username,
        "id": db_user.id,
    }


@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_profile(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.put("/profile", response_model=schemas.UserResponse)
async def update_profile(
    profile_data: schemas.UserProfileUpdateSchema,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if profile_data.username and profile_data.username != current_user.username:
        existing = db.query(models.User).filter(models.User.username == profile_data.username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = profile_data.username

    for field in ("full_name", "email", "phone", "company_name", "timezone", "language", "profile_picture"):
        value = getattr(profile_data, field)
        if value is not None:
            setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "profile"})
    return current_user


@router.put("/username")
async def update_username(
    data: schemas.UsernameUpdateSchema,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if data.new_username == current_user.username:
        return {"message": "Username is the same"}
    existing = db.query(models.User).filter(models.User.username == data.new_username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    current_user.username = data.new_username
    db.commit()
    db.refresh(current_user)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "profile"})
    return {"message": "Username updated successfully", "new_username": current_user.username}


@router.post("/change-password")
async def change_password(
    data: schemas.PasswordUpdateSchema,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")
    if len(data.new_password.strip()) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters",
        )

    current_user.hashed_password = get_password_hash(data.new_password)
    db.add(
        models.Alert(
            severity="Low",
            priority="Information",
            title="Security Notification",
            description=f"Password for account '{current_user.username}' updated successfully.",
            timestamp=datetime.datetime.utcnow(),
            manager_id=current_user.id,
        )
    )
    db.commit()
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return {"message": "Password updated successfully"}
