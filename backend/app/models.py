from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Table, Text
from sqlalchemy.orm import relationship
import datetime
from .database import Base

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    is_read = Column(Boolean, default=False)

# Many-to-many relationship helper table for Stops in a Trip
# In our database, we can also store stops as a JSON/serialized string in Trip, which is simpler and highly flexible for SQLite.
# Let's store stops, timeline, route, documents, history, and notes as JSON/Text strings to ensure SQLite compatibility and ease of use.

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "manager" or "driver"
    email = Column(String, unique=True, index=True, nullable=True)
    full_name = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    timezone = Column(String, default="UTC")
    language = Column(String, default="English")
    profile_picture = Column(String, nullable=True)
    
    # Relationship to driver model if role is driver
    driver_profile = relationship("Driver", back_populates="user", uselist=False, foreign_keys="Driver.user_id")


class UserSettings(Base):
    __tablename__ = "user_settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    distance_unit = Column(String, default="Kilometers")
    weight_unit = Column(String, default="Kilograms")
    temperature_unit = Column(String, default="Celsius")
    currency = Column(String, default="INR ₹")
    timezone = Column(String, default="Asia/Kolkata")
    date_format = Column(String, default="DD/MM/YYYY")
    time_format = Column(String, default="24-hour")
    language = Column(String, default="English")
    region = Column(String, default="India")
    map_view = Column(String, default="Street")
    route_style = Column(String, default="Solid")
    route_color = Column(String, default="#3b82f6")
    traffic_enabled = Column(Boolean, default=True)
    poi_enabled = Column(Boolean, default=False)
    building_3d_enabled = Column(Boolean, default=False)
    vehicle_markers_enabled = Column(Boolean, default=True)
    route_enabled = Column(Boolean, default=True)
    destination_enabled = Column(Boolean, default=True)
    route_optimization_mode = Column(String, default="Balanced")
    traffic_consideration = Column(Boolean, default=True)
    auto_route_recalculation = Column(Boolean, default=True)
    route_delay_threshold = Column(Integer, default=5)
    
    user = relationship("User", backref="settings")


