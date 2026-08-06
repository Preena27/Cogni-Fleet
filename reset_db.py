import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "fleet.db")

def reset_database():
    if not os.path.exists(db_path):
        print(f"Database file not found at {db_path}.")
        return
        
    print(f"Connecting to database at {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Clear tables
        print("Clearing Proof Of Delivery records...")
        cursor.execute("DELETE FROM proof_of_delivery;")
        
        print("Clearing Invoices...")
        cursor.execute("DELETE FROM invoices;")
        
        print("Clearing Alerts...")
        cursor.execute("DELETE FROM alerts;")
        
        print("Clearing Automation Logs...")
        cursor.execute("DELETE FROM automation_logs;")
        
        print("Clearing Trips...")
        cursor.execute("DELETE FROM trips;")
        
        print("Clearing Drivers...")
        cursor.execute("DELETE FROM drivers;")
        
        print("Purging Driver user accounts (keeping Managers)...")
        cursor.execute("DELETE FROM users WHERE role != 'manager';")
        
        print("Resetting Vehicle states...")
        cursor.execute("UPDATE vehicles SET availability = 'Available', current_trip_id = NULL, speed = 0.0, gps = 'Offline';")
        
        conn.commit()
        print("Database reset completed successfully. All driver records and logs purged, manager accounts preserved.")
    except Exception as e:
        conn.rollback()
        print(f"Error resetting database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    reset_database()
