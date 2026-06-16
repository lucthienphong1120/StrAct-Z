import sqlite3
import os

db_path = os.path.join("data", "database.sqlite")

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=== ACCOUNTS ===")
cursor.execute("SELECT id, username, role FROM accounts")
for row in cursor.fetchall():
    print(row)

print("\n=== USER CONFIGS ===")
cursor.execute("SELECT account_id, key, value FROM user_config WHERE key LIKE 'schedule%' OR key = 'daily_max_activity' OR key = 'role'")
for row in cursor.fetchall():
    print(row)

print("\n=== RECENT ACTIVITIES ===")
cursor.execute("SELECT id, account_id, created_at, activity_name, upload_status, error_message, created_by, route_start_time FROM activities ORDER BY id DESC LIMIT 20")
for row in cursor.fetchall():
    print(row)

conn.close()
