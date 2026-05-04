from app.db.session import engine
from app.db.base import Base
from app.db import registry

def drop_all():
    Base.metadata.drop_all(bind=engine)

drop_all()
