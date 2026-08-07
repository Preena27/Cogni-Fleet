import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'app', 'fleet.db')
if not os.path.exists(DB_PATH):
    DB_PATH = os.path.join(os.path.dirname(__file__), 'fleet.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create user_settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        distance_unit VARCHAR DEFAULT 'Kilometers',
        weight_unit VARCHAR DEFAULT 'Kilograms',
        temperature_unit VARCHAR DEFAULT 'Celsius',
        currency VARCHAR DEFAULT 'INR ₹',
        timezone VARCHAR DEFAULT 'Asia/Kolkata',
        date_format VARCHAR DEFAULT 'DD/MM/YYYY',
        time_format VARCHAR DEFAULT '24-hour',
        language VARCHAR DEFAULT 'English',
        region VARCHAR DEFAULT 'India',
        map_view VARCHAR DEFAULT 'Street',
        route_style VARCHAR DEFAULT 'Solid',
        route_color VARCHAR DEFAULT '#3b82f6',
        traffic_enabled BOOLEAN DEFAULT 1,
        poi_enabled BOOLEAN DEFAULT 0,
        building_3d_enabled BOOLEAN DEFAULT 0,
        vehicle_markers_enabled BOOLEAN DEFAULT 1,
        route_enabled BOOLEAN DEFAULT 1,
        destination_enabled BOOLEAN DEFAULT 1,
        route_optimization_mode VARCHAR DEFAULT 'Balanced',
        traffic_consideration BOOLEAN DEFAULT 1,
        auto_route_recalculation BOOLEAN DEFAULT 1,
        route_delay_threshold INTEGER DEFAULT 5,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)

    # Add columns to proof_of_delivery
    try:
        cursor.execute("ALTER TABLE proof_of_delivery ADD COLUMN driver_id INTEGER REFERENCES drivers(id)")
    except sqlite3.OperationalError:
        pass  # Column likely exists
        
    try:
        cursor.execute("ALTER TABLE proof_of_delivery ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id)")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE proof_of_delivery ADD COLUMN latitude FLOAT")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE proof_of_delivery ADD COLUMN longitude FLOAT")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()
    print("Database migration v3 completed.")

if __name__ == "__main__":
    migrate()
