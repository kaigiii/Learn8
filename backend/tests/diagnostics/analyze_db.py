import sqlalchemy
from app.db.session import engine

with engine.connect() as conn:
    print("--- public_courses ---")
    result = conn.execute(sqlalchemy.text("SELECT id, title FROM public_courses"))
    for row in result:
        print(f"ID: {row[0]}, Title: {row[1]}")
    
    print("\n--- courses ---")
    result = conn.execute(sqlalchemy.text("SELECT id, title FROM courses"))
    for row in result:
        print(f"ID: {row[0]}, Title: {row[1]}")
