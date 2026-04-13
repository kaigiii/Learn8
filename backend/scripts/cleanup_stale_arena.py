from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, text

DB_URL = "postgresql://localhost:5432/learn8_db"

def cleanup_stale():
    print(f"Connecting to {DB_URL}...")
    engine = create_engine(DB_URL)
    
    with engine.connect() as conn:
        now = datetime.now(timezone.utc)
        print(f"Starting selective cleanup at {now}")

        # 1. Cancel all PENDING matches (matched but not accepted)
        print("Cancelling PENDING matches...")
        res = conn.execute(text("""
            UPDATE arena_matches 
            SET status = 'cancelled', ended_at = :now 
            WHERE status = 'pending';
        """), {"now": now})
        print(f"  -> Cancelled {res.rowcount} pending matches.")

        # 2. Finish very old IN_PROGRESS matches (older than 15 mins)
        cutoff = now - timedelta(minutes=15)
        print(f"Finishing stale IN_PROGRESS matches (started before {cutoff})...")
        res = conn.execute(text("""
            UPDATE arena_matches 
            SET status = 'finished', ended_at = :now 
            WHERE status = 'in_progress' AND (started_at < :cutoff OR started_at IS NULL);
        """), {"now": now, "cutoff": cutoff})
        print(f"  -> Finished {res.rowcount} stale matches.")

        # 3. Cancel ALL active queue entries linked to finished/cancelled matches
        print("Cleaning up ghost queue entries...")
        res = conn.execute(text("""
            UPDATE arena_queue_entries
            SET status = 'cancelled', closed_at = :now
            WHERE status IN ('waiting', 'matched')
            AND (
                match_id IS NULL 
                OR match_id IN (SELECT id FROM arena_matches WHERE status IN ('finished', 'cancelled'))
            );
        """), {"now": now})
        print(f"  -> Deactivated {res.rowcount} queue entries.")

        # 4. Reset Rooms
        print("Resetting rooms to lobby...")
        res = conn.execute(text("""
            UPDATE arena_rooms
            SET status = 'lobby'
            WHERE status = 'in_match';
        """))
        print(f"  -> Reset {res.rowcount} rooms.")

        conn.commit()
        print("\nArena state is now CLEAN.")

if __name__ == "__main__":
    cleanup_stale()
