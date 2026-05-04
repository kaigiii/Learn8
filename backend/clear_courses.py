import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def clear_courses():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        from app.core.config import settings
        db_url = settings.DATABASE_URL
    print(f"Connecting to: {db_url}")
    engine = create_engine(db_url)
    
    with engine.begin() as conn:
        print("Deleting all courses...")
        conn.execute(text("TRUNCATE TABLE courses CASCADE;"))
        
    print("Database courses cleared successfully.")

if __name__ == "__main__":
    clear_courses()
