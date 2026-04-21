from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_size=20,          # Increase base connections
    max_overflow=30,      # Increase allowed overflow
    pool_pre_ping=True,   # Ensure stale connections are dropped
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
