import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the app directory to the path so we can import app
sys.path.append(os.path.join(os.getcwd(), 'backend'))

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/learn8")

def reset_arena_db():
    print(f"Connecting to database: {DATABASE_URL}")
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    tables_to_truncate = [
        "arena_match_players",
        "arena_rounds",
        "arena_matches",
        "arena_question_pool_items",
        "arena_question_pools"
    ]
    
    try:
        print("Truncating Arena tables...")
        # We use CASCADE to handle foreign key dependencies
        for table in tables_to_truncate:
            print(f"Truncating {table}...")
            db.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
        
        db.commit()
        print("Success! Arena tables have been wiped.")
    except Exception as e:
        db.rollback()
        print(f"Error during truncation: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_arena_db()
