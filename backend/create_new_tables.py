import os
import sys
from sqlalchemy import create_engine

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.db.base import Base
from app.db import registry

def create_tables():
    db_url = settings.DATABASE_URL
    print(f"Creating missing tables for {db_url}...")
    engine = create_engine(db_url)
    Base.metadata.create_all(engine)
    print("Creation done.")

if __name__ == "__main__":
    create_tables()
