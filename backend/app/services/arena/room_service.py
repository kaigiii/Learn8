import random
import string
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.time import utc_now_naive
from app.domain.arena_modes import normalize_arena_mode
from app.domain.arena_statuses import ArenaMatchStatus, ArenaRoomStatus
from app.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.models.arena_room import ArenaRoomModel, ArenaRoomPlayerModel
from app.models.user import UserModel
from app.services.arena.presence_service import PresenceService
from app.services.arena.rank_service import RankService
from app.services.arena.realtime_gateway import RealtimeGateway
from app.services.arena.topic_catalog_service import TopicCatalogService


class RoomService:
    def __init__(self, topic_catalog_service: TopicCatalogService | None = None):
        self.topic_catalog_service = topic_catalog_service or TopicCatalogService()
        self.realtime_gateway = RealtimeGateway()
        self.presence_service = PresenceService(self.realtime_gateway)
        self.rank_service = RankService()

    def _generate_room_code(self, db: Session, length: int = 6) -> str:
        alphabet = string.ascii_uppercase + string.digits
        for _ in range(20):
            code = "".join(random.choice(alphabet) for _ in range(length))
            exists = db.query(ArenaRoomModel.id).filter(ArenaRoomModel.room_code == code).first()
            if not exists:
                return code
        raise HTTPException(status_code=500, detail="Failed to allocate a unique room code")

    def _base_room_query(self, db: Session):
        return db.query(ArenaRoomModel).options(
            selectinload(ArenaRoomModel.players).selectinload(ArenaRoomPlayerModel.user),
            selectinload(ArenaRoomModel.public_course),
        )

    def _latest_room_activity_at(self, room: ArenaRoomModel):
        latest = room.updated_at or room.created_at or utc_now_naive()
        for player in room.players:
            for candidate in (player.last_seen_at, player.updated_at, player.joined_at):
                if candidate and candidate > latest:
                    latest = candidate
        return latest

    def _close_idle_lobby_rooms(self, db: Session) -> int:
        idle_minutes = int(getattr(settings, "ARENA_ROOM_IDLE_CLOSE_MINUTES", 0) or 0)
        if idle_minutes <= 0:
            return 0

        now = utc_now_naive()
        cutoff = now - timedelta(minutes=idle_minutes)
        candidate_rooms = (
            self._base_room_query(db)
            .filter(
                ArenaRoomModel.status == ArenaRoomStatus.LOBBY,
                ArenaRoomModel.closed_at.is_(None),
            )
            .all()
        )

        if not candidate_rooms:
            return 0

        closed_rooms: list[ArenaRoomModel] = []
        for room in candidate_rooms:
            latest_activity_at = self._latest_room_activity_at(room)
            if latest_activity_at > cutoff:
                continue
            room.status = ArenaRoomStatus.CLOSED
            room.closed_at = now
            db.add(room)
            closed_rooms.append(room)

        if not closed_rooms:
            return 0

        for room in closed_rooms:
            self.realtime_gateway.publish_event(
                db,
                stream_type="room",
                room_code=room.room_code,
                match_id=room.latest_match_id,
                event_type="room.closed_idle",
                payload={
                    "roomCode": room.room_code,
                    "status": ArenaRoomStatus.CLOSED,
                    "reason": "idle_timeout",
                    "idleCloseMinutes": idle_minutes,
                },
            )
        db.commit()
        return len(closed_rooms)

    def get_room_by_code(
        self, db: Session, room_code: str, *, cleanup_idle: bool = True
    ) -> ArenaRoomModel | None:
        if cleanup_idle:
            self._close_idle_lobby_rooms(db)
        return (
            self._base_room_query(db)
            .filter(ArenaRoomModel.room_code == room_code.upper())
            .first()
        )

    def get_active_room_for_user(self, db: Session, user_id: int) -> ArenaRoomModel | None:
        self._close_idle_lobby_rooms(db)
        room_player = (
            db.query(ArenaRoomPlayerModel)
            .join(ArenaRoomModel, ArenaRoomModel.id == ArenaRoomPlayerModel.room_id)
            .filter(
                ArenaRoomPlayerModel.user_id == user_id,
                ArenaRoomModel.status.in_((ArenaRoomStatus.LOBBY, ArenaRoomStatus.IN_MATCH)),
            )
            .order_by(ArenaRoomModel.updated_at.desc(), ArenaRoomModel.id.desc())
            .first()
        )
        if not room_player:
            return None
        return self.get_room_by_code(db, room_player.room.room_code, cleanup_idle=False)

    def create_room(
        self,
        db: Session,
        current_user: UserModel,
        *,
        public_course_id: int,
        mode: str,
        visibility: str,
        max_players: int,
        round_count: int,
        round_time_seconds: int,
    ) -> ArenaRoomModel:
        public_course = self.topic_catalog_service.get_enabled_public_course(db, public_course_id)
        if not public_course:
            raise HTTPException(status_code=404, detail="Arena public course not found")

        normalized_mode = normalize_arena_mode(mode)
        active_season = self.rank_service.get_active_season(db)
        room = ArenaRoomModel(
            room_code=self._generate_room_code(db),
            season_id=active_season.id if active_season else None,
            host_user_id=current_user.id,
            public_course_id=public_course_id,
            mode=normalized_mode,
            visibility=visibility,
            max_players=max_players,
            round_count=round_count,
            round_time_seconds=round_time_seconds,
        )
        db.add(room)
        db.flush()

        db.add(
            ArenaRoomPlayerModel(
                room_id=room.id,
                user_id=current_user.id,
                is_ready=False,
                connection_state="connected",
                last_seen_at=utc_now_naive(),
            )
        )
        db.commit()
        room = self.get_room_by_code(db, room.room_code, cleanup_idle=False)
        self.presence_service.touch_room_presence(db, room, current_user)
        db.commit()
        room = self.get_room_by_code(db, room.room_code, cleanup_idle=False)
        self.realtime_gateway.publish_event(
            db,
            stream_type="room",
            room_code=room.room_code,
            event_type="room.created",
            payload=self.serialize_room(room),
        )
        db.commit()
        room = self.get_room_by_code(db, room.room_code, cleanup_idle=False)
        return room

    def join_room(self, db: Session, current_user: UserModel, room_code: str) -> ArenaRoomModel:
        room = self.get_room_by_code(db, room_code)
        if not room:
            raise HTTPException(status_code=404, detail="Arena room not found")
        if room.status != ArenaRoomStatus.LOBBY:
            raise HTTPException(status_code=409, detail="Arena room is not joinable")
        if any(player.user_id == current_user.id for player in room.players):
            return room
        if len(room.players) >= room.max_players:
            raise HTTPException(status_code=409, detail="Arena room is full")

        db.add(
            ArenaRoomPlayerModel(
                room_id=room.id,
                user_id=current_user.id,
                is_ready=False,
                connection_state="connected",
                last_seen_at=utc_now_naive(),
            )
        )
        db.commit()
        room = self.get_room_by_code(db, room.room_code, cleanup_idle=False)
        self.presence_service.touch_room_presence(db, room, current_user)
        db.commit()
        room = self.get_room_by_code(db, room.room_code, cleanup_idle=False)
        self.realtime_gateway.publish_event(
            db,
            stream_type="room",
            room_code=room.room_code,
            event_type="room.player_joined",
            payload={
                "roomCode": room.room_code,
                "userId": current_user.id,
                "playerCount": len(room.players),
                "players": self.serialize_room(room)["players"],
            },
        )
        db.commit()
        room = self.get_room_by_code(db, room.room_code, cleanup_idle=False)
        return room

    def leave_room(self, db: Session, current_user: UserModel, room_code: str) -> None:
        room = self.get_room_by_code(db, room_code)
        if not room:
            raise HTTPException(status_code=404, detail="Arena room not found")

        original_room_code = room.room_code
        player = next((item for item in room.players if item.user_id == current_user.id), None)
        if not player:
            raise HTTPException(status_code=404, detail="Arena room membership not found")

        db.delete(player)
        db.flush()
        db.expire(room, ["players"])

        remaining_players = (
            db.query(ArenaRoomPlayerModel)
            .filter(ArenaRoomPlayerModel.room_id == room.id)
            .order_by(ArenaRoomPlayerModel.joined_at.asc())
            .all()
        )
        if not remaining_players:
            room.status = ArenaRoomStatus.CLOSED
            room.closed_at = utc_now_naive()
        elif room.host_user_id == current_user.id:
            room.host_user_id = remaining_players[0].user_id

        db.commit()
        room = self.get_room_by_code(db, original_room_code, cleanup_idle=False)
        self.realtime_gateway.publish_event(
            db,
            stream_type="room",
            room_code=original_room_code,
            event_type="room.player_left",
            payload={
                "roomCode": original_room_code,
                "userId": current_user.id,
                "hostUserId": room.host_user_id if room else None,
                "status": room.status if room else ArenaRoomStatus.CLOSED,
            },
        )
        db.commit()

    def set_ready(
        self, db: Session, current_user: UserModel, room_code: str, *, is_ready: bool
    ) -> ArenaRoomModel:
        room = self.get_room_by_code(db, room_code)
        if not room:
            raise HTTPException(status_code=404, detail="Arena room not found")
        if room.status != ArenaRoomStatus.LOBBY:
            raise HTTPException(status_code=409, detail="Arena room is no longer in lobby state")

        player = next((item for item in room.players if item.user_id == current_user.id), None)
        if not player:
            raise HTTPException(status_code=404, detail="Arena room membership not found")

        player.is_ready = is_ready
        db.add(player)
        db.commit()
        room = self.get_room_by_code(db, room.room_code, cleanup_idle=False)
        self.presence_service.touch_room_presence(db, room, current_user)
        db.commit()
        room = self.get_room_by_code(db, room.room_code, cleanup_idle=False)
        self.realtime_gateway.publish_event(
            db,
            stream_type="room",
            room_code=room.room_code,
            event_type="room.player_ready_changed",
            payload={
                "roomCode": room.room_code,
                "userId": current_user.id,
                "isReady": bool(is_ready),
                "canStart": self.can_start_room(room),
            },
        )
        db.commit()
        room = self.get_room_by_code(db, room.room_code, cleanup_idle=False)
        return room

    def can_start_room(self, room: ArenaRoomModel) -> bool:
        if room.status != ArenaRoomStatus.LOBBY:
            return False
        if len(room.players) < 2:
            return False
        non_host_players = [player for player in room.players if player.user_id != room.host_user_id]
        return all(player.is_ready for player in non_host_players) and len(non_host_players) > 0

    def start_room_match(self, db: Session, current_user: UserModel, room_code: str) -> ArenaMatchModel:
        room = self.get_room_by_code(db, room_code)
        if not room:
            raise HTTPException(status_code=404, detail="Arena room not found")
        if room.host_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the host can start the Arena room")
        if not self.can_start_room(room):
            raise HTTPException(status_code=409, detail="Arena room is not ready to start")

        room_snapshot = {
            "room_code": room.room_code,
            "host_user_id": room.host_user_id,
            "player_ids": [player.user_id for player in room.players],
            "public_course_id": room.public_course_id,
        }
        rules_snapshot = {
            "round_count": room.round_count,
            "round_time_seconds": room.round_time_seconds,
            "max_players": room.max_players,
            "mode": room.mode,
        }
        match = ArenaMatchModel(
            room_id=room.id,
            season_id=room.season_id,
            public_course_id=room.public_course_id,
            mode=room.mode,
            status=ArenaMatchStatus.IN_PROGRESS,
            player_count=len(room.players),
            round_count=room.round_count,
            completed_round_count=0,
            room_snapshot_json=room_snapshot,
            rules_snapshot_json=rules_snapshot,
            started_at=utc_now_naive(),
        )
        db.add(match)
        db.flush()

        for player in room.players:
            db.add(
                ArenaMatchPlayerModel(
                    match_id=match.id,
                    user_id=player.user_id,
                    connection_state=player.connection_state or "connected",
                    disconnect_count=player.disconnect_count or 0,
                    last_seen_at=player.last_seen_at,
                    disconnected_at=player.disconnected_at,
                    reconnected_at=player.reconnected_at,
                    suspected_abandonment=False,
                    suspicious_low_latency_count=0,
                    low_latency_streak=0,
                )
            )

        room.status = ArenaRoomStatus.IN_MATCH
        room.latest_match_id = match.id
        db.add(room)
        db.commit()
        db.refresh(match)
        room = self.get_room_by_code(db, room.room_code, cleanup_idle=False)
        if room:
            self.presence_service.touch_room_presence(db, room, current_user)
            db.commit()
        self.realtime_gateway.publish_event(
            db,
            stream_type="room",
            room_code=room.room_code,
            match_id=match.id,
            event_type="match.started",
            payload={
                "roomCode": room.room_code,
                "matchId": match.id,
                "playerIds": [player.user_id for player in room.players],
                "mode": room.mode,
            },
        )
        db.commit()
        match = db.query(ArenaMatchModel).filter(ArenaMatchModel.id == match.id).first()
        return match

    def serialize_room(self, room: ArenaRoomModel) -> dict:
        sorted_players = sorted(room.players, key=lambda item: (item.user_id != room.host_user_id, item.joined_at))
        presence_map = self.presence_service.build_room_presence_map(room)
        return {
            "roomCode": room.room_code,
            "hostUserId": room.host_user_id,
            "publicCourseId": room.public_course_id,
            "publicCourseTitle": room.public_course.title if room.public_course else "Unknown",
            "mode": room.mode,
            "visibility": room.visibility,
            "status": room.status,
            "maxPlayers": room.max_players,
            "roundCount": room.round_count,
            "roundTimeSeconds": room.round_time_seconds,
            "playerCount": len(sorted_players),
            "canStart": self.can_start_room(room),
            "players": [
                {
                    "userId": player.user_id,
                    "displayName": player.user.full_name or player.user.email.split("@")[0],
                    "isHost": player.user_id == room.host_user_id,
                    "isReady": bool(player.is_ready),
                    "team": player.team,
                    "joinedAt": player.joined_at.isoformat(),
                    "connectionState": presence_map.get(player.user_id, {}).get("connectionState"),
                }
                for player in sorted_players
            ],
            "latestMatchId": room.latest_match_id,
            "createdAt": room.created_at.isoformat(),
            "updatedAt": room.updated_at.isoformat(),
        }
