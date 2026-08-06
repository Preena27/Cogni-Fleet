from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# User Schemas
class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    company_name: Optional[str] = None
    phone: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    class Config:
        from_attributes = True

# Vehicle Schemas
class VehicleBase(BaseModel):
    vehicle_number: str
    registration: Optional[str] = None
    type: str
    capacity: float
    health: Optional[int] = 100
    fuel: Optional[int] = 100
    mileage: Optional[float] = 0.0
    insurance: Optional[str] = None
    pollution: Optional[str] = None
    fitness: Optional[str] = None
    gps: Optional[str] = "Offline"
    latitude: Optional[float] = 37.7749
    longitude: Optional[float] = -122.4194
    speed: Optional[float] = 0.0
    availability: Optional[str] = "Available"
    current_trip_id: Optional[int] = None

class VehicleCreate(VehicleBase):
    pass

class VehicleResponse(VehicleBase):
    id: int
    class Config:
        from_attributes = True

# Driver Schemas
class DriverBase(BaseModel):
    name: str
    photo: Optional[str] = None
    license: Optional[str] = None
    license_expiry: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    experience: Optional[int] = 0
    availability: Optional[str] = "Available"
    working_hours: Optional[float] = 0.0
    rating: Optional[float] = 5.0
    violations: Optional[int] = 0
    health: Optional[str] = "Good"
    performance: Optional[float] = 100.0
    vehicle_id: Optional[int] = None

class DriverCreate(DriverBase):
    user_id: Optional[int] = None

class DriverResponse(DriverBase):
    id: int
    user_id: Optional[int] = None
    class Config:
        from_attributes = True

# Trip / Load Schemas
class TripBase(BaseModel):
    customer: str
    pickup: str
    destination: str
    stops: Optional[str] = None  # JSON string
    cargo_type: Optional[str] = None
    weight: Optional[float] = 0.0
    volume: Optional[float] = 0.0
    vehicle_type: Optional[str] = None
    required_capacity: Optional[float] = 0.0
    priority: Optional[str] = "Medium"
    status: Optional[str] = "Unassigned"
    pickup_date: Optional[str] = None
    delivery_date: Optional[str] = None
    instructions: Optional[str] = None
    fragile: Optional[bool] = False
    temperature_control: Optional[bool] = False
    insurance: Optional[bool] = False
    driver_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    eta: Optional[str] = None
    fuel_cost: Optional[float] = 0.0
    revenue: Optional[float] = 0.0
    distance: Optional[float] = 0.0
    remaining_distance: Optional[float] = 0.0
    route_coordinates: Optional[str] = None  # JSON string
    trip_duration: Optional[float] = 0.0
    average_speed: Optional[float] = 0.0
    idle_time: Optional[float] = 0.0
    route_taken: Optional[str] = None
    assignment_reason: Optional[str] = None
    assignment_confidence: Optional[float] = None
    assignment_time: Optional[datetime] = None
    shortest_route_meta: Optional[str] = None
    fastest_route_meta: Optional[str] = None
    documents: Optional[str] = None  # JSON string
    history: Optional[str] = None  # JSON string
    notes: Optional[str] = None

class TripCreate(TripBase):
    pass

class TripResponse(TripBase):
    id: int
    class Config:
        from_attributes = True

# Warehouse Schemas
class WarehouseBase(BaseModel):
    name: str
    location: str
    capacity: Optional[float] = 100.0
    occupancy: Optional[float] = 0.0
    inbound: Optional[int] = 0
    outbound: Optional[int] = 0
    inventory: Optional[str] = None  # JSON string
    dock_appointments: Optional[str] = None  # JSON string

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseResponse(WarehouseBase):
    id: int
    class Config:
        from_attributes = True

# Proof Of Delivery Schemas
class ProofOfDeliveryBase(BaseModel):
    trip_id: int
    signature_path: Optional[str] = None
    photo_path: Optional[str] = None
    pdf_path: Optional[str] = None
    barcode: Optional[str] = None
    qr_code: Optional[str] = None
    status: Optional[str] = "Pending"

class ProofOfDeliveryCreate(ProofOfDeliveryBase):
    pass

class ProofOfDeliveryResponse(ProofOfDeliveryBase):
    id: int
    submitted_at: datetime
    class Config:
        from_attributes = True

# Invoice Schemas
class InvoiceBase(BaseModel):
    invoice_number: str
    trip_id: int
    customer: str
    subtotal: Optional[float] = 0.0
    tax: Optional[float] = 0.0
    discount: Optional[float] = 0.0
    total: Optional[float] = 0.0
    status: Optional[str] = "Pending"

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceResponse(InvoiceBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

# Alert Schemas
class AlertBase(BaseModel):
    severity: str
    title: str
    description: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    location: Optional[str] = None
    resolved: Optional[bool] = False
    trip_id: Optional[int] = None
    driver_id: Optional[int] = None

class AlertCreate(AlertBase):
    pass

class AlertResponse(AlertBase):
    id: int
    timestamp: datetime
    class Config:
        from_attributes = True

# Automation Log Schemas
class AutomationLogBase(BaseModel):
    trigger_event: str
    pipeline_step: str
    status: Optional[str] = "Completed"
    details: Optional[str] = None

class AutomationLogResponse(AutomationLogBase):
    id: int
    timestamp: datetime
    class Config:
        from_attributes = True

# AI Assistant Query Schema
class AIMessage(BaseModel):
    role: str
    content: str

class AIQuery(BaseModel):
    query: str
    conversation: Optional[List[AIMessage]] = None

class DriverCreateRequest(BaseModel):
    name: str
    username: str
    password: str
    license: str
    phone: str
