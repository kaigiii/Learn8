import os
import sys
from sqlalchemy import create_engine, text

# Add the backend directory to sys.path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.db.base import Base
from app.db import registry  # Important: This imports all models to Base.metadata

def full_reset():
    db_url = settings.DATABASE_URL
    print(f"Danger! Resetting database at {db_url}")
    
    engine = create_engine(db_url)
    
    with engine.begin() as conn:
        print("Dropping all existing tables in 'public' schema...")
        # Drop all tables recorded in metadata
        Base.metadata.drop_all(conn)
        
        # Also handle alembic_version table which is not in Base.metadata
        conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE;"))
        
        print("Recreating all tables from latest models...")
        Base.metadata.create_all(conn)
        
    print("Database reset and schema recreation successful.")

if __name__ == "__main__":
    confirm = input("This will DELETE ALL DATA. Type 'RESET' to confirm: ")
    if confirm == "RESET":
        full_reset()
    else:
        print("Reset aborted.")
