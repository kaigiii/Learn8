import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.time import utc_now
from app.db.base import Base
from app.arena.config import arena_settings
from app.arena.domain.arena_modes import ArenaMode
from app.arena.domain.arena_statuses import (
    ArenaInviteStatus,
    ArenaRoomStatus,
    ArenaRoomVisibility,
)


class ArenaRoomModel(Base):
    __tablename__ = "arena_rooms"
    __table_args__ = (
        UniqueConstraint("room_code", name="uq_arena_rooms_room_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    room_code = Column(String(12), nullable=False, index=True)
    season_id = Column(Integer, ForeignKey("arena_seasons.id", ondelete="SET NULL"), nullable=True, index=True)
    host_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    public_course_id = Column(Integer, ForeignKey("public_courses.id", ondelete="RESTRICT"), nullable=False, index=True)
    question_pool_id = Column(Integer, ForeignKey("arena_question_pools.id", ondelete="SET NULL"), nullable=True, index=True)
    mode = Column(String, nullable=False, default=ArenaMode.PRIVATE_ROOM, index=True)
    visibility = Column(String, nullable=False, default=ArenaRoomVisibility.PRIVATE)
    status = Column(String, nullable=False, default=ArenaRoomStatus.LOBBY, index=True)
    max_players = Column(Integer, nullable=False, default=arena_settings.ARENA_DEFAULT_MAX_PLAYERS)
    round_count = Column(Integer, nullable=False, default=arena_settings.ARENA_DEFAULT_ROUND_COUNT)
    round_time_seconds = Column(Integer, nullable=False, default=arena_settings.ARENA_DEFAULT_ROUND_TIME_SECONDS)
    allow_rematch = Column(Boolean, nullable=False, default=True)
    room_settings_json = Column(JSON, nullable=True)
    latest_match_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    public_course = relationship("PublicCourseModel")
    question_pool = relationship("ArenaQuestionPoolModel")
    players = relationship(
        "ArenaRoomPlayerModel",
        back_populates="room",
        cascade="all, delete-orphan",
        passive_deletes=True,
        foreign_keys="ArenaRoomPlayerModel.room_id",
    )

class ArenaRoomPlayerModel(Base):
    __tablename__ = "arena_room_players"
    __table_args__ = (
        UniqueConstraint("room_id", "user_id", name="uq_arena_room_players_room_user"),
        Index("ix_arena_room_players_room_ready", "room_id", "is_ready"),
        Index("ix_arena_room_players_room_connection", "room_id", "connection_state"),
    )

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("arena_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_ready = Column(Boolean, nullable=False, default=False)
    connection_state = Column(String, nullable=False, default="connected", index=True)
    disconnect_count = Column(Integer, nullable=False, default=0)
    last_seen_at = Column(DateTime(timezone=True), nullable=True)
    disconnected_at = Column(DateTime(timezone=True), nullable=True)
    reconnected_at = Column(DateTime(timezone=True), nullable=True)
    team = Column(String, nullable=True)
    user_snapshot_json = Column(JSON, nullable=True)
    joined_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    room = relationship("ArenaRoomModel", back_populates="players", foreign_keys=[room_id])
    user = relationship("UserModel")


class ArenaInviteModel(Base):
    __tablename__ = "arena_invites"
    __table_args__ = (
        UniqueConstraint("invite_token", name="uq_arena_invites_invite_token"),
    )

    id = Column(Integer, primary_key=True, index=True)
    invite_token = Column(String(36), nullable=False, default=lambda: str(uuid.uuid4()))
    room_id = Column(Integer, ForeignKey("arena_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    inviter_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    invitee_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    status = Column(String, nullable=False, default=ArenaInviteStatus.PENDING, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    room = relationship("ArenaRoomModel")