class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_number = Column(String, unique=True, index=True, nullable=False)
    registration = Column(String, nullable=True)
    type = Column(String, nullable=False)  # e.g., "Semi-Truck", "Box Truck", "Reefer", "Flatbed"
    capacity = Column(Float, nullable=False)  # in tons
    health = Column(Integer, default=100)  # percentage
    fuel = Column(Integer, default=100)  # percentage
    current_fuel = Column(Float, default=100.0)
    fuel_capacity = Column(Float, default=100.0)
    mileage = Column(Float, default=0.0)  # total km
    odometer = Column(Float, default=0.0)
    mileage_kml = Column(Float, default=10.0)  # km per litre
    last_service_date = Column(String, nullable=True)
    last_service_odometer = Column(Float, default=0.0)
    service_due_date = Column(String, nullable=True)
    service_interval = Column(Float, default=10000.0)
    next_service_due = Column(Float, default=10000.0)
    insurance = Column(String, nullable=True)  # expiry date or policy number
    pollution = Column(String, nullable=True)  # status/expiry
    fitness = Column(String, nullable=True)  # status/expiry
    gps = Column(String, default="Offline")  # "Online", "Offline"
    latitude = Column(Float, default=13.0827)  # standard location (e.g. Chennai)
    longitude = Column(Float, default=80.2707)
    current_location = Column(String, nullable=True)
    speed = Column(Float, default=0.0)
    availability = Column(String, default="Available")  # "Available", "On Duty", "Maintenance"
    current_trip_id = Column(Integer, nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    drivers = relationship("Driver", back_populates="vehicle")
    trips = relationship("Trip", back_populates="vehicle")


class Driver(Base):
    __tablename__ = "drivers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    photo = Column(String, nullable=True)
    license = Column(String, nullable=True)
    license_expiry = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    emergency_contact = Column(String, nullable=True)
    current_location = Column(String, nullable=True)
    experience = Column(Integer, default=0)  # years
    availability = Column(String, default="Available")  # "Available", "On Duty", "Off Duty"
    working_hours = Column(Float, default=0.0)  # today's hours
    rating = Column(Float, default=5.0)
    violations = Column(Integer, default=0)
    health = Column(String, default="Good")  # "Good", "Fair", "Needs Checkup"
    performance = Column(Float, default=100.0)  # rating index
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    user = relationship("User", back_populates="driver_profile", foreign_keys="Driver.user_id")
    vehicle = relationship("Vehicle", back_populates="drivers")
    trips = relationship("Trip", back_populates="driver")


class Trip(Base):
    __tablename__ = "trips"
    id = Column(Integer, primary_key=True, index=True)
    customer = Column(String, nullable=False)
    pickup = Column(String, nullable=False)
    destination = Column(String, nullable=False)
    stops = Column(Text, nullable=True)  # JSON serialized list of stops
    cargo_type = Column(String, nullable=True)
    weight = Column(Float, default=0.0)
    volume = Column(Float, default=0.0)
    vehicle_type = Column(String, nullable=True)
    required_capacity = Column(Float, default=0.0)
    priority = Column(String, default="Medium")  # "Low", "Medium", "High", "Critical"
    status = Column(String, default="Unassigned")  # "Unassigned", "Assigned", "Loading", "In Transit", "Delivered", "Problem", "Completed"
    pickup_date = Column(String, nullable=True)
    delivery_date = Column(String, nullable=True)
    instructions = Column(Text, nullable=True)
    fragile = Column(Boolean, default=False)
    temperature_control = Column(Boolean, default=False)
    insurance = Column(Boolean, default=False)
    
    # Assignments
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    
    # Live stats
    eta = Column(String, nullable=True)
    fuel_cost = Column(Float, default=0.0)
    fuel_used = Column(Float, default=0.0)
    fuel_price = Column(Float, default=95.0)
    revenue = Column(Float, default=0.0)
    distance = Column(Float, default=0.0)  # total km
    remaining_distance = Column(Float, default=0.0)
    route_coordinates = Column(Text, nullable=True)  # JSON serialized list of [lat, lng]
    trip_duration = Column(Float, default=0.0)
    average_speed = Column(Float, default=0.0)
    idle_time = Column(Float, default=0.0)
    route_taken = Column(Text, nullable=True)
    assignment_reason = Column(String, nullable=True)
    assignment_confidence = Column(Float, nullable=True)
    assignment_time = Column(DateTime, nullable=True)
    shortest_route_meta = Column(Text, nullable=True)
    fastest_route_meta = Column(Text, nullable=True)
    
    # Documents and logs (JSON lists)
    documents = Column(Text, nullable=True)  # JSON string of doc filenames/types
    history = Column(Text, nullable=True)  # JSON string of state transitions/timestamps
    notes = Column(Text, nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    driver = relationship("Driver", back_populates="trips")
    vehicle = relationship("Vehicle", back_populates="trips")
    pod = relationship("ProofOfDelivery", back_populates="trip", uselist=False)
    invoices = relationship("Invoice", back_populates="trip")


class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    capacity = Column(Float, default=100.0)  # total capacity in tons or sq ft
    occupancy = Column(Float, default=0.0)  # current storage percentage
    inbound = Column(Integer, default=0)  # shipments today
    outbound = Column(Integer, default=0)  # shipments today
    inventory = Column(Text, nullable=True)  # JSON serialization of items/qtys
    dock_appointments = Column(Text, nullable=True)  # JSON serialization of dock schedule
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class ProofOfDelivery(Base):
    __tablename__ = "proof_of_delivery"
    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    signature_path = Column(String, nullable=True)  # base64 data or file url
    photo_path = Column(String, nullable=True)  # base64 data or file url
    pdf_path = Column(String, nullable=True)
    barcode = Column(String, nullable=True)
    qr_code = Column(String, nullable=True)
    status = Column(String, default="Pending")  # "Pending", "Approved", "Rejected"
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    
    trip = relationship("Trip", back_populates="pod")


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, index=True, nullable=False)
    trip_id = Column(Integer, ForeignKey("trips.id"), nullable=False)
    customer = Column(String, nullable=False)
    subtotal = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    status = Column(String, default="Pending")  # "Pending", "Paid", "Overdue"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    trip = relationship("Trip", back_populates="invoices")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    severity = Column(String, default="Medium")  # "Critical", "High", "Medium", "Low", "Resolved"
    priority = Column(String, default="Information")  # "Information", "Warning", "High", "Critical"
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    vehicle_number = Column(String, nullable=True)
    driver_name = Column(String, nullable=True)
    location = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    resolved = Column(Boolean, default=False)
    acknowledged = Column(Boolean, default=False)
    trip_id = Column(Integer, nullable=True)
    driver_id = Column(Integer, nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)


class AutomationLog(Base):
    __tablename__ = "automation_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    trigger_event = Column(String, nullable=False)  # e.g., "Trip Assigned", "Breakdown"
    pipeline_step = Column(String, nullable=False)  # e.g., "Notify Driver", "Route Updated"
    status = Column(String, default="Completed")  # "Completed", "Failed"
    details = Column(Text, nullable=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
