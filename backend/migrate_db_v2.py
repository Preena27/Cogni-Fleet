import sqlite3

def run_migration():
    print("Connecting to database...")
    conn = sqlite3.connect("d:\\Projects\\fleet\\Cogni-Fleet\\backend\\fleet.db")
    cursor = conn.cursor()

    # 1. Add emergency_contact and current_location to drivers
    print("Checking drivers table...")
    cursor.execute("PRAGMA table_info(drivers)")
    columns = [info[1] for info in cursor.fetchall()]

    if "emergency_contact" not in columns:
        print("Adding emergency_contact to drivers...")
        cursor.execute("ALTER TABLE drivers ADD COLUMN emergency_contact VARCHAR DEFAULT NULL")
    
    if "current_location" not in columns:
        print("Adding current_location to drivers...")
        cursor.execute("ALTER TABLE drivers ADD COLUMN current_location VARCHAR DEFAULT NULL")

    # 2. Create messages table
    print("Creating messages table if not exists...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_read BOOLEAN DEFAULT 0,
        FOREIGN KEY(sender_id) REFERENCES users(id),
        FOREIGN KEY(receiver_id) REFERENCES users(id)
    )
    """)
    
    # 3. Add current_location to vehicles if not present
    cursor.execute("PRAGMA table_info(vehicles)")
    columns_v = [info[1] for info in cursor.fetchall()]
    if "current_location" not in columns_v:
        print("Adding current_location to vehicles...")
        cursor.execute("ALTER TABLE vehicles ADD COLUMN current_location VARCHAR DEFAULT NULL")
        
    conn.commit()
    conn.close()
    print("Migration V2 completed successfully.")

if __name__ == "__main__":
    run_migration()
