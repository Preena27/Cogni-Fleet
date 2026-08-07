import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "fleet.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

columns = [
    ("current_location", "VARCHAR"),
    ("fuel_capacity", "FLOAT DEFAULT 100.0"),
    ("current_fuel", "FLOAT DEFAULT 100.0"),
    ("odometer", "FLOAT DEFAULT 0.0"),
    ("last_service_odometer", "FLOAT DEFAULT 0.0"),
    ("service_interval", "FLOAT DEFAULT 10000.0"),
    ("next_service_due", "FLOAT DEFAULT 10000.0")
]

for col_name, col_type in columns:
    try:
        cursor.execute(f"ALTER TABLE vehicles ADD COLUMN {col_name} {col_type}")
        print(f"Added column {col_name}")
    except sqlite3.OperationalError as e:
        print(f"Skipped {col_name}: {e}")

conn.commit()
conn.close()
