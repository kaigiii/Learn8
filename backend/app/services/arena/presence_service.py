from __future__ import annotations

from copy import deepcopy

from sqlalchemy.orm import Session

from app.core.time import utc_now_naive
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
        presence_map = self._get_room_presence_map(room)
        now = utc_now_naive()
        user_key = str(current_user.id)
        previous = deepcopy(presence_map.get(user_key) or {})
        state = dict(previous)
        state["connection_state"] = "connected"
        state["last_seen_at"] = now.isoformat()
        state.setdefault("disconnect_count", 0)
        presence_map[user_key] = state
        room.room_settings_json = self._with_room_presence(room, presence_map)
        db.add(room)

        if previous.get("connection_state") == "disconnected":
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
        presence_map = self._get_room_presence_map(room)
        if not presence_map:
            return

        now = utc_now_naive()
        changed = False
        players_by_user_id = {player.user_id: player for player in room.players}

        for user_key, state in presence_map.items():
            if state.get("connection_state") != "connected":
                continue
            last_seen_at = self._parse_iso_datetime(state.get("last_seen_at"))
            if not last_seen_at:
                continue
            if (now - last_seen_at).total_seconds() < self.DISCONNECT_AFTER_SECONDS:
                continue

            user_id = int(user_key)
            player = players_by_user_id.get(user_id)
            state["connection_state"] = "disconnected"
            state["disconnected_at"] = now.isoformat()
            state["disconnect_count"] = int(state.get("disconnect_count") or 0) + 1
            changed = True
            self.realtime_gateway.publish_event(
                db,
                stream_type="room",
                room_code=room.room_code,
                match_id=room.latest_match_id,
                event_type="player.disconnected",
                payload={
                    "scope": "room",
                    "roomCode": room.room_code,
                    "userId": user_id,
                    "displayName": self._display_name_for_room_player(player),
                },
            )

        if changed:
            room.room_settings_json = self._with_room_presence(room, presence_map)
            db.add(room)

    def touch_match_presence(self, db: Session, match: ArenaMatchModel, current_user: UserModel) -> None:
        self.sweep_match_presence(db, match)
        player = next((item for item in match.players if item.user_id == current_user.id), None)
        if not player:
            return

        metadata = self._get_match_player_metadata(player)
        now = utc_now_naive()
        previous_state = metadata.get("connection_state")
        metadata["connection_state"] = "connected"
        metadata["last_seen_at"] = now.isoformat()
        metadata.setdefault("disconnect_count", 0)
        player.metadata_json = metadata
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
        now = utc_now_naive()
        for player in match.players:
            metadata = self._get_match_player_metadata(player)
            if metadata.get("connection_state") != "connected":
                continue
            last_seen_at = self._parse_iso_datetime(metadata.get("last_seen_at"))
            if not last_seen_at:
                continue
            elapsed = (now - last_seen_at).total_seconds()
            if elapsed < self.DISCONNECT_AFTER_SECONDS:
                continue

            metadata["connection_state"] = "disconnected"
            metadata["disconnected_at"] = now.isoformat()
            metadata["disconnect_count"] = int(metadata.get("disconnect_count") or 0) + 1
            if elapsed >= self.ABANDON_AFTER_SECONDS:
                metadata["suspected_abandonment"] = True
            player.metadata_json = metadata
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

        metadata = self._get_match_player_metadata(player)
        streak = int(metadata.get("low_latency_streak") or 0)
        suspicious_count = int(metadata.get("suspicious_low_latency_count") or 0)

        if response_time_ms <= self.SUSPICIOUS_LOW_LATENCY_MS:
            streak += 1
            if streak >= self.SUSPICIOUS_STREAK_THRESHOLD:
                suspicious_count += 1
        else:
            streak = 0

        metadata["low_latency_streak"] = streak
        metadata["suspicious_low_latency_count"] = suspicious_count
        metadata["last_answer_response_ms"] = response_time_ms
        player.metadata_json = metadata
        db.add(player)

    def build_match_presence_states(self, match: ArenaMatchModel) -> list[dict]:
        items: list[dict] = []
        for player in match.players:
            metadata = self._get_match_player_metadata(player)
            items.append(
                {
                    "userId": player.user_id,
                    "connectionState": metadata.get("connection_state") or "unknown",
                    "lastSeenAt": metadata.get("last_seen_at"),
                    "disconnectedAt": metadata.get("disconnected_at"),
                    "disconnectCount": int(metadata.get("disconnect_count") or 0),
                    "suspectedAbandonment": bool(metadata.get("suspected_abandonment")),
                }
            )
        return items

    def build_room_presence_map(self, room: ArenaRoomModel) -> dict[int, dict]:
        raw = self._get_room_presence_map(room)
        return {
            int(user_id): {
                "connectionState": state.get("connection_state") or "unknown",
                "lastSeenAt": state.get("last_seen_at"),
                "disconnectedAt": state.get("disconnected_at"),
                "disconnectCount": int(state.get("disconnect_count") or 0),
            }
            for user_id, state in raw.items()
        }

    def _get_match_player_metadata(self, player: ArenaMatchPlayerModel) -> dict:
        return dict(player.metadata_json or {})

    def _get_room_presence_map(self, room: ArenaRoomModel) -> dict:
        settings = room.room_settings_json if isinstance(room.room_settings_json, dict) else {}
        presence = settings.get("presence")
        return dict(presence) if isinstance(presence, dict) else {}

    def _with_room_presence(self, room: ArenaRoomModel, presence_map: dict) -> dict:
        settings = dict(room.room_settings_json or {})
        settings["presence"] = presence_map
        return settings

    def _display_name_for_room_player(self, player: ArenaRoomPlayerModel | None) -> str:
        if player and player.user:
            return player.user.full_name or player.user.email.split("@")[0]
        return "Player"

    def _parse_iso_datetime(self, value: object):
        from datetime import datetime

        if not isinstance(value, str) or not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
