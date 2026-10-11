"""Demo data seeding.

Only runs when the database is empty and is gated behind ``SEED_DEMO_DATA``
(disabled automatically in production). The seeded accounts use weak demo
credentials on purpose so the sample UI works out of the box.
"""
import datetime
import json

from sqlalchemy.orm import Session

from . import models
from .security import get_password_hash


def seed_database(db: Session) -> None:
    if db.query(models.User).count() > 0:
        print("[seed] Database already contains data, skipping seed.")
        return

    print("[seed] Pre-seeding demo database items...")

    # 1. Users -----------------------------------------------------------------
    manager_pwd = get_password_hash("admin")
    driver_pwd = get_password_hash("driver")

    admin_user = models.User(
        username="admin", hashed_password=manager_pwd, role="manager",
        email="admin@cognifleet.com", full_name="Admin Manager",
    )
    mgr_user = models.User(
        username="manager", hashed_password=manager_pwd, role="manager",
        email="manager@cognifleet.com", full_name="Sarah Collins",
    )
    db.add_all([admin_user, mgr_user])
    db.commit()

    driver_users = [
        models.User(username="driver1", hashed_password=driver_pwd, role="driver", email="john.d@cognifleet.com", full_name="John Davis"),
        models.User(username="driver2", hashed_password=driver_pwd, role="driver", email="marcus.r@cognifleet.com", full_name="Marcus Rodriguez"),
        models.User(username="driver3", hashed_password=driver_pwd, role="driver", email="emily.w@cognifleet.com", full_name="Emily Wong"),
        models.User(username="driver4", hashed_password=driver_pwd, role="driver", email="robert.t@cognifleet.com", full_name="Robert Taylor"),
        models.User(username="driver5", hashed_password=driver_pwd, role="driver", email="lisa.m@cognifleet.com", full_name="Lisa Miller"),
    ]
    db.add_all(driver_users)
    db.commit()

    # 2. Vehicles --------------------------------------------------------------
    vehicles = [
        models.Vehicle(vehicle_number="TRK-101", registration="TN-01-FX", type="Semi-Truck", capacity=15.0, health=95, fuel=85, current_fuel=85.0, fuel_capacity=100.0, mileage=12400.5, odometer=12400.5, mileage_kml=10.0, last_service_date="2026-06-15", last_service_odometer=10000.0, service_due_date="2026-09-30", next_service_due=20000.0, gps="Online", latitude=13.0827, longitude=80.2707, speed=55.0, availability="Available", current_location="Chennai Depot", manager_id=admin_user.id),
        models.Vehicle(vehicle_number="TRK-102", registration="TN-38-ZZ", type="Reefer", capacity=12.0, health=62, fuel=92, current_fuel=92.0, fuel_capacity=100.0, mileage=24500.0, odometer=24500.0, mileage_kml=8.5, last_service_date="2026-01-10", last_service_odometer=15000.0, service_due_date="2026-07-15", next_service_due=16000.0, gps="Online", latitude=11.0168, longitude=76.9558, speed=0.0, availability="Maintenance", current_location="Coimbatore Yard", manager_id=admin_user.id),
        models.Vehicle(vehicle_number="TRK-103", registration="KA-01-AP", type="Box Truck", capacity=8.0, health=88, fuel=45, current_fuel=45.0, fuel_capacity=100.0, mileage=8620.2, odometer=8620.2, mileage_kml=12.0, last_service_date="2026-07-01", last_service_odometer=7000.0, service_due_date="2026-08-15", next_service_due=17000.0, gps="Online", latitude=12.9716, longitude=77.5946, speed=42.0, availability="Available", current_location="Bengaluru Hub", manager_id=mgr_user.id),
        models.Vehicle(vehicle_number="TRK-104", registration="TS-09-LM", type="Flatbed", capacity=20.0, health=78, fuel=15, current_fuel=15.0, fuel_capacity=100.0, mileage=32100.8, odometer=32100.8, mileage_kml=9.0, last_service_date="2026-07-10", last_service_odometer=30000.0, service_due_date="2026-08-18", next_service_due=40000.0, gps="Online", latitude=17.3850, longitude=78.4867, speed=0.0, availability="Available", current_location="Hyderabad Yard", manager_id=mgr_user.id),
        models.Vehicle(vehicle_number="TRK-105", registration="KA-09-YY", type="Semi-Truck", capacity=15.0, health=100, fuel=100, current_fuel=100.0, fuel_capacity=100.0, mileage=1200.0, odometer=1200.0, mileage_kml=11.0, last_service_date="2026-06-20", last_service_odometer=0.0, service_due_date="2026-10-15", next_service_due=10000.0, gps="Offline", latitude=12.2958, longitude=76.6394, speed=0.0, availability="Available", current_location="Mysuru Depot", manager_id=mgr_user.id),
    ]
    db.add_all(vehicles)
    db.commit()

    # 3. Drivers ---------------------------------------------------------------
    drivers = [
        models.Driver(user_id=driver_users[0].id, name="John Davis", phone="+91 98765 43210", email="john.d@cognifleet.com", address="Chennai, TN", experience=8, availability="Available", working_hours=5.5, rating=4.9, violations=0, health="Good", performance=98.0, vehicle_id=vehicles[0].id, manager_id=admin_user.id, license="DL-TN-2020-0001", license_expiry="2026-11-20"),
        models.Driver(user_id=driver_users[1].id, name="Marcus Rodriguez", phone="+91 87654 32109", email="marcus.r@cognifleet.com", address="Coimbatore, TN", experience=12, availability="Off Duty", working_hours=0.0, rating=4.8, violations=1, health="Good", performance=94.5, vehicle_id=vehicles[1].id, manager_id=admin_user.id, license="DL-TN-2018-0442", license_expiry="2026-10-28"),
        models.Driver(user_id=driver_users[2].id, name="Emily Wong", phone="+91 76543 21098", email="emily.w@cognifleet.com", address="Bengaluru, KA", experience=4, availability="Available", working_hours=4.0, rating=4.6, violations=0, health="Good", performance=91.0, vehicle_id=vehicles[2].id, manager_id=mgr_user.id, license="DL-KA-2022-1180", license_expiry="2027-03-05"),
        models.Driver(user_id=driver_users[3].id, name="Robert Taylor", phone="+91 65432 10987", email="robert.t@cognifleet.com", address="Hyderabad, TS", experience=15, availability="Available", working_hours=6.8, rating=4.9, violations=0, health="Good", performance=99.2, vehicle_id=vehicles[3].id, manager_id=mgr_user.id, license="DL-TS-2012-0091", license_expiry="2027-01-15"),
        models.Driver(user_id=driver_users[4].id, name="Lisa Miller", phone="+91 54321 09876", email="lisa.m@cognifleet.com", address="Mysuru, KA", experience=2, availability="Available", working_hours=0.0, rating=4.2, violations=2, health="Fair", performance=85.0, vehicle_id=vehicles[4].id, manager_id=mgr_user.id, license="DL-KA-2024-8821", license_expiry="2026-10-25"),
    ]
    db.add_all(drivers)
    db.commit()

    # 4. Warehouses ------------------------------------------------------------
    warehouses = [
        models.Warehouse(name="Chennai Warehouse", location="Guindy, Chennai, TN", capacity=1500.0, occupancy=42.5, inbound=12, outbound=8, inventory=json.dumps([{"item": "Electronics", "qty": 450}, {"item": "Apparel", "qty": 1200}]), dock_appointments=json.dumps([{"time": "09:00 AM", "carrier": "DHL", "status": "Completed"}, {"time": "02:00 PM", "carrier": "FedEx", "status": "Scheduled"}]), manager_id=admin_user.id),
        models.Warehouse(name="Coimbatore Distribution Center", location="Peelamedu, Coimbatore, TN", capacity=2500.0, occupancy=78.2, inbound=28, outbound=32, inventory=json.dumps([{"item": "Auto Parts", "qty": 3400}, {"item": "Retail Goods", "qty": 8500}]), dock_appointments=json.dumps([{"time": "10:30 AM", "carrier": "Swift", "status": "Completed"}, {"time": "04:30 PM", "carrier": "UPSt", "status": "Scheduled"}]), manager_id=mgr_user.id),
        models.Warehouse(name="Bengaluru Hub", location="Electronic City, Bengaluru, KA", capacity=4000.0, occupancy=15.0, inbound=5, outbound=4, inventory=json.dumps([{"item": "Steel Coils", "qty": 50}, {"item": "Machinery", "qty": 12}]), dock_appointments=json.dumps([{"time": "11:00 AM", "carrier": "XPO", "status": "Completed"}]), manager_id=mgr_user.id),
    ]
    db.add_all(warehouses)
    db.commit()

    # 5. Trips -----------------------------------------------------------------
    chennai_coimbatore_coords = json.dumps([[13.0827, 80.2707], [11.9401, 79.4861], [11.6643, 78.1460], [11.0168, 76.9558]])
    chennai_bengaluru_coords = json.dumps([[13.0827, 80.2707], [12.8185, 79.6947], [12.9716, 77.5946]])

    trips = [
        models.Trip(
            customer="Tesla Motors", pickup="Chennai Warehouse", destination="Coimbatore Distribution Center",
            stops=json.dumps([
                {"location": "Chennai Warehouse", "type": "Pickup", "status": "Pending"},
                {"location": "Salem Charge Stn", "type": "Inspection", "status": "Pending"},
                {"location": "Coimbatore Distribution Center", "type": "Delivery", "status": "Pending"},
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
                {"status": "Assigned", "timestamp": "2026-07-30T14:30:00Z", "notes": "Assigned to John Davis."},
            ]),
            notes="Requires high attention to cooling units.",
            manager_id=admin_user.id,
        ),
        models.Trip(
            customer="Amazon Fulfillment", pickup="Chennai Warehouse", destination="Bengaluru Hub",
            stops=json.dumps([
                {"location": "Chennai Warehouse", "type": "Pickup", "status": "Pending"},
                {"location": "Bengaluru Hub", "type": "Delivery", "status": "Pending"},
            ]),
            cargo_type="Consumer Goods", weight=4.2, volume=18.5, vehicle_type="Box Truck", required_capacity=5.0,
            priority="Medium", status="Unassigned", pickup_date="2026-07-31", delivery_date="2026-07-31",
            instructions="Ensure dropoff occurs before evening shift warehouse lock.",
            driver_id=None, vehicle_id=None,
            eta="45m", fuel_cost=332.5, fuel_used=3.5, fuel_price=95.0, revenue=8500.0, distance=35.0, remaining_distance=35.0,
            route_coordinates=chennai_bengaluru_coords,
            history=json.dumps([
                {"status": "Unassigned", "timestamp": "2026-07-31T09:00:00Z", "notes": "Load published to board."},
            ]),
            manager_id=admin_user.id,
        ),
        models.Trip(
            customer="Walmart Inc", pickup="Coimbatore Distribution Center", destination="Chennai Warehouse",
            stops=json.dumps([
                {"location": "Coimbatore Distribution Center", "type": "Pickup", "status": "Completed"},
                {"location": "Chennai Warehouse", "type": "Delivery", "status": "Completed"},
            ]),
            cargo_type="Groceries", weight=12.0, volume=40.0, vehicle_type="Semi-Truck", required_capacity=15.0,
            priority="Critical", status="Completed", pickup_date="2026-07-30", delivery_date="2026-07-30",
            instructions="Urgent grocery restock.",
            driver_id=drivers[3].id, vehicle_id=vehicles[2].id,
            eta="Arrived", fuel_cost=5890.0, fuel_used=62.0, fuel_price=95.0, revenue=31000.0, distance=620.0, remaining_distance=0.0,
            route_coordinates=chennai_coimbatore_coords,
            history=json.dumps([
                {"status": "Unassigned", "timestamp": "2026-07-29T08:00:00Z", "notes": "Load created."},
                {"status": "Assigned", "timestamp": "2026-07-29T10:00:00Z", "notes": "Assigned to Robert Taylor."},
                {"status": "In Transit", "timestamp": "2026-07-30T06:00:00Z", "notes": "Dispatched."},
                {"status": "Completed", "timestamp": "2026-07-30T15:30:00Z", "notes": "Delivered and verified by receiver."},
            ]),
            manager_id=mgr_user.id,
        ),
    ]
    db.add_all(trips)
    db.commit()

    # 6. Invoices --------------------------------------------------------------
    invoices = [
        models.Invoice(invoice_number="INV-2026-0001", trip_id=trips[2].id, customer="Walmart Inc", subtotal=3100.0, tax=558.0, discount=100.0, total=3558.0, status="Paid", created_at=datetime.datetime.utcnow() - datetime.timedelta(days=1), manager_id=mgr_user.id),
        models.Invoice(invoice_number="INV-2026-0002", trip_id=trips[0].id, customer="Tesla Motors", subtotal=2450.0, tax=441.0, discount=0.0, total=2891.0, status="Pending", created_at=datetime.datetime.utcnow(), manager_id=admin_user.id),
    ]
    db.add_all(invoices)
    db.commit()

    # 7. POD for completed trip ------------------------------------------------
    db.add(models.ProofOfDelivery(
        trip_id=trips[2].id,
        signature_path="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='50'><path d='M10,30 Q30,10 60,35 T90,20' stroke='black' stroke-width='2' fill='none'/></svg>",
        photo_path="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80",
        barcode="BARCODE-9901", qr_code="QR-9901", status="Approved",
        submitted_at=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        manager_id=mgr_user.id,
    ))
    db.commit()

    # 8. Alerts ----------------------------------------------------------------
    alerts = [
        models.Alert(severity="Critical", priority="Critical", title="Engine Thermostat Failure", description="Engine head temperature exceeded 225F. Immediate checkup required.", vehicle_number="TRK-102", driver_name="Marcus Rodriguez", location="Coimbatore Distribution Center", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=2), resolved=False, acknowledged=False, manager_id=admin_user.id),
        models.Alert(severity="High", priority="High", title="Mechanical Service Required", description="Brake pad thickness below safety threshold.", vehicle_number="TRK-104", driver_name="Robert Taylor", location="Hyderabad, TS", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=1, minutes=30), resolved=False, acknowledged=False, manager_id=mgr_user.id),
        models.Alert(severity="Medium", priority="Warning", title="Low Fuel Level Detected", description="Fuel level dropped below 15%. Range remaining: 45 miles.", vehicle_number="TRK-104", driver_name="Robert Taylor", location="Hyderabad, TS", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=1), resolved=False, acknowledged=False, manager_id=mgr_user.id),
        models.Alert(severity="Low", priority="Information", title="GPS Signal Loss Warning", description="GPS tracking module disconnected for 15 minutes. Switched to cellular triangulations.", vehicle_number="TRK-105", driver_name="Lisa Miller", location="Mysuru, KA", timestamp=datetime.datetime.utcnow() - datetime.timedelta(minutes=45), resolved=False, acknowledged=False, manager_id=mgr_user.id),
    ]
    db.add_all(alerts)
    db.commit()

    # 9. Automation logs -------------------------------------------------------
    logs = [
        models.AutomationLog(trigger_event="Trip Completed", pipeline_step="Update Analytics", status="Completed", details="Trip #3 marked Completed. Assets released to pool.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=1, hours=4), manager_id=mgr_user.id),
        models.AutomationLog(trigger_event="Trip Completed", pipeline_step="Generate Invoice", status="Completed", details="Auto-created Billing Invoice INV-2026-0001 ($3,558.00).", timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=1, hours=4), manager_id=mgr_user.id),
        models.AutomationLog(trigger_event="Trip Completed", pipeline_step="Store POD", status="Completed", details="Signature and delivery photo archives attached.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=1, hours=3), manager_id=mgr_user.id),
        models.AutomationLog(trigger_event="Breakdown", pipeline_step="Create Alert", status="Completed", details="Generated Critical Alert #1 for vehicle TRK-102.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=2), manager_id=admin_user.id),
        models.AutomationLog(trigger_event="Breakdown", pipeline_step="Maintenance Ticket", status="Completed", details="Auto-created repair ticket maintenance ticket for TRK-102.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=2), manager_id=admin_user.id),
    ]
    db.add_all(logs)
    db.commit()

    print("[seed] Database seeding completed successfully.")
