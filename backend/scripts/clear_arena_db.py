import os
from sqlalchemy import create_engine, text

# Use the environment-specific connection string
DB_URL = "postgresql://localhost:5432/learn8_db"

TABLES_TO_TRUNCATE = [
    "arena_events",
    "arena_match_players",
    "arena_matches",
    "arena_rounds",
    "arena_answers",
    "arena_queue_entries",
    "arena_rooms",
    "arena_room_players",
    "arena_ratings" # Optional: Can be cleared or reset manually
]

def clear_db():
    print(f"Connecting to {DB_URL}...")
    engine = create_engine(DB_URL)
    
    with engine.connect() as conn:
        print("Clearing Arena transaction tables...")
        # Use CASCADE to handle dependencies (like match_players -> matches)
        # Using a list string for TRUNCATE is more efficient
        tables_str = ", ".join(TABLES_TO_TRUNCATE)
        conn.execute(text(f"TRUNCATE TABLE {tables_str} CASCADE;"))
        
        # Reset ratings to 1000 for all existing users if they were NOT truncated
        # Actually, since I truncated 'arena_ratings', they will be empty. 
        # The service will automatically create new 1000 entries when needed.
        
        conn.commit()
        print("Cleanup successful.")

if __name__ == "__main__":
    clear_db()
