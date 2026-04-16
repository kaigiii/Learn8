from __future__ import annotations

import json
import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.time import to_iso_utc
from app.arena.models.arena_event import ArenaEventModel

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
        from app.core.redis import redis_sync_client
        try:
            full_payload = serialize_arena_event(event)
            payload_str = json.dumps(full_payload)
            
            if event.stream_type == "match" and event.match_id:
                channel = f"arena:match:{event.match_id}"
                redis_sync_client.publish(channel, payload_str)
            elif event.stream_type == "room" and event.room_code:
                channel = f"arena:room:{event.room_code}"
                redis_sync_client.publish(channel, payload_str)
            
            # Also publish to a global channel for system-wide monitoring
            redis_sync_client.publish("arena:global", payload_str)
        except Exception:
            logger.exception("Failed to publish Redis event %s", event.event_id)


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
        "createdAt": to_iso_utc(event.created_at),
    }
