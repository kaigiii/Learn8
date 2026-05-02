from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.time import utc_now
from app.db.base import Base


class FriendModel(Base):
    __tablename__ = "friends"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    friend_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, default="pending", nullable=False)  # pending, accepted, blocked
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("UserModel", foreign_keys=[user_id])
    friend = relationship("UserModel", foreign_keys=[friend_id])
