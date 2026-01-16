import sqlite3
import os

db_path = 'learna_db/learna.db'
abs_path = os.path.abspath(db_path)
print(f"Checking DB at: {abs_path}")

if not os.path.exists(db_path):
    print("DB file not found!")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(courses)")
columns = [info[1] for info in cursor.fetchall()]

print(f"Existing columns: {columns}")

if 'updated_at' not in columns:
    print("Column 'updated_at' missing. Adding...")
    try:
        cursor.execute("ALTER TABLE courses ADD COLUMN updated_at DATETIME")
        cursor.execute("UPDATE courses SET updated_at = datetime('now') WHERE updated_at IS NULL")
        conn.commit()
        print("Column added successfully.")
    except Exception as e:
        print(f"Error adding column: {e}")
else:
    print("Column 'updated_at' exists.")

conn.close()
