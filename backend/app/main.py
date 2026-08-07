import os
import json
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import datetime

from .database import engine, Base, get_db
from . import models, schemas
from .websocket import manager
from .ai_service import ask_ai_assistant, evaluate_auto_assignment, get_full_fleet_intelligence
from .automation import (
    run_trip_assigned_pipeline,
    run_driver_response_pipeline,
    run_traffic_detected_pipeline,
    run_breakdown_pipeline,
    run_trip_completed_pipeline,
    log_automation_step
)

# Password hashing utilities
from passlib.context import CryptContext
from jose import jwt

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
SECRET_KEY = "cognifleet-super-secret-security-key"
ALGORITHM = "HS256"

# Create Database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Fleet Management System API")

# Setup CORS to allow React frontend (running on default port 5173) to talk to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- JWT helpers ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

def get_current_driver(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Not a driver")
    driver = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    return driver

# --- WebSocket Route ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We can receive ping/messages from the client if needed
            data = await websocket.receive_text()
            # Handle client heartbeats or messages
            print(f"WS Received: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WS Connection Error: {e}")
        manager.disconnect(websocket)

# --- Authentication Routes ---
@app.post("/api/auth/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if user.role != "manager":
        raise HTTPException(status_code=400, detail="Only Managers can sign up. Drivers must be registered by a Manager.")
        
    db_user = db.query(models.User).filter(models.User.username.ilike(user.username)).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    if user.email:
        db_email = db.query(models.User).filter(models.User.email.ilike(user.email)).first()
        if db_email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = get_password_hash(user.password)
    new_user = models.User(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_pwd,
        role="manager",
        company_name=user.company_name,
        phone=user.phone
    )
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username or Email already registered")

@app.post("/api/auth/drivers", response_model=schemas.DriverResponse)
async def create_driver_auth(req: schemas.DriverCreateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can register drivers.")
        
    db_user = db.query(models.User).filter(models.User.username == req.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    hashed_pwd = get_password_hash(req.password)
    new_user = models.User(
        username=req.username,
        full_name=req.name,
        hashed_password=hashed_pwd,
        role="driver"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    driver = models.Driver(
        user_id=new_user.id,
        name=req.name,
        license=req.license,
        phone=req.phone,
        email=req.email,
        address=req.address,
        emergency_contact=req.emergency_contact,
        current_location=req.current_location,
        experience=req.experience,
        availability="Available"
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    return driver

@app.post("/api/auth/login")
def login(form_data: schemas.UserCreate, db: Session = Depends(get_db)):
    # Standard username/password payload (Case-sensitive check)
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
    
    access_token = create_access_token(
        data={"sub": db_user.username, "role": db_user.role}
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": db_user.role,
        "username": db_user.username,
        "id": db_user.id
    }

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_current_user_profile(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.put("/api/auth/profile", response_model=schemas.UserResponse)
async def update_profile(profile_data: schemas.UserProfileUpdateSchema, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if profile_data.username and profile_data.username != current_user.username:
        existing = db.query(models.User).filter(models.User.username == profile_data.username).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = profile_data.username

    if profile_data.full_name is not None:
        current_user.full_name = profile_data.full_name
    if profile_data.email is not None:
        current_user.email = profile_data.email
    if profile_data.phone is not None:
        current_user.phone = profile_data.phone
    if profile_data.company_name is not None:
        current_user.company_name = profile_data.company_name
    if profile_data.timezone is not None:
        current_user.timezone = profile_data.timezone
    if profile_data.language is not None:
        current_user.language = profile_data.language
    if profile_data.profile_picture is not None:
        current_user.profile_picture = profile_data.profile_picture

    db.commit()
    db.refresh(current_user)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "profile"})
    return current_user

@app.put("/api/auth/username")
async def update_username(data: schemas.UsernameUpdateSchema, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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

@app.get("/api/settings", response_model=schemas.UserSettingsResponse)
def get_user_settings(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = models.UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

@app.put("/api/settings", response_model=schemas.UserSettingsResponse)
async def update_user_settings(data: schemas.UserSettingsUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    settings = db.query(models.UserSettings).filter(models.UserSettings.user_id == current_user.id).first()
    if not settings:
        settings = models.UserSettings(user_id=current_user.id)
        db.add(settings)
        
    for key, value in data.dict(exclude_unset=True).items():
        setattr(settings, key, value)
        
    db.commit()
    db.refresh(settings)
    return settings


@app.post("/api/auth/change-password")
async def change_password(data: schemas.PasswordUpdateSchema, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    if data.new_password != data.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match")
    if len(data.new_password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    current_user.hashed_password = get_password_hash(data.new_password)
    
    # Create notification alert
    alert = models.Alert(
        severity="Low",
        priority="Information",
        title="Security Notification",
        description=f"Password for account '{current_user.username}' updated successfully.",
        timestamp=datetime.datetime.utcnow(),
        manager_id=current_user.id
    )
    db.add(alert)
    db.commit()

    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return {"message": "Password updated successfully"}

@app.post("/api/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    alert.resolved = True
    db.commit()
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return {"message": "Alert acknowledged successfully"}

# --- Vehicles Router ---
@app.get("/api/vehicles", response_model=List[schemas.VehicleResponse])
def get_vehicles(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "driver":
        drv = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if drv and drv.vehicle_id:
            return db.query(models.Vehicle).filter(models.Vehicle.id == drv.vehicle_id).all()
        return []
    return db.query(models.Vehicle).filter(models.Vehicle.manager_id == current_user.id).all()

@app.post("/api/vehicles", response_model=schemas.VehicleResponse)
async def create_vehicle(vehicle: schemas.VehicleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can manage vehicles.")
    db_vehicle = models.Vehicle(**vehicle.dict(), manager_id=current_user.id)
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return db_vehicle

@app.put("/api/vehicles/{vehicle_id}", response_model=schemas.VehicleResponse)
async def update_vehicle(vehicle_id: int, vehicle_data: schemas.VehicleUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can manage vehicles.")
    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id, models.Vehicle.manager_id == current_user.id).first()
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_data = vehicle_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_vehicle, key, value)
    
    if "odometer" in update_data or "last_service_odometer" in update_data or "service_interval" in update_data:
        db_vehicle.next_service_due = (db_vehicle.last_service_odometer or 0) + (db_vehicle.service_interval or 10000.0)
    
    db.commit()
    db.refresh(db_vehicle)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return db_vehicle

@app.post("/api/vehicles/{vehicle_id}/refuel", response_model=schemas.VehicleResponse)
async def refuel_vehicle(vehicle_id: int, req: schemas.RefuelRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can manage vehicles.")
    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id, models.Vehicle.manager_id == current_user.id).first()
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
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

@app.post("/api/vehicles/{vehicle_id}/maintenance/complete", response_model=schemas.VehicleResponse)
async def complete_maintenance(vehicle_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can manage vehicles.")
    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id, models.Vehicle.manager_id == current_user.id).first()
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    db_vehicle.last_service_odometer = db_vehicle.odometer
    db_vehicle.next_service_due = db_vehicle.odometer + (db_vehicle.service_interval or 10000.0)
    db_vehicle.availability = "Available"
    db_vehicle.health = 100
    db_vehicle.last_service_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    
    # Resolve any unresolved maintenance alerts for this vehicle
    maintenance_alerts = db.query(models.Alert).filter(
        models.Alert.vehicle_number == db_vehicle.vehicle_number,
        models.Alert.resolved == False,
        models.Alert.title.like("%Maintenance%")
    ).all()
    for alert in maintenance_alerts:
        alert.resolved = True

    db.commit()
    db.refresh(db_vehicle)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return db_vehicle

@app.delete("/api/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can manage vehicles.")
    db_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id, models.Vehicle.manager_id == current_user.id).first()
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(db_vehicle)
    db.commit()
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return {"message": "Vehicle deleted successfully"}

# --- Drivers Router ---
@app.get("/api/drivers", response_model=List[schemas.DriverResponse])
def get_drivers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "driver":
        return db.query(models.Driver).filter(models.Driver.user_id == current_user.id).all()
    return db.query(models.Driver).all()

@app.post("/api/drivers", response_model=schemas.DriverResponse)
async def create_driver(driver: schemas.DriverCreateRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can manage drivers.")
    
    # Check if username exists
    existing_user = db.query(models.User).filter(models.User.username == driver.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken.")
        
    # Create User account for Driver
    hashed_pwd = get_password_hash(driver.password)
    db_user = models.User(
        username=driver.username,
        hashed_password=hashed_pwd,
        role="driver",
        phone=driver.phone,
        company_name=current_user.company_name
    )
    db.add(db_user)
    db.flush()
    
    # Create Driver profile linked to User
    db_driver = models.Driver(
        user_id=db_user.id,
        manager_id=current_user.id,
        name=driver.name,
        license=driver.license,
        phone=driver.phone,
        experience=5,
        availability="Available",
        working_hours=0.0,
        rating=5.0,
        violations=0,
        health="Good",
        performance=100.0
    )
    db.add(db_driver)
    db.commit()
    db.refresh(db_driver)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    return db_driver

@app.put("/api/drivers/{driver_id}", response_model=schemas.DriverResponse)
async def update_driver(driver_id: int, driver_data: schemas.DriverUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "driver":
        db_driver = db.query(models.Driver).filter(models.Driver.id == driver_id, models.Driver.user_id == current_user.id).first()
        if not db_driver:
            raise HTTPException(status_code=403, detail="Not authorized to update this driver.")
    elif current_user.role == "manager":
        db_driver = db.query(models.Driver).filter(models.Driver.id == driver_id).first()
    else:
        raise HTTPException(status_code=403, detail="Only Managers or the Driver themselves can update driver status.")
        
    if not db_driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    for key, value in driver_data.dict(exclude_unset=True).items():
        if key == "username" and value is not None and db_driver.user:
            existing = db.query(models.User).filter(models.User.username == value, models.User.id != db_driver.user_id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username already exists")
            db_driver.user.username = value
        elif hasattr(db_driver, key):
            setattr(db_driver, key, value)
            
    db.commit()
    db.refresh(db_driver)

    # Trigger Automated Notification Alert & AI Proactive Warning if License Expiry <= 30 Days
    if db_driver.license_expiry:
        try:
            date_str = str(db_driver.license_expiry).split("T")[0]
            if "-" in date_str:
                parts = date_str.split("-")
                exp_dt = datetime.date(int(parts[0]), int(parts[1]), int(parts[2])) if len(parts[0]) == 4 else datetime.date(int(parts[2]), int(parts[1]), int(parts[0]))
                days_left = (exp_dt - datetime.date.today()).days
                if days_left <= 30:
                    alert_title = f"Driver License Expiry Warning: {db_driver.name}"
                    existing_alert = db.query(models.Alert).filter(models.Alert.title == alert_title, models.Alert.resolved == False).first()
                    if existing_alert:
                        existing_alert.description = f"Driver {db_driver.name}'s commercial license expires in {days_left} day(s) ({db_driver.license_expiry}). Please initiate renewal."
                        existing_alert.severity = "Critical" if days_left <= 7 else "Warning"
                        existing_alert.priority = "High" if days_left <= 15 else "Medium"
                        existing_alert.timestamp = datetime.datetime.utcnow()
                    else:
                        new_alert = models.Alert(
                            severity="Critical" if days_left <= 7 else "Warning",
                            priority="High" if days_left <= 15 else "Medium",
                            title=alert_title,
                            description=f"Driver {db_driver.name}'s commercial license expires in {days_left} day(s) ({db_driver.license_expiry}). Please initiate renewal.",
                            driver_name=db_driver.name,
                            timestamp=datetime.datetime.utcnow()
                        )
                        db.add(new_alert)
                    db.commit()
                    await log_automation_step(db, "Compliance Warning", "License Expiry Alert", f"License for {db_driver.name} expires in {days_left} days ({db_driver.license_expiry}). Alert broadcasted.")
                    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
        except Exception as e:
            print(f"License expiry parse error: {e}")

    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    return db_driver

@app.delete("/api/drivers/{driver_id}")
async def delete_driver(driver_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can manage drivers.")
    db_driver = db.query(models.Driver).filter(models.Driver.id == driver_id, models.Driver.manager_id == current_user.id).first()
    if not db_driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    db.delete(db_driver)
    db.commit()
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    return {"message": "Driver deleted successfully"}

# --- Trips / Loads Router ---
@app.get("/api/trips", response_model=List[schemas.TripResponse])
def get_trips(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "driver":
        drv = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if drv:
            return db.query(models.Trip).filter(models.Trip.driver_id == drv.id).all()
        return []
    return db.query(models.Trip).filter(models.Trip.manager_id == current_user.id).all()

@app.get("/api/trips/driver/{username}", response_model=List[schemas.TripResponse])
def get_driver_trips(username: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can view driver trip assignments.")
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not user.driver_profile:
        return []
    driver_id = user.driver_profile.id
    return db.query(models.Trip).filter(models.Trip.driver_id == driver_id, models.Trip.manager_id == current_user.id).all()

@app.post("/api/trips", response_model=schemas.TripResponse)
async def create_trip(trip: schemas.TripCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can create trips.")
    # Provide simple defaults for UI maps
    route_coords = [
        [37.7749, -122.4194],  # SF
        [34.0522, -118.2437]   # LA
    ]
    
    # Pre-populate dynamic variables for visualization
    trip_dict = trip.dict()
    if not trip_dict.get("route_coordinates"):
        trip_dict["route_coordinates"] = json.dumps(route_coords)
    trip_dict["manager_id"] = current_user.id
    if not trip_dict.get("stops"):
        trip_dict["stops"] = json.dumps([
            {"location": trip.pickup, "type": "Pickup", "status": "Pending"},
            {"location": trip.destination, "type": "Delivery", "status": "Pending"}
        ])
    if not trip_dict.get("history"):
        trip_dict["history"] = json.dumps([
            {"status": "Unassigned", "timestamp": datetime.datetime.utcnow().isoformat(), "notes": "Load created."}
        ])
    if not trip_dict.get("revenue"):
        weight_val = trip.weight if trip.weight is not None else 0.0
        trip_dict["revenue"] = round(weight_val * 450 + 800, 2)
    if not trip_dict.get("fuel_cost"):
        trip_dict["fuel_cost"] = round(trip_dict["revenue"] * 0.22, 2)
    if not trip_dict.get("distance"):
        trip_dict["distance"] = 620.0  # SF to LA approx
    if not trip_dict.get("remaining_distance"):
        trip_dict["remaining_distance"] = 620.0

    db_trip = models.Trip(**trip_dict)
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)

    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    
    # Trigger automation pipeline for new load creation
    await log_automation_step(db, "Load Created", "Database Update", f"New Load #{db_trip.id} registered for customer '{db_trip.customer}'. Weight: {db_trip.weight} tons.")
    
    return db_trip

@app.post("/api/trips/bulk")
async def bulk_create_trips(trips: List[schemas.TripBulkImportItem], db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can import loads.")
    
    success_count = 0
    skipped_count = 0
    failed_count = 0
    
    route_coords = [
        [37.7749, -122.4194],  # SF
        [34.0522, -118.2437]   # LA
    ]
    
    for item in trips:
        try:
            # Check duplicate load ID in DB
            if item.id is not None:
                existing_by_id = db.query(models.Trip).filter(models.Trip.id == item.id).first()
                if existing_by_id:
                    skipped_count += 1
                    continue
            
            # Check duplicate by pickup, destination, customer
            existing_by_fields = db.query(models.Trip).filter(
                models.Trip.customer == item.customer,
                models.Trip.pickup == item.pickup,
                models.Trip.destination == item.destination,
                models.Trip.manager_id == current_user.id
            ).first()
            
            if existing_by_fields:
                skipped_count += 1
                continue
                
            trip_dict = item.dict()
            trip_dict["manager_id"] = current_user.id
            
            if not trip_dict.get("route_coordinates"):
                trip_dict["route_coordinates"] = json.dumps(route_coords)
            if not trip_dict.get("stops"):
                trip_dict["stops"] = json.dumps([
                    {"location": item.pickup, "type": "Pickup", "status": "Pending"},
                    {"location": item.destination, "type": "Delivery", "status": "Pending"}
                ])
            if not trip_dict.get("history"):
                trip_dict["history"] = json.dumps([
                    {"status": "Unassigned", "timestamp": datetime.datetime.utcnow().isoformat(), "notes": "Load imported via CSV."}
                ])
            if not trip_dict.get("revenue"):
                weight_val = item.weight if item.weight is not None else 0.0
                trip_dict["revenue"] = round(weight_val * 450 + 800, 2)
            if not trip_dict.get("fuel_cost"):
                trip_dict["fuel_cost"] = round(trip_dict["revenue"] * 0.22, 2)
            if not trip_dict.get("distance"):
                trip_dict["distance"] = 620.0
            if not trip_dict.get("remaining_distance"):
                trip_dict["remaining_distance"] = 620.0
                
            db_trip = models.Trip(**trip_dict)
            db.add(db_trip)
            success_count += 1
        except Exception as e:
            print(f"Error importing row: {e}")
            failed_count += 1
            
    if success_count > 0:
        db.commit()
        await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
        
    return {
        "success": success_count,
        "skipped": skipped_count,
        "failed": failed_count
    }

@app.post("/api/trips/{trip_id}/manual-assign", response_model=schemas.TripResponse)
async def manual_assign_trip(trip_id: int, payload: dict, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can manually assign trips.")
        
    db_trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not db_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    driver_id = payload.get("driver_id")
    vehicle_id = payload.get("vehicle_id")
    
    driver = db.query(models.Driver).filter(models.Driver.id == driver_id).first()
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    
    if not driver or not vehicle:
        raise HTTPException(status_code=400, detail="Invalid driver or vehicle selection")
        
    db_trip.driver_id = driver.id
    db_trip.vehicle_id = vehicle.id
    db_trip.status = "Assigned"
    db_trip.assignment_reason = "Manually Assigned by Dispatch Manager"
    db_trip.assignment_confidence = 100.0
    db_trip.assignment_time = datetime.datetime.utcnow()
    
    driver.availability = "On Duty"
    vehicle.availability = "On Duty"
    vehicle.current_trip_id = db_trip.id
    
    history = json.loads(db_trip.history) if db_trip.history else []
    history.append({
        "status": "Assigned",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": f"Manually assigned to Driver {driver.name} and Vehicle {vehicle.vehicle_number}."
    })
    db_trip.history = json.dumps(history)
    
    db.commit()
    db.refresh(db_trip)
    
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    
    await log_automation_step(db, "Manual Assignment", "Database Update", f"Trip #{db_trip.id} manually assigned to Driver {driver.name} and Vehicle {vehicle.vehicle_number}.")
    return db_trip

@app.post("/api/trips/{trip_id}/auto-assign", response_model=schemas.TripResponse)
async def auto_assign_trip(trip_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can trigger auto assignment.")
        
    db_trip = db.query(models.Trip).filter(models.Trip.id == trip_id, models.Trip.manager_id == current_user.id).first()
    if not db_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    avail_drivers = db.query(models.Driver).filter(models.Driver.availability == "Available", models.Driver.manager_id == current_user.id).all()
    avail_vehicles = db.query(models.Vehicle).filter(models.Vehicle.availability == "Available", models.Vehicle.manager_id == current_user.id).all()
    
    webhook_payload = {
        "trip_id": str(db_trip.id),
        "pickup": db_trip.pickup,
        "destination": db_trip.destination,
        "priority": db_trip.priority,
        "available_drivers": [
            {"id": str(d.id), "name": d.name, "experience": d.experience, "rating": d.rating} for d in avail_drivers
        ],
        "available_vehicles": [
            {"id": str(v.id), "vehicle_number": v.vehicle_number, "capacity": v.capacity, "type": v.type} for v in avail_vehicles
        ]
    }
    
    import requests
    driver_id = None
    vehicle_id = None
    reason = "Auto assignment decision from SNS Workbench."
    confidence = 100.0
    
    try:
        response = requests.post(
            "https://api.agents.snsihub.ai/webhook-test/fleet/trip",
            json=webhook_payload,
            timeout=8.0
        )
        if response.status_code == 200:
            res_data = response.json()
            assignment = None
            if "output" in res_data and isinstance(res_data["output"], dict):
                output_data = res_data["output"]
                if "items" in output_data and len(output_data["items"]) > 0:
                    item_json = output_data["items"][0].get("json", {})
                    if "driver_id" in item_json or "vehicle_id" in item_json:
                        assignment = item_json
            if not assignment and ("driver_id" in res_data or "vehicle_id" in res_data):
                assignment = res_data
                
            if assignment:
                driver_id = assignment.get("driver_id")
                vehicle_id = assignment.get("vehicle_id")
                reason = assignment.get("reason", "SNS Workbench Auto-Assign Algorithm recommendation.")
                try:
                    confidence = float(assignment.get("confidence", 95.0))
                except:
                    confidence = 95.0
    except Exception as e:
        print(f"WEBHOOK ERROR during auto-assign: {e}")
        
    final_driver = None
    final_vehicle = None
    
    if driver_id:
        if isinstance(driver_id, str) and not driver_id.isdigit():
            final_driver = db.query(models.Driver).filter(models.Driver.name == driver_id).first()
        else:
            final_driver = db.query(models.Driver).filter(models.Driver.id == int(driver_id)).first()
            
    if vehicle_id:
        if isinstance(vehicle_id, str) and not vehicle_id.isdigit():
            final_vehicle = db.query(models.Vehicle).filter(models.Vehicle.vehicle_number == vehicle_id).first()
        else:
            final_vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == int(vehicle_id)).first()
            
    if not final_driver or not final_vehicle:
        final_driver = db.query(models.Driver).filter(models.Driver.availability == "Available").first()
        final_vehicle = db.query(models.Vehicle).filter(models.Vehicle.availability == "Available").first()
        reason = "System Fallback Auto-Assignment (No valid agent response)."
        confidence = 70.0
        
    if final_driver and final_vehicle:
        db_trip.driver_id = final_driver.id
        db_trip.vehicle_id = final_vehicle.id
        db_trip.status = "Assigned"
        db_trip.assignment_reason = reason
        db_trip.assignment_confidence = confidence
        db_trip.assignment_time = datetime.datetime.utcnow()
        
        final_driver.availability = "On Duty"
        final_vehicle.availability = "On Duty"
        final_vehicle.current_trip_id = db_trip.id
        
        history = json.loads(db_trip.history) if db_trip.history else []
        history.append({
            "status": "Assigned",
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "notes": f"Auto-assigned to Driver {final_driver.name} and Vehicle {final_vehicle.vehicle_number}. Reason: {reason} (Confidence: {confidence}%)."
        })
        db_trip.history = json.dumps(history)
        
        db.commit()
        db.refresh(db_trip)
        
        await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
        
        await log_automation_step(db, "Auto Assignment", "Agent Decision", f"Trip #{db_trip.id} auto-assigned to Driver {final_driver.name} and Vehicle {final_vehicle.vehicle_number} (Conf: {confidence}%).")
        return db_trip
    else:
        raise HTTPException(status_code=400, detail="No available drivers or vehicles to complete assignment.")

@app.put("/api/trips/{trip_id}", response_model=schemas.TripResponse)
async def update_trip(trip_id: int, trip_data: schemas.TripBase, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not db_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    if current_user.role == "driver":
        drv = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if not drv or db_trip.driver_id != drv.id:
            raise HTTPException(status_code=403, detail="You can only update trips assigned to you.")

    old_status = db_trip.status
    old_driver = db_trip.driver_id

    for key, value in trip_data.dict().items():
        setattr(db_trip, key, value)
        
    db.commit()
    db.refresh(db_trip)

    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})

    # Check for triggered pipelines on state updates
    if db_trip.driver_id and db_trip.driver_id != old_driver:
        # Assigned driver
        await run_trip_assigned_pipeline(db_trip.id, db)
    
    if db_trip.status != old_status:
        # Logging transition
        history = json.loads(db_trip.history or "[]")
        history.append({
            "status": db_trip.status,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "notes": f"Status updated from {old_status} to {db_trip.status}."
        })
        db_trip.history = json.dumps(history)
        db.commit()
        
        # Simulating n8n actions based on status transitions
        if db_trip.status == "In Transit":
            await log_automation_step(db, "Trip In Transit", "GPS Tracking Activated", f"Trip #{db_trip.id} is now live on GPS mapping. Dispatch center initialized.")
        elif db_trip.status == "Completed":
            await run_trip_completed_pipeline(db_trip.id, db)
        elif db_trip.status == "Problem":
            await log_automation_step(db, "Trip Flagged Problem", "Alert Triggered", f"Trip #{db_trip.id} has manual problem flag applied.")

    return db_trip

@app.delete("/api/trips/{trip_id}")
async def delete_trip(trip_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can delete trips.")
    db_trip = db.query(models.Trip).filter(models.Trip.id == trip_id, models.Trip.manager_id == current_user.id).first()
    if not db_trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if db_trip.status not in ("Unassigned", "Draft"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete load #{trip_id} because it is currently '{db_trip.status}' (assigned or in progress)."
        )
    db.delete(db_trip)
    db.commit()
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    return {"message": "Trip deleted successfully"}

@app.post("/api/trips/{trip_id}/accept", response_model=schemas.TripResponse)
async def accept_trip(trip_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can accept loads.")
    db_trip = db.query(models.Trip).filter(models.Trip.id == trip_id, models.Trip.manager_id == current_user.id).first()
    if not db_trip:
        raise HTTPException(status_code=404, detail="Load not found")
        
    db_trip.status = "Accepted"
    db.commit()
    db.refresh(db_trip)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    return db_trip

# --- Driver Actions (Mobile Simulation Interface) ---
@app.post("/api/trips/{trip_id}/accept")
async def driver_accept_trip(trip_id: int, accept: bool, reason: Optional[str] = None, db: Session = Depends(get_db)):
    await run_driver_response_pipeline(trip_id, accept, reason, db)
    return {"status": "success", "accepted": accept}

@app.post("/api/trips/{trip_id}/simulate-event")
async def simulate_trip_event(trip_id: int, event_type: str, db: Session = Depends(get_db)):
    """Simulates background automation events: traffic, breakdown, rerouting, or completing."""
    if event_type == "traffic":
        await run_traffic_detected_pipeline(trip_id, db)
    elif event_type == "breakdown":
        await run_breakdown_pipeline(trip_id, db)
    elif event_type == "complete":
        await run_trip_completed_pipeline(trip_id, db)
    else:
        raise HTTPException(status_code=400, detail="Invalid event type")
    return {"status": "success", "event": event_type}

# --- Driver Specialized Endpoints ---
@app.post("/api/trips/{trip_id}/start")
async def start_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    trip.status = "In Transit"
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    if driver:
        driver.availability = "On Duty"
    if vehicle:
        vehicle.availability = "In Transit"
        vehicle.gps = "Online"
        vehicle.speed = 55.0
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "In Transit",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": "Trip started. Driver departed warehouse dock."
    })
    trip.history = json.dumps(history)
    db.commit()
    await log_automation_step(db, "Trip Started", "GPS Tracking Activated", f"Trip #{trip_id} started. GPS tracking initialized. Driver set to 'Driving'.")
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return {"status": "success"}

@app.post("/api/trips/{trip_id}/pause")
async def pause_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    if driver:
        driver.availability = "Off Duty"
    if vehicle:
        vehicle.speed = 0.0
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "Stopped",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": "Transit paused. Driver registered rest stop."
    })
    trip.history = json.dumps(history)
    db.commit()
    await log_automation_step(db, "Trip Paused", "Asset Stopped", f"Trip #{trip_id} paused. Vehicle speed set to 0.0.")
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return {"status": "success"}

@app.post("/api/trips/{trip_id}/resume")
async def resume_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    if driver:
        driver.availability = "Driving"
    if vehicle:
        vehicle.speed = 55.0
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "In Transit",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": "Transit resumed. Driver back behind the wheel."
    })
    trip.history = json.dumps(history)
    db.commit()
    await log_automation_step(db, "Trip Resumed", "Asset Moving", f"Trip #{trip_id} resumed. Vehicle speed restored to 55.0.")
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return {"status": "success"}

@app.post("/api/trips/{trip_id}/stopped-reason")
async def stopped_reason(trip_id: int, payload: dict, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    reason = payload.get("reason", "Waiting")
    location = payload.get("location", "Unknown Location")
    duration = payload.get("duration", 5.0)
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    driver_name = driver.name if driver else "Driver"
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    vehicle_no = vehicle.vehicle_number if vehicle else "TRK"
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "Stopped",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": f"Stopped at {location} for {duration} mins. Reason: {reason}."
    })
    trip.history = json.dumps(history)
    alert = models.Alert(
        severity="Warning",
        title="Vehicle Stopped Alert",
        description=f"Driver {driver_name} (Vehicle {vehicle_no}) stopped at {location}. Reason: {reason}. Duration: {duration} mins.",
        driver_name=driver_name,
        vehicle_number=vehicle_no,
        location=location,
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id
    )
    db.add(alert)
    db.commit()
    await log_automation_step(db, "Stop Registered", "Incident Log", f"Trip #{trip_id} registered stop reason: '{reason}' at {location}.")
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return {"status": "success"}

@app.post("/api/trips/{trip_id}/report-issue")
async def report_issue(trip_id: int, payload: dict, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    issue_type = payload.get("issue_type", "Problem")
    description = payload.get("description", "")
    priority = payload.get("priority", "High")
    gps = payload.get("gps", "Unknown")
    
    # Enforce Critical priority for major safety/vehicle failures
    if issue_type in ["Accident", "Vehicle Breakdown", "Medical Emergency", "Engine Problem"]:
        priority = "Critical"
    
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    driver_name = driver.name if driver else "Driver"
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    vehicle_no = vehicle.vehicle_number if vehicle else "TRK"
    
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "Problem",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": f"Incident reported: {issue_type}. Priority: {priority.upper()}. Details: {description}."
    })
    trip.history = json.dumps(history)
    trip.status = "Problem"
    if vehicle and issue_type in ["Vehicle Breakdown", "Engine Problem", "Flat Tyre", "Accident"]:
        vehicle.availability = "Maintenance"
        vehicle.speed = 0.0
        
    time_str = datetime.datetime.utcnow().strftime("%I:%M %p")
    location_str = gps if (gps and gps != "Unknown") else (vehicle.current_location if vehicle else f"{trip.pickup} -> {trip.destination}")
    
    title_text = f"🔴 CRITICAL - {issue_type.upper()}" if priority.upper() == "CRITICAL" else f"Incident Reported: {issue_type}"
    desc_text = f"Driver: {driver_name} | Vehicle: {vehicle_no} | Trip #{trip_id}: {trip.pickup} -> {trip.destination} | Reason: {description or issue_type} | Location: {location_str} | Time: {time_str} | Priority: {priority.upper()}"
    
    alert = models.Alert(
        severity=priority,
        priority=priority,
        title=title_text,
        description=desc_text,
        driver_name=driver_name,
        vehicle_number=vehicle_no,
        location=location_str,
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id,
        driver_id=trip.driver_id,
        manager_id=trip.manager_id
    )
    db.add(alert)
    db.commit()
    
    await log_automation_step(db, "Issue Filed", "Incident Log", f"Trip #{trip_id} flagged with problem '{issue_type}' (Priority: {priority.upper()}).", manager_id=trip.manager_id, driver_id=trip.driver_id, vehicle_number=vehicle_no)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    return {"status": "success"}

@app.post("/api/trips/{trip_id}/sos")
async def trigger_sos(trip_id: int, payload: dict, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    gps = payload.get("gps", "Unknown")
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    driver_name = driver.name if driver else "Driver"
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    vehicle_no = vehicle.vehicle_number if vehicle else "TRK"
    trip.status = "Problem"
    if vehicle:
        vehicle.speed = 0.0
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "Problem",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": f"EMERGENCY SOS TRIGGERED from coordinates: {gps}."
    })
    trip.history = json.dumps(history)
    alert = models.Alert(
        severity="Critical",
        title="EMERGENCY SOS",
        description=f"Driver {driver_name} (Vehicle {vehicle_no}) triggered SOS from coordinates {gps}!",
        driver_name=driver_name,
        vehicle_number=vehicle_no,
        location=gps,
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id
    )
    db.add(alert)
    db.commit()
    await log_automation_step(db, "EMERGENCY SOS", "Critical Alarm", f"CRITICAL SOS alarm activated for Trip #{trip_id} at location: {gps}.", "Failed")
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    return {"status": "success"}

@app.post("/api/trips/{trip_id}/end")
async def end_trip(trip_id: int, payload: dict, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    pod = db.query(models.ProofOfDelivery).filter(models.ProofOfDelivery.trip_id == trip_id).first()
    if not pod or not pod.signature_path or not pod.photo_path:
        raise HTTPException(status_code=400, detail="Cannot end trip: Proof of Delivery is incomplete")
    trip.trip_duration = payload.get("duration", 240.0)
    trip.average_speed = payload.get("average_speed", 52.5)
    trip.idle_time = payload.get("idle_time", 15.0)
    trip.route_taken = json.dumps(payload.get("route_taken", []))
    trip.remaining_distance = 0.0
    trip.status = "Completed"
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first()
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first()
    if driver:
        driver.availability = "Available"
        driver.working_hours = round(driver.working_hours + (trip.trip_duration / 60.0), 1)
    if vehicle:
        vehicle.availability = "Available"
        vehicle.current_trip_id = None
        vehicle.speed = 0.0
        vehicle.mileage = round(vehicle.mileage + trip.distance, 1)
    history = json.loads(trip.history or "[]")
    history.append({
        "status": "Completed",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "notes": f"Trip finished successfully. Duration: {trip.trip_duration} mins. Distance: {trip.distance} km."
    })
    trip.history = json.dumps(history)
    stops = json.loads(trip.stops or "[]")
    for stop in stops:
        stop["status"] = "Completed"
    trip.stops = json.dumps(stops)
    db.commit()
    from .automation import run_trip_completed_pipeline
    await run_trip_completed_pipeline(trip_id, db)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "pods"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "invoices"})
    return {"status": "success"}

@app.post("/api/trips/{trip_id}/progress")
async def progress_trip(trip_id: int, payload: dict, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    distance_delta = float(payload.get("distance_delta", 0.0))
    lat = payload.get("lat")
    lng = payload.get("lng")
    speed = payload.get("speed", 55.0)
    current_location = payload.get("current_location")
    
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == trip.vehicle_id).first() if trip.vehicle_id else None
    driver = db.query(models.Driver).filter(models.Driver.id == trip.driver_id).first() if trip.driver_id else None
    
    is_idle = payload.get("is_idle", False)
    idle_duration = float(payload.get("idle_duration", 0.0)) # in seconds
    idle_reason = payload.get("idle_reason", "Stopped / Break")
    trigger_5min_alert = payload.get("trigger_5min_alert", False)
    
    if is_idle and vehicle:
        vehicle.speed = 0.0
        vehicle.availability = "IDLE"
        if driver:
            driver.availability = "On Duty"
        
        trip.idle_time = round((trip.idle_time or 0.0) + (idle_duration / 60.0), 2)
        
        # 5-minute idle alert check
        if trigger_5min_alert or idle_duration >= 300.0:
            driver_name = driver.name if driver else "Driver"
            vehicle_no = vehicle.vehicle_number if vehicle else "TRK"
            duration_mins = round(idle_duration / 60.0, 1)
            location_str = current_location or f"GPS ({lat or 13.08}, {lng or 80.27})"
            
            # Check if recent alert already exists
            existing_alert = db.query(models.Alert).filter(
                models.Alert.trip_id == trip_id,
                models.Alert.title.like("%Excessive Vehicle Idle Alert%")
            ).first()
            
            if not existing_alert:
                alert = models.Alert(
                    severity="Warning",
                    priority="Warning",
                    title="Excessive Vehicle Idle Alert (>5 mins)",
                    description=f"Driver {driver_name} (Vehicle {vehicle_no}) idle for {duration_mins} mins during Trip #{trip_id}. Reason: {idle_reason}. Location: {location_str}.",
                    driver_name=driver_name,
                    vehicle_number=vehicle_no,
                    location=location_str,
                    timestamp=datetime.datetime.utcnow(),
                    trip_id=trip_id,
                    manager_id=trip.manager_id
                )
                db.add(alert)
                db.commit()
                await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
                
        db.commit()
        await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
        
    elif distance_delta > 0 and vehicle:
        mileage_kml = vehicle.mileage_kml if (vehicle.mileage_kml and vehicle.mileage_kml > 0) else 10.0
        fuel_consumed = distance_delta / mileage_kml
        
        current_f = vehicle.current_fuel if vehicle.current_fuel is not None else (vehicle.fuel_capacity or 100.0)
        vehicle.current_fuel = max(0.0, current_f - fuel_consumed)
        
        capacity = vehicle.fuel_capacity or 100.0
        if capacity > 0:
            vehicle.fuel = int((vehicle.current_fuel / capacity) * 100)
            
        vehicle.odometer = (vehicle.odometer or 0.0) + distance_delta
        vehicle.mileage = (vehicle.mileage or 0.0) + distance_delta
        if lat is not None and lng is not None:
            vehicle.latitude = lat
            vehicle.longitude = lng
        if current_location:
            vehicle.current_location = current_location
        vehicle.speed = speed
        vehicle.gps = "Online"
        vehicle.availability = "In Transit"
        
        trip.remaining_distance = max(0.0, (trip.remaining_distance if trip.remaining_distance is not None else trip.distance) - distance_delta)
        trip.fuel_used = (trip.fuel_used or 0.0) + fuel_consumed
        
        if driver:
            driver.availability = "On Duty"
            driver.working_hours = round((driver.working_hours or 0.0) + (distance_delta / speed if speed > 0 else 0.05), 2)
            if current_location:
                driver.current_location = current_location
            
        db.commit()
        
        await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
        await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
        
    return {
        "status": "success",
        "remaining_distance": trip.remaining_distance,
        "current_fuel": vehicle.current_fuel if vehicle else None,
        "fuel_percentage": vehicle.fuel if vehicle else None
    }

# --- AI Endpoints ---
@app.get("/api/ai/intelligence")
def get_ai_intelligence(db: Session = Depends(get_db)):
    return get_full_fleet_intelligence(db)

@app.post("/api/ai/execute-recommendation")
async def execute_ai_recommendation(payload: dict, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can execute AI recommendations.")

    action_type = payload.get("action_type")
    action_data = payload.get("action_payload", {})

    if action_type == "assign_load":
        trip_id = action_data.get("trip_id")
        driver_id = action_data.get("driver_id")
        vehicle_id = action_data.get("vehicle_id")
        
        trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
        driver = db.query(models.Driver).filter(models.Driver.id == driver_id).first()
        vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
        
        if trip and driver and vehicle:
            trip.driver_id = driver.id
            trip.vehicle_id = vehicle.id
            trip.status = "Assigned"
            trip.assignment_reason = "Recommended by CogniFleet Proactive AI Engine"
            trip.assignment_confidence = 96.0
            trip.assignment_time = datetime.datetime.utcnow()
            db.commit()
            
            await run_trip_assigned_pipeline(trip.id, db)
            return {"message": f"Successfully assigned Load #{trip_id} to Driver {driver.name} & Vehicle {vehicle.vehicle_number}."}

    elif action_type == "schedule_maintenance":
        vehicle_id = action_data.get("vehicle_id")
        vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
        if vehicle:
            vehicle.availability = "Maintenance"
            db.commit()
            
            alert = models.Alert(
                severity="Critical",
                priority="Critical",
                title=f"Maintenance Scheduled: {vehicle.vehicle_number}",
                description=f"Maintenance ticket created via AI Advisor 1-Click Action for {vehicle.vehicle_number}.",
                vehicle_number=vehicle.vehicle_number,
                timestamp=datetime.datetime.utcnow()
            )
            db.add(alert)
            db.commit()
            await log_automation_step(db, "AI Action", "Schedule Maintenance", f"Scheduled maintenance for vehicle {vehicle.vehicle_number} via AI Proactive Engine.")
            await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
            await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
            return {"message": f"Service inspection scheduled for Vehicle {vehicle.vehicle_number}."}

    elif action_type == "renew_license":
        driver_id = action_data.get("driver_id")
        driver = db.query(models.Driver).filter(models.Driver.id == driver_id).first()
        if driver:
            await log_automation_step(db, "AI Action", "License Renewal", f"Initiated commercial license renewal workflow for Driver {driver.name}.")
            await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
            return {"message": f"License renewal request generated for Driver {driver.name}."}

    return {"message": "AI recommendation recorded successfully."}

@app.post("/api/ai-assistant")
def ai_assistant_chat(payload: schemas.AIQuery, db: Session = Depends(get_db)):
    response = ask_ai_assistant(payload.query, db, payload.conversation)
    return {"response": response}

@app.get("/api/trips/{trip_id}/ai-assign")
def ai_auto_assign(trip_id: int, db: Session = Depends(get_db)):
    recommendations = evaluate_auto_assignment(trip_id, db)
    return {"recommendations": recommendations}

@app.get("/api/warehouses", response_model=List[schemas.WarehouseResponse])
def get_warehouses(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "driver":
        drv = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if drv:
            return db.query(models.Warehouse).filter(models.Warehouse.manager_id == drv.manager_id).all()
        return []
    return db.query(models.Warehouse).filter(models.Warehouse.manager_id == current_user.id).all()

# --- Proof Of Delivery (POD) ---
@app.get("/api/pods", response_model=List[schemas.ProofOfDeliveryResponse])
def get_pods(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "driver":
        drv = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if drv:
            return db.query(models.ProofOfDelivery).join(models.Trip).filter(models.Trip.driver_id == drv.id).all()
        return []
    return db.query(models.ProofOfDelivery).join(models.Trip).filter(models.Trip.manager_id == current_user.id).all()

@app.delete("/api/pods/{pod_id}")
async def delete_pod(pod_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can delete POD records.")

    pod = db.query(models.ProofOfDelivery).filter(models.ProofOfDelivery.id == pod_id).first()
    if not pod:
        raise HTTPException(status_code=404, detail="POD record not found")

    trip = db.query(models.Trip).filter(models.Trip.id == pod.trip_id).first()
    db.delete(pod)
    db.commit()

    await log_automation_step(db, "POD Deleted", "Document Flow", f"Proof of Delivery record #{pod_id} was deleted by management.")
    await manager.broadcast({"type": "REFRESH_DATA", "module": "pods"})
    if trip:
        await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    return {"message": "POD record deleted successfully"}

@app.put("/api/pods/{pod_id}", response_model=schemas.ProofOfDeliveryResponse)
async def update_pod(pod_id: int, status: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can verify POD records.")
        
    pod = db.query(models.ProofOfDelivery).filter(models.ProofOfDelivery.id == pod_id).first()
    if not pod:
        raise HTTPException(status_code=404, detail="POD record not found")
        
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
            
            history = json.loads(trip.history or "[]")
            history.append({
                "status": "Completed",
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "notes": "Proof of Delivery approved by manager. Trip completed successfully."
            })
            trip.history = json.dumps(history)
            db.commit()
            
            # Trigger completed pipeline (which auto creates invoice, logs automation, etc)
            await run_trip_completed_pipeline(trip.id, db)
            
            await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
            await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
            await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
            
        elif status == "Rejected":
            trip.status = "Problem"
            history = json.loads(trip.history or "[]")
            history.append({
                "status": "Problem",
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "notes": "Proof of Delivery REJECTED by manager."
            })
            trip.history = json.dumps(history)
            db.commit()
            await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
            
        elif status == "Re-upload Requested":
            trip.status = "Problem"
            history = json.loads(trip.history or "[]")
            history.append({
                "status": "Problem",
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "notes": "Proof of Delivery flagged: Re-upload requested by manager."
            })
            trip.history = json.dumps(history)
            db.commit()
            await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
            
    await log_automation_step(db, f"POD {status}", "Document Flow", f"Proof of Delivery record #{pod_id} was marked {status} by management.")
    await manager.broadcast({"type": "REFRESH_DATA", "module": "pods"})
    return pod

@app.post("/api/pods/submit")
async def driver_submit_pod(payload: dict, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
            
    pod = db.query(models.ProofOfDelivery).filter(models.ProofOfDelivery.trip_id == trip_id).first()
    if not pod:
        pod = models.ProofOfDelivery(trip_id=trip_id)
        db.add(pod)
        
    pod.signature_path = signature
    pod.photo_path = photo
    pod.status = "Pending"
    pod.submitted_at = datetime.datetime.utcnow()
    pod.latitude = latitude
    pod.longitude = longitude
    pod.driver_id = driver_id
    pod.vehicle_id = vehicle_id
    db.commit()
    db.refresh(pod)
    
    # Also log a "Proof of Delivery Pending" alert for the Manager
    alert = models.Alert(
        severity="Medium",
        title="POD Pending Review",
        description=f"Driver {current_user.full_name or current_user.username} submitted POD for Trip #{trip_id}. Verification required.",
        location=db_trip.destination,
        timestamp=datetime.datetime.utcnow(),
        trip_id=trip_id
    )
    db.add(alert)
    db.commit()
    
    await manager.broadcast({"type": "REFRESH_DATA", "module": "pods"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return pod

# --- Billing / Invoices ---
@app.get("/api/invoices", response_model=List[schemas.InvoiceResponse])
def get_invoices(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can view billing and invoices.")
    return db.query(models.Invoice).filter(models.Invoice.manager_id == current_user.id).all()

@app.put("/api/invoices/{invoice_id}", response_model=schemas.InvoiceResponse)
async def update_invoice(invoice_id: int, status: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can manage invoices.")
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id, models.Invoice.manager_id == current_user.id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.status = status
    db.commit()
    db.refresh(invoice)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "invoices"})
    return invoice

# --- Alerts Router ---
@app.get("/api/alerts", response_model=List[schemas.AlertResponse])
def get_alerts(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role == "driver":
        drv = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        if drv:
            veh_num = None
            if drv.vehicle_id:
                veh = db.query(models.Vehicle).filter(models.Vehicle.id == drv.vehicle_id).first()
                if veh:
                    veh_num = veh.vehicle_number
            return db.query(models.Alert).filter(
                (models.Alert.driver_id == drv.id) | 
                (models.Alert.vehicle_number == veh_num)
            ).order_by(models.Alert.timestamp.desc()).all()
        return []
    return db.query(models.Alert).filter(models.Alert.manager_id == current_user.id).order_by(models.Alert.timestamp.desc()).all()

@app.post("/api/alerts", response_model=schemas.AlertResponse)
async def create_alert(alert_data: schemas.AlertCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can dispatch manual alerts.")
    db_alert = models.Alert(**alert_data.dict(), manager_id=current_user.id)
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return db_alert

@app.put("/api/alerts/{alert_id}", response_model=schemas.AlertResponse)
async def resolve_alert(alert_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can resolve alerts.")
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id, models.Alert.manager_id == current_user.id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved = True
    alert.severity = "Resolved"
    db.commit()
    db.refresh(alert)
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    return alert

# --- Automation Logs Router ---
@app.get("/api/automation-logs", response_model=List[schemas.AutomationLogResponse])
def get_automation_logs(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can view system automation logs.")
    return db.query(models.AutomationLog).filter(models.AutomationLog.manager_id == current_user.id).order_by(models.AutomationLog.timestamp.desc()).all()

# --- Database Reset System Router ---
@app.post("/api/system/reset")
async def reset_system_data(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only Managers can trigger a database reset.")
        
    db.query(models.ProofOfDelivery).delete()
    db.query(models.Invoice).delete()
    db.query(models.Alert).delete()
    db.query(models.AutomationLog).delete()
    db.query(models.Trip).delete()
    
    db.query(models.Driver).delete()
    db.query(models.User).filter(models.User.role != "manager").delete()
    
    vehicles = db.query(models.Vehicle).all()
    for v in vehicles:
        v.availability = "Available"
        v.current_trip_id = None
        v.speed = 0.0
        v.gps = "Offline"
        
    db.commit()
    
    await manager.broadcast({"type": "REFRESH_DATA", "module": "trips"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "drivers"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "vehicles"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "pods"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
    await manager.broadcast({"type": "REFRESH_DATA", "module": "invoices"})
    
    await log_automation_step(db, "System Reset", "Database Cleaned", "Management triggered database purge. Manager accounts preserved, driver assets cleared.")
    return {"message": "Database reset completed successfully. Manager accounts preserved."}


# --- Database Seed Script ---
@app.on_event("startup")
def seed_database():
    db = next(get_db())
    # Only seed if no users exist
    if db.query(models.User).count() > 0:
        print("Database already contains data, skipping seed.")
        return
        
    print("Pre-seeding mock database items...")
    
    # 1. Create Users
    manager_pwd = get_password_hash("admin")
    driver_pwd = get_password_hash("driver")
    
    # Managers
    admin_user = models.User(username="admin", hashed_password=manager_pwd, role="manager", email="admin@cognifleet.com", full_name="Admin Manager")
    mgr_user = models.User(username="manager", hashed_password=manager_pwd, role="manager", email="manager@cognifleet.com", full_name="Sarah Collins")
    db.add_all([admin_user, mgr_user])
    db.commit()
    
    # Drivers (Users)
    driver_users = [
        models.User(username="driver1", hashed_password=driver_pwd, role="driver", email="john.d@cognifleet.com", full_name="John Davis"),
        models.User(username="driver2", hashed_password=driver_pwd, role="driver", email="marcus.r@cognifleet.com", full_name="Marcus Rodriguez"),
        models.User(username="driver3", hashed_password=driver_pwd, role="driver", email="emily.w@cognifleet.com", full_name="Emily Wong"),
        models.User(username="driver4", hashed_password=driver_pwd, role="driver", email="robert.t@cognifleet.com", full_name="Robert Taylor"),
        models.User(username="driver5", hashed_password=driver_pwd, role="driver", email="lisa.m@cognifleet.com", full_name="Lisa Miller")
    ]
    db.add_all(driver_users)
    db.commit()
    
    # 2. Create Vehicles
    vehicles = [
        models.Vehicle(vehicle_number="TRK-101", registration="TN-01-FX", type="Semi-Truck", capacity=15.0, health=95, fuel=85, mileage=12400.5, mileage_kml=10.0, last_service_date="2026-06-15", service_due_date="2026-09-30", gps="Online", latitude=13.0827, longitude=80.2707, speed=55.0, availability="Available"),
        models.Vehicle(vehicle_number="TRK-102", registration="TN-38-ZZ", type="Reefer", capacity=12.0, health=62, fuel=92, mileage=24500.0, mileage_kml=8.5, last_service_date="2026-01-10", service_due_date="2026-07-15", gps="Online", latitude=11.0168, longitude=76.9558, speed=0.0, availability="Maintenance"), # Maintenance Overdue
        models.Vehicle(vehicle_number="TRK-103", registration="KA-01-AP", type="Box Truck", capacity=8.0, health=88, fuel=45, mileage=8620.2, mileage_kml=12.0, last_service_date="2026-07-01", service_due_date="2026-08-15", gps="Online", latitude=12.9716, longitude=77.5946, speed=42.0, availability="Available"), # Maintenance Soon
        models.Vehicle(vehicle_number="TRK-104", registration="TS-09-LM", type="Flatbed", capacity=20.0, health=78, fuel=15, mileage=32100.8, mileage_kml=9.0, last_service_date="2026-07-10", service_due_date="2026-08-18", gps="Online", latitude=17.3850, longitude=78.4867, speed=0.0, availability="Available"), # Maintenance Soon
        models.Vehicle(vehicle_number="TRK-105", registration="KA-09-YY", type="Semi-Truck", capacity=15.0, health=100, fuel=100, mileage=1200.0, mileage_kml=11.0, last_service_date="2026-06-20", service_due_date="2026-10-15", gps="Offline", latitude=12.2958, longitude=76.6394, speed=0.0, availability="Available") # Offline
    ]
    db.add_all(vehicles)
    db.commit()
    
    # 3. Create Drivers (Profiles linked to Users)
    drivers = [
        models.Driver(user_id=driver_users[0].id, name="John Davis", phone="+91 98765 43210", email="john.d@cognifleet.com", address="Chennai, TN", experience=8, availability="Available", working_hours=5.5, rating=4.9, violations=0, health="Good", performance=98.0, vehicle_id=vehicles[0].id, manager_id=admin_user.id),
        models.Driver(user_id=driver_users[1].id, name="Marcus Rodriguez", phone="+91 87654 32109", email="marcus.r@cognifleet.com", address="Coimbatore, TN", experience=12, availability="Off Duty", working_hours=0.0, rating=4.8, violations=1, health="Good", performance=94.5, vehicle_id=vehicles[1].id, manager_id=admin_user.id),
        models.Driver(user_id=driver_users[2].id, name="Emily Wong", phone="+91 76543 21098", email="emily.w@cognifleet.com", address="Bengaluru, KA", experience=4, availability="Available", working_hours=4.0, rating=4.6, violations=0, health="Good", performance=91.0, vehicle_id=vehicles[2].id, manager_id=mgr_user.id),
        models.Driver(user_id=driver_users[3].id, name="Robert Taylor", phone="+91 65432 10987", email="robert.t@cognifleet.com", address="Hyderabad, TS", experience=15, availability="Available", working_hours=6.8, rating=4.9, violations=0, health="Good", performance=99.2, vehicle_id=vehicles[3].id, manager_id=mgr_user.id),
        models.Driver(user_id=driver_users[4].id, name="Lisa Miller", phone="+91 54321 09876", email="lisa.m@cognifleet.com", address="Mysuru, KA", experience=2, availability="Available", working_hours=0.0, rating=4.2, violations=2, health="Fair", performance=85.0, vehicle_id=vehicles[4].id, manager_id=mgr_user.id)
    ]
    db.add_all(drivers)
    db.commit()
    
    # 4. Create Warehouses
    warehouses = [
        models.Warehouse(name="Chennai Warehouse", location="Guindy, Chennai, TN", capacity=1500.0, occupancy=42.5, inbound=12, outbound=8, inventory=json.dumps([{"item": "Electronics", "qty": 450}, {"item": "Apparel", "qty": 1200}]), dock_appointments=json.dumps([{"time": "09:00 AM", "carrier": "DHL", "status": "Completed"}, {"time": "02:00 PM", "carrier": "FedEx", "status": "Scheduled"}])),
        models.Warehouse(name="Coimbatore Distribution Center", location="Peelamedu, Coimbatore, TN", capacity=2500.0, occupancy=78.2, inbound=28, outbound=32, inventory=json.dumps([{"item": "Auto Parts", "qty": 3400}, {"item": "Retail Goods", "qty": 8500}]), dock_appointments=json.dumps([{"time": "10:30 AM", "carrier": "Swift", "status": "Completed"}, {"time": "04:30 PM", "carrier": "UPSt", "status": "Scheduled"}])),
        models.Warehouse(name="Bengaluru Hub", location="Electronic City, Bengaluru, KA", capacity=4000.0, occupancy=15.0, inbound=5, outbound=4, inventory=json.dumps([{"item": "Steel Coils", "qty": 50}, {"item": "Machinery", "qty": 12}]), dock_appointments=json.dumps([{"time": "11:00 AM", "carrier": "XPO", "status": "Completed"}]))
    ]
    db.add_all(warehouses)
    db.commit()
    
    # 5. Create Trips
    chennai_coimbatore_coords = json.dumps([[13.0827, 80.2707], [11.9401, 79.4861], [11.6643, 78.1460], [11.0168, 76.9558]])
    chennai_bengaluru_coords = json.dumps([[13.0827, 80.2707], [12.8185, 79.6947], [12.9716, 77.5946]])
    
    trips = [
        models.Trip(
            customer="Tesla Motors", pickup="Chennai Warehouse", destination="Coimbatore Distribution Center",
            stops=json.dumps([
                {"location": "Chennai Warehouse", "type": "Pickup", "status": "Pending"},
                {"location": "Salem Charge Stn", "type": "Inspection", "status": "Pending"},
                {"location": "Coimbatore Distribution Center", "type": "Delivery", "status": "Pending"}
            ]),
            cargo_type="Batteries", weight=10.5, volume=32.0, vehicle_type="Reefer", required_capacity=12.0,
            priority="High", status="Assigned", pickup_date="2026-07-31", delivery_date="2026-08-01",
            instructions="Maintain battery temp at 20 degrees Celsius. Fragile load.",
            fragile=True, temperature_control=True, insurance=True,
            driver_id=drivers[0].id, vehicle_id=vehicles[0].id,
            eta="3h 45m", fuel_cost=5890.0, fuel_used=62.0, fuel_price=95.0, revenue=24500.0, distance=620.0, remaining_distance=620.0,
            route_coordinates=chennai_coimbatore_coords,
            history=json.dumps([
                {"status": "Unassigned", "timestamp": "2026-07-30T10:00:00Z", "notes": "Load registered."},
                {"status": "Assigned", "timestamp": "2026-07-30T14:30:00Z", "notes": "Assigned to John Davis."}
            ]),
            notes="Requires high attention to cooling units.",
            manager_id=admin_user.id
        ),
        models.Trip(
            customer="Amazon Fulfillment", pickup="Chennai Warehouse", destination="Bengaluru Hub",
            stops=json.dumps([
                {"location": "Chennai Warehouse", "type": "Pickup", "status": "Pending"},
                {"location": "Bengaluru Hub", "type": "Delivery", "status": "Pending"}
            ]),
            cargo_type="Consumer Goods", weight=4.2, volume=18.5, vehicle_type="Box Truck", required_capacity=5.0,
            priority="Medium", status="Unassigned", pickup_date="2026-07-31", delivery_date="2026-07-31",
            instructions="Ensure dropoff occurs before evening shift warehouse lock.",
            driver_id=None, vehicle_id=None,
            eta="45m", fuel_cost=332.5, fuel_used=3.5, fuel_price=95.0, revenue=8500.0, distance=35.0, remaining_distance=35.0,
            route_coordinates=chennai_bengaluru_coords,
            history=json.dumps([
                {"status": "Unassigned", "timestamp": "2026-07-31T09:00:00Z", "notes": "Load published to board."}
            ]),
            manager_id=mgr_user.id
        ),
        models.Trip(
            customer="Walmart Inc", pickup="Coimbatore Distribution Center", destination="Chennai Warehouse",
            stops=json.dumps([
                {"location": "Coimbatore Distribution Center", "type": "Pickup", "status": "Completed"},
                {"location": "Chennai Warehouse", "type": "Delivery", "status": "Completed"}
            ]),
            cargo_type="Groceries", weight=12.0, volume=40.0, vehicle_type="Semi-Truck", required_capacity=15.0,
            priority="Critical", status="Completed", pickup_date="2026-07-30", delivery_date="2026-07-30",
            instructions="Urgent grocery restock.",
            driver_id=drivers[3].id, vehicle_id=vehicles[0].id,
            eta="Arrived", fuel_cost=5890.0, fuel_used=62.0, fuel_price=95.0, revenue=31000.0, distance=620.0, remaining_distance=0.0,
            route_coordinates=chennai_coimbatore_coords,
            history=json.dumps([
                {"status": "Unassigned", "timestamp": "2026-07-29T08:00:00Z", "notes": "Load created."},
                {"status": "Assigned", "timestamp": "2026-07-29T10:00:00Z", "notes": "Assigned to Robert Taylor."},
                {"status": "In Transit", "timestamp": "2026-07-30T06:00:00Z", "notes": "Dispatched."},
                {"status": "Completed", "timestamp": "2026-07-30T15:30:00Z", "notes": "Delivered and verified by receiver."}
            ]),
            manager_id=mgr_user.id
        )
    ]
    db.add_all(trips)
    db.commit()
    
    # 6. Create initial Invoices
    invoices = [
        models.Invoice(invoice_number="INV-2026-0001", trip_id=trips[2].id, customer="Walmart Inc", subtotal=3100.0, tax=558.0, discount=100.0, total=3558.0, status="Paid", created_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)),
        models.Invoice(invoice_number="INV-2026-0002", trip_id=trips[0].id, customer="Tesla Motors", subtotal=2450.0, tax=441.0, discount=0.0, total=2891.0, status="Pending", created_at=datetime.datetime.utcnow())
    ]
    db.add_all(invoices)
    db.commit()

    # 7. Create POD for completed trip
    pod = models.ProofOfDelivery(
        trip_id=trips[2].id,
        signature_path="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='50'><path d='M10,30 Q30,10 60,35 T90,20' stroke='black' stroke-width='2' fill='none'/></svg>",
        photo_path="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80",
        barcode="BARCODE-9901",
        qr_code="QR-9901",
        status="Approved",
        submitted_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)
    )
    db.add(pod)
    db.commit()
    
    # 8. Create Alerts
    alerts = [
        models.Alert(severity="Critical", priority="Critical", title="Engine Thermostat Failure", description="Engine head temperature exceeded 225F. Immediate checkup required.", vehicle_number="TRK-102", driver_name="Marcus Rodriguez", location="Coimbatore Distribution Center", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=2), resolved=False, acknowledged=False),
        models.Alert(severity="High", priority="High", title="Mechanical Service Required", description="Brake pad thickness below safety threshold.", vehicle_number="TRK-104", driver_name="Robert Taylor", location="Hyderabad, TS", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=1, minutes=30), resolved=False, acknowledged=False),
        models.Alert(severity="Medium", priority="Warning", title="Low Fuel Level Detected", description="Fuel level dropped below 15%. Range remaining: 45 miles.", vehicle_number="TRK-104", driver_name="Robert Taylor", location="Hyderabad, TS", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=1), resolved=False, acknowledged=False),
        models.Alert(severity="Low", priority="Information", title="GPS Signal Loss Warning", description="GPS tracking module disconnected for 15 minutes. Switched to cellular triangulations.", vehicle_number="TRK-105", driver_name="Lisa Miller", location="Mysuru, KA", timestamp=datetime.datetime.utcnow() - datetime.timedelta(minutes=45), resolved=False, acknowledged=False)
    ]
    db.add_all(alerts)
    db.commit()
    
    # 9. Create Automation Logs
    logs = [
        models.AutomationLog(trigger_event="Trip Completed", pipeline_step="Update Analytics", status="Completed", details="Trip #3 marked Completed. Assets released to pool.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=1, hours=4)),
        models.AutomationLog(trigger_event="Trip Completed", pipeline_step="Generate Invoice", status="Completed", details="Auto-created Billing Invoice INV-2026-0001 ($3,558.00).", timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=1, hours=4)),
        models.AutomationLog(trigger_event="Trip Completed", pipeline_step="Store POD", status="Completed", details="Signature and delivery photo archives attached.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=1, hours=3)),
        models.AutomationLog(trigger_event="Breakdown", pipeline_step="Create Alert", status="Completed", details="Generated Critical Alert #1 for vehicle TRK-102.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=2)),
        models.AutomationLog(trigger_event="Breakdown", pipeline_step="Maintenance Ticket", status="Completed", details="Auto-created repair ticket maintenance ticket for TRK-102.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=2))
    ]
    db.add_all(logs)
    db.commit()
    
    print("Database seeding completed successfully.")

# --- Messaging Router ---

@app.post("/api/messages", response_model=schemas.MessageResponse)
async def send_message(msg: schemas.MessageCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_msg = models.Message(
        sender_id=current_user.id,
        receiver_id=msg.receiver_id,
        content=msg.content
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    
    # If sender is driver, create a manager Notification Alert
    if current_user.role == "driver":
        driver = db.query(models.Driver).filter(models.Driver.user_id == current_user.id).first()
        driver_name = driver.name if driver else (current_user.full_name or current_user.username)
        vehicle_no = driver.vehicle.vehicle_number if (driver and driver.vehicle) else "TRK"
        
        alert = models.Alert(
            severity="Low",
            priority="Low",
            title=f"Driver Message from {driver_name}",
            description=f"Driver: {driver_name} | Vehicle: {vehicle_no} | Message: \"{msg.content}\"",
            driver_name=driver_name,
            vehicle_number=vehicle_no,
            timestamp=datetime.datetime.utcnow(),
            driver_id=driver.id if driver else None,
            manager_id=msg.receiver_id
        )
        db.add(alert)
        db.commit()
        await manager.broadcast({"type": "REFRESH_DATA", "module": "alerts"})
        
    msg_data = schemas.MessageResponse.from_orm(db_msg).dict()
    msg_data['timestamp'] = msg_data['timestamp'].isoformat()
    await manager.broadcast({"type": "NEW_MESSAGE", "message": msg_data})
    return db_msg

@app.get("/api/messages/{other_user_id}", response_model=List[schemas.MessageResponse])
def get_messages(other_user_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    msgs = db.query(models.Message).filter(
        ((models.Message.sender_id == current_user.id) & (models.Message.receiver_id == other_user_id)) |
        ((models.Message.sender_id == other_user_id) & (models.Message.receiver_id == current_user.id))
    ).order_by(models.Message.timestamp.asc()).all()
    
    unread = [m for m in msgs if m.receiver_id == current_user.id and not m.is_read]
    for m in unread:
        m.is_read = True
    if unread:
        db.commit()
        
    return msgs
