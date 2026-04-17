from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.time import utc_now, to_iso_utc, ensure_aware
from app.arena.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.arena.models.arena_room import ArenaRoomModel, ArenaRoomPlayerModel
from app.models.user import UserModel
from app.arena.services.realtime_gateway import RealtimeGateway
from app.core.redis import redis_sync_client


class PresenceService:
    DISCONNECT_AFTER_SECONDS = 12
    ABANDON_AFTER_SECONDS = 30
    SUSPICIOUS_LOW_LATENCY_MS = 350
    SUSPICIOUS_STREAK_THRESHOLD = 3

    def __init__(self, realtime_gateway: RealtimeGateway | None = None):
        self.realtime_gateway = realtime_gateway or RealtimeGateway()

    def touch_room_presence(self, db: Session, room: ArenaRoomModel, current_user: UserModel) -> None:
        # DB heartbeats are deprecated. Redis TTL is handled by WebSocket management.
        try:
            redis_sync_client.setex(f"presence:user:{current_user.id}", 30, "online")
        except Exception:
            pass

    def sweep_room_presence(self, db: Session, room: ArenaRoomModel) -> None:
        now = utc_now()
        for player in room.players:
            if player.connection_state != "connected":
                continue
                
            try:
                is_online = redis_sync_client.exists(f"presence:user:{player.user_id}")
            except Exception:
                # Fail open if redis is down
                is_online = True
                
            if is_online:
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
        # DB heartbeats are deprecated. Redis TTL is handled by WebSocket management.
        try:
            redis_sync_client.setex(f"presence:user:{current_user.id}", 30, "online")
        except Exception:
            pass
            
        # Reconnect logic if they were marked disconnected in DB
        player = next((p for p in match.players if p.user_id == current_user.id), None)
        if player and player.connection_state == "disconnected":
            player.connection_state = "connected"
            player.reconnected_at = utc_now()
            db.add(player)
            self.realtime_gateway.publish_event(
                db,
                stream_type="match",
                room_code=match.room_snapshot_json.get("room_code") if isinstance(match.room_snapshot_json, dict) else None,
                match_id=match.id,
                event_type="player.reconnected",
                payload={
                    "scope": "match",
                    "matchId": match.id,
                    "userId": player.user_id,
                    "displayName": (player.user_snapshot_json or {}).get("displayName") 
                        or player.user.full_name 
                        or player.user.email.split("@")[0],
                },
            )

    def sweep_match_presence(self, db: Session, match: ArenaMatchModel) -> None:
        now = utc_now()
        for player in match.players:
            if player.connection_state != "connected":
                continue
                
            try:
                is_online = redis_sync_client.exists(f"presence:user:{player.user_id}")
            except Exception:
                # Fail open if redis is down
                is_online = True
                
            if is_online:
                continue

            player.connection_state = "disconnected"
            player.disconnected_at = now
            player.disconnect_count = int(player.disconnect_count or 0) + 1
            # In the Redis setup, 30s TTL means they've been gone 30 seconds already
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
                    "displayName": (player.user_snapshot_json or {}).get("displayName") 
                        or player.user.full_name 
                        or player.user.email.split("@")[0],
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
        if player:
            if player.user_snapshot_json and player.user_snapshot_json.get("displayName"):
                return player.user_snapshot_json["displayName"]
            if player.user:
                return player.user.full_name or player.user.email.split("@")[0]
        return "Player"
