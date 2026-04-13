import sys
import os

# Add the backend directory to the sys.path
sys.path.append(os.getcwd())

from sqlalchemy import text
from app.db.session import SessionLocal

def cleanup_arena():
    db = SessionLocal()
    try:
        print("Starting Arena database cleanup...")
        
        # Order matters for foreign key constraints
        tables_to_clear = [
            "arena_answers",
            "arena_rounds",
            "arena_match_players",
            "arena_matches",
            "arena_queue_entries",
            "arena_events",
            "arena_room_players",
            "arena_invites",
            "arena_rooms",
            "arena_rank_history",
            "arena_player_topic_ratings",
            "arena_ratings"
        ]
        
        for table in tables_to_clear:
            try:
                print(f"Purging table: {table}")
                db.execute(text(f"DELETE FROM {table}"))
            except Exception as e:
                print(f"Warning: Could not clear table {table} (it might not exist or has complex constraints): {e}")
        
        db.commit()
        print("Arena database cleanup completed successfully.")
        print("All users should now be 'unlocked' from any zombie matches.")
        
    except Exception as e:
        db.rollback()
        print(f"Error during cleanup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_arena()
