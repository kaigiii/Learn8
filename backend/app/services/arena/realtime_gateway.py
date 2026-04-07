from __future__ import annotations

import json
import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.arena_event import ArenaEventModel

logger = logging.getLogger(__name__)

ARENA_EVENT_CHANNEL = "arena_channel"


class RealtimeGateway:
    def publish_event(
        self,
        db: Session,
        *,
        stream_type: str,
        event_type: str,
        payload: dict,
        room_code: str | None = None,
        match_id: int | None = None,
        version: int = 1,
    ) -> ArenaEventModel:
        event = ArenaEventModel(
            stream_type=stream_type,
            room_code=room_code.upper() if isinstance(room_code, str) else None,
            match_id=match_id,
            event_type=event_type,
            version=version,
            payload_json=payload or {},
        )
        db.add(event)
        db.flush()
        self._publish_notify(db, event)
        return event

    def list_events(
        self,
        db: Session,
        *,
        room_code: str | None = None,
        match_id: int | None = None,
        after_cursor: int = 0,
        limit: int = 100,
    ) -> list[ArenaEventModel]:
        query = db.query(ArenaEventModel).filter(ArenaEventModel.id > max(after_cursor, 0))
        if room_code is not None:
            query = query.filter(ArenaEventModel.room_code == room_code.upper())
        if match_id is not None:
            query = query.filter(ArenaEventModel.match_id == match_id)
        return query.order_by(ArenaEventModel.id.asc()).limit(min(max(limit, 1), 500)).all()

    def _publish_notify(self, db: Session, event: ArenaEventModel) -> None:
        bind = db.get_bind()
        if bind is None or bind.dialect.name != "postgresql":
            return

        payload = {
            "cursor": event.id,
            "event_id": event.event_id,
            "stream_type": event.stream_type,
            "room_code": event.room_code,
            "match_id": event.match_id,
            "event_type": event.event_type,
            "version": event.version,
        }
        payload_str = json.dumps(payload)
        try:
            db.execute(
                text("SELECT pg_notify(:channel, :payload)"),
                {"channel": ARENA_EVENT_CHANNEL, "payload": payload_str},
            )
        except Exception:
            logger.exception("Failed to publish PostgreSQL NOTIFY for arena event %s", event.event_id)


def serialize_arena_event(event: ArenaEventModel) -> dict:
    return {
        "cursor": event.id,
        "eventId": event.event_id,
        "streamType": event.stream_type,
        "roomCode": event.room_code,
        "matchId": event.match_id,
        "eventType": event.event_type,
        "version": event.version,
        "payload": event.payload_json if isinstance(event.payload_json, dict) else {},
        "createdAt": event.created_at.isoformat(),
    }
