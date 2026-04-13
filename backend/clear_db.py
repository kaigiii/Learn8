import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def clear_database():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL not found in .env")
        return

    print(f"Connecting to: {db_url}")
    engine = create_engine(db_url)
    
    with engine.connect() as conn:
        print("Dropping all tables in public schema...")
        # Get names of all tables
        result = conn.execute(text("""
            SELECT tablename FROM pg_catalog.pg_tables 
            WHERE schemaname = 'public'
        """))
        tables = [row[0] for row in result]
        
        if not tables:
            print("No tables found in public schema.")
        else:
            for table in tables:
                print(f"Dropping table {table}...")
                conn.execute(text(f'DROP TABLE IF EXISTS "{table}" CASCADE'))
            
        print("Dropping all sequences...")
        result = conn.execute(text("""
            SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE c.relkind = 'S' AND n.nspname = 'public'
        """))
        sequences = [row[0] for row in result]
        for seq in sequences:
            conn.execute(text(f'DROP SEQUENCE IF EXISTS "{seq}" CASCADE'))
            
        conn.commit()
    print("Database cleared successfully.")

if __name__ == "__main__":
    clear_database()
