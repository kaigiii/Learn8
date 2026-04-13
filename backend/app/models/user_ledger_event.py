from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.time import utc_now
from app.db.base import Base


class UserLedgerEventModel(Base):
    __tablename__ = "user_ledger_events"
    __table_args__ = (
        UniqueConstraint("event_key", name="uq_user_ledger_events_event_key"),
        Index("ix_user_ledger_events_user_event_type", "user_id", "event_type"),
        Index("ix_user_ledger_events_user_created_at", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String, nullable=False, index=True)
    event_key = Column(String, nullable=True)
    credits_delta = Column(Integer, nullable=False, default=0)
    xp_delta = Column(Integer, nullable=False, default=0)
    credits_balance_after = Column(Integer, nullable=False, default=0)
    xp_balance_after = Column(Integer, nullable=False, default=0)
    level_after = Column(Integer, nullable=False, default=1)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    user = relationship("UserModel", back_populates="ledger_events")
