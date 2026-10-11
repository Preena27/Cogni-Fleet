from pydantic import BaseModel, Field, ConfigDict
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

# Message Schemas
class MessageBase(BaseModel):
    receiver_id: int
    content: str

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: int
    sender_id: int
    timestamp: datetime
    is_read: bool
    model_config = ConfigDict(from_attributes=True)
# User Schemas
class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    company_name: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = "UTC"
    language: Optional[str] = "English"
    profile_picture: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
class UserProfileUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    username: Optional[str] = None
    company_name: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    profile_picture: Optional[str] = None

class PasswordUpdateSchema(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

class UsernameUpdateSchema(BaseModel):
    new_username: str

class UserSettingsBase(BaseModel):
    distance_unit: Optional[str] = "Kilometers"
    weight_unit: Optional[str] = "Kilograms"
    temperature_unit: Optional[str] = "Celsius"
    currency: Optional[str] = "INR ₹"
    timezone: Optional[str] = "Asia/Kolkata"
    date_format: Optional[str] = "DD/MM/YYYY"
    time_format: Optional[str] = "24-hour"
    language: Optional[str] = "English"
    region: Optional[str] = "India"
    map_view: Optional[str] = "Street"
    route_style: Optional[str] = "Solid"
    route_color: Optional[str] = "#3b82f6"
    traffic_enabled: Optional[bool] = True
    poi_enabled: Optional[bool] = False
    building_3d_enabled: Optional[bool] = False
    vehicle_markers_enabled: Optional[bool] = True
    route_enabled: Optional[bool] = True
    destination_enabled: Optional[bool] = True
    route_optimization_mode: Optional[str] = "Balanced"
    traffic_consideration: Optional[bool] = True
    auto_route_recalculation: Optional[bool] = True
    route_delay_threshold: Optional[int] = 5

class UserSettingsUpdate(UserSettingsBase):
    pass

class UserSettingsResponse(UserSettingsBase):
    id: int
    user_id: int
    model_config = ConfigDict(from_attributes=True)
# Vehicle Schemas
class VehicleBase(BaseModel):
    vehicle_number: str
    registration: Optional[str] = None
    type: str
    capacity: float
    health: Optional[int] = 100
    fuel: Optional[int] = 100
    current_fuel: Optional[float] = 100.0
    fuel_capacity: Optional[float] = 100.0
    mileage: Optional[float] = 0.0
    odometer: Optional[float] = 0.0
    mileage_kml: Optional[float] = 10.0
    last_service_date: Optional[str] = None
    last_service_odometer: Optional[float] = 0.0
    service_due_date: Optional[str] = None
    service_interval: Optional[float] = 10000.0
    next_service_due: Optional[float] = 10000.0
    insurance: Optional[str] = None
    pollution: Optional[str] = None
    fitness: Optional[str] = None
    gps: Optional[str] = "Offline"
    latitude: Optional[float] = 13.0827
    longitude: Optional[float] = 80.2707
    current_location: Optional[str] = None
    speed: Optional[float] = 0.0
    availability: Optional[str] = "Available"
    current_trip_id: Optional[int] = None

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseModel):
    vehicle_number: Optional[str] = None
    registration: Optional[str] = None
    type: Optional[str] = None
    capacity: Optional[float] = None
    health: Optional[int] = None
    fuel: Optional[int] = None
    current_fuel: Optional[float] = None
    fuel_capacity: Optional[float] = None
    mileage: Optional[float] = None
    odometer: Optional[float] = None
    mileage_kml: Optional[float] = None
    last_service_date: Optional[str] = None
    last_service_odometer: Optional[float] = None
    service_due_date: Optional[str] = None
    service_interval: Optional[float] = None
    next_service_due: Optional[float] = None
    insurance: Optional[str] = None
    pollution: Optional[str] = None
    fitness: Optional[str] = None
    gps: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    current_location: Optional[str] = None
    speed: Optional[float] = None
    availability: Optional[str] = None
    current_trip_id: Optional[int] = None

class VehicleResponse(VehicleBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
class RefuelRequest(BaseModel):
    fuel_added: float

# Driver Schemas
class DriverBase(BaseModel):
    name: str
    photo: Optional[str] = None
    license: Optional[str] = None
    license_expiry: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    current_location: Optional[str] = None
    experience: Optional[int] = 0
    availability: Optional[str] = "Available"
    working_hours: Optional[float] = 0.0
    rating: Optional[float] = 5.0
    violations: Optional[int] = 0
    health: Optional[str] = "Good"
    performance: Optional[float] = 100.0
    vehicle_id: Optional[int] = None

class DriverUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    photo: Optional[str] = None
    license: Optional[str] = None
    license_expiry: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    current_location: Optional[str] = None
    experience: Optional[int] = None
    availability: Optional[str] = None
    working_hours: Optional[float] = None
    rating: Optional[float] = None
    violations: Optional[int] = None
    health: Optional[str] = None
    performance: Optional[float] = None
    vehicle_id: Optional[int] = None

class DriverCreate(DriverBase):
    user_id: Optional[int] = None

class DriverResponse(DriverBase):
    id: int
    user_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)
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
    fuel_used: Optional[float] = 0.0
    fuel_price: Optional[float] = 95.0
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

class TripBulkImportItem(BaseModel):
    id: Optional[int] = None
    customer: Optional[str] = "CSV Import"
    pickup: str
    destination: str
    cargo_type: Optional[str] = None
    weight: Optional[float] = 0.0
    volume: Optional[float] = 0.0
    vehicle_type: Optional[str] = "Semi-Truck"
    required_capacity: Optional[float] = 0.0
    priority: Optional[str] = "Medium"
    status: Optional[str] = "Unassigned"
    pickup_date: Optional[str] = None
    delivery_date: Optional[str] = None
    instructions: Optional[str] = None
    fragile: Optional[bool] = False
    temperature_control: Optional[bool] = False
    insurance: Optional[bool] = False

class TripResponse(TripBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
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
    model_config = ConfigDict(from_attributes=True)
# Proof Of Delivery Schemas
class ProofOfDeliveryBase(BaseModel):
    trip_id: int
    signature_path: Optional[str] = None
    photo_path: Optional[str] = None
    pdf_path: Optional[str] = None
    barcode: Optional[str] = None
    qr_code: Optional[str] = None
    status: Optional[str] = "Pending"
    driver_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ProofOfDeliveryCreate(ProofOfDeliveryBase):
    pass

class ProofOfDeliveryResponse(ProofOfDeliveryBase):
    id: int
    submitted_at: datetime
    model_config = ConfigDict(from_attributes=True)
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
    model_config = ConfigDict(from_attributes=True)
# Alert Schemas
class AlertBase(BaseModel):
    severity: str
    priority: Optional[str] = "Information"
    title: str
    description: Optional[str] = None
    vehicle_number: Optional[str] = None
    driver_name: Optional[str] = None
    location: Optional[str] = None
    resolved: Optional[bool] = False
    acknowledged: Optional[bool] = False
    trip_id: Optional[int] = None
    driver_id: Optional[int] = None

class AlertCreate(AlertBase):
    pass

class AlertResponse(AlertBase):
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
# Automation Log Schemas
class AutomationLogBase(BaseModel):
    trigger_event: str
    pipeline_step: str
    status: Optional[str] = "Completed"
    details: Optional[str] = None

class AutomationLogResponse(AutomationLogBase):
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
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
    email: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    current_location: Optional[str] = None
    experience: Optional[int] = 0


# Authentication payloads
class LoginRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = None
