import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

def check():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        from app.core.config import settings
        db_url = settings.DATABASE_URL
    engine = create_engine(db_url)
    with engine.begin() as conn:
        res = conn.execute(text("SELECT count(*) FROM courses;"))
        count = res.scalar()
        print(f"Courses in DB: {count}")

if __name__ == "__main__":
    check()
