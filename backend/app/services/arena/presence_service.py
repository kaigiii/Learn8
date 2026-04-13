from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.time import utc_now, to_iso_utc
from app.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.models.arena_room import ArenaRoomModel, ArenaRoomPlayerModel
from app.models.user import UserModel
from app.services.arena.realtime_gateway import RealtimeGateway


class PresenceService:
    DISCONNECT_AFTER_SECONDS = 12
    ABANDON_AFTER_SECONDS = 45
    SUSPICIOUS_LOW_LATENCY_MS = 350
    SUSPICIOUS_STREAK_THRESHOLD = 3

    def __init__(self, realtime_gateway: RealtimeGateway | None = None):
        self.realtime_gateway = realtime_gateway or RealtimeGateway()

    def touch_room_presence(self, db: Session, room: ArenaRoomModel, current_user: UserModel) -> None:
        self.sweep_room_presence(db, room)
        now = utc_now()
        player = next((item for item in room.players if item.user_id == current_user.id), None)
        if not player:
            return

        previous_state = player.connection_state
        player.connection_state = "connected"
        player.last_seen_at = now
        if previous_state == "disconnected":
            player.reconnected_at = now
        db.add(player)

        if previous_state == "disconnected":
            self.realtime_gateway.publish_event(
                db,
                stream_type="room",
                room_code=room.room_code,
                match_id=room.latest_match_id,
                event_type="player.reconnected",
                payload={
                    "scope": "room",
                    "roomCode": room.room_code,
                    "userId": current_user.id,
                    "displayName": current_user.full_name or current_user.email.split("@")[0],
                },
            )

    def sweep_room_presence(self, db: Session, room: ArenaRoomModel) -> None:
        now = utc_now()
        for player in room.players:
            if player.connection_state != "connected":
                continue
            last_seen_at = player.last_seen_at
            if not last_seen_at:
                continue
            if (now - last_seen_at).total_seconds() < self.DISCONNECT_AFTER_SECONDS:
                continue

            player.connection_state = "disconnected"
            player.disconnected_at = now
            player.disconnect_count = int(player.disconnect_count or 0) + 1
            db.add(player)
            self.realtime_gateway.publish_event(
                db,
                stream_type="room",
                room_code=room.room_code,
                match_id=room.latest_match_id,
                event_type="player.disconnected",
                payload={
                    "scope": "room",
                    "roomCode": room.room_code,
                    "userId": player.user_id,
                    "displayName": self._display_name_for_room_player(player),
                },
            )

    def touch_match_presence(self, db: Session, match: ArenaMatchModel, current_user: UserModel) -> None:
        self.sweep_match_presence(db, match)
        player = next((item for item in match.players if item.user_id == current_user.id), None)
        if not player:
            return

        now = utc_now()
        previous_state = player.connection_state
        player.connection_state = "connected"
        player.last_seen_at = now
        if previous_state == "disconnected":
            player.reconnected_at = now
        db.add(player)

        if previous_state == "disconnected":
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
                match_id=match.id,
                event_type="player.reconnected",
                payload={
                    "scope": "match",
                    "matchId": match.id,
                    "userId": current_user.id,
                    "displayName": current_user.full_name or current_user.email.split("@")[0],
                },
            )

    def sweep_match_presence(self, db: Session, match: ArenaMatchModel) -> None:
        now = utc_now()
        for player in match.players:
            if player.connection_state != "connected":
                continue
            last_seen_at = player.last_seen_at
            if not last_seen_at:
                continue
            elapsed = (now - last_seen_at).total_seconds()
            if elapsed < self.DISCONNECT_AFTER_SECONDS:
                continue

            player.connection_state = "disconnected"
            player.disconnected_at = now
            player.disconnect_count = int(player.disconnect_count or 0) + 1
            if elapsed >= self.ABANDON_AFTER_SECONDS:
                player.suspected_abandonment = True
            db.add(player)
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
                match_id=match.id,
                event_type="player.disconnected",
                payload={
                    "scope": "match",
                    "matchId": match.id,
                    "userId": player.user_id,
                    "displayName": player.user.full_name or player.user.email.split("@")[0],
                },
            )

    def record_answer_submission(
        self,
        db: Session,
        *,
        match: ArenaMatchModel,
        user_id: int,
        response_time_ms: int | None,
    ) -> None:
        if response_time_ms is None:
            return

        player = next((item for item in match.players if item.user_id == user_id), None)
        if not player:
            return

        streak = int(player.low_latency_streak or 0)
        suspicious_count = int(player.suspicious_low_latency_count or 0)

        if response_time_ms <= self.SUSPICIOUS_LOW_LATENCY_MS:
            streak += 1
            if streak >= self.SUSPICIOUS_STREAK_THRESHOLD:
                suspicious_count += 1
        else:
            streak = 0

        player.low_latency_streak = streak
        player.suspicious_low_latency_count = suspicious_count
        player.last_answer_response_ms = response_time_ms
        db.add(player)

    def build_match_presence_states(self, match: ArenaMatchModel) -> list[dict]:
        items: list[dict] = []
        for player in match.players:
            items.append(
                {
                    "userId": player.user_id,
                    "connectionState": player.connection_state or "unknown",
                    "lastSeenAt": to_iso_utc(player.last_seen_at),
                    "disconnectedAt": to_iso_utc(player.disconnected_at),
                    "disconnectCount": int(player.disconnect_count or 0),
                    "suspectedAbandonment": bool(player.suspected_abandonment),
                    "isAccepted": player.accepted_at is not None,
                }
            )
        return items

    def build_room_presence_map(self, room: ArenaRoomModel) -> dict[int, dict]:
        return {
            player.user_id: {
                "connectionState": player.connection_state or "unknown",
                "lastSeenAt": to_iso_utc(player.last_seen_at),
                "disconnectedAt": to_iso_utc(player.disconnected_at),
                "disconnectCount": int(player.disconnect_count or 0),
            }
            for player in room.players
        }

    def _display_name_for_room_player(self, player: ArenaRoomPlayerModel | None) -> str:
        if player and player.user:
            return player.user.full_name or player.user.email.split("@")[0]
        return "Player"
