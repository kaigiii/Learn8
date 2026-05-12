import random
import string
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.arena.config import arena_settings
from app.core.time import utc_now, to_iso_utc, ensure_aware
from app.arena.domain.arena_modes import RANKED_ARENA_MODES
from app.arena.domain.arena_statuses import ArenaMatchStatus, ArenaRoomStatus
from app.arena.models.arena_match import ArenaMatchModel, ArenaMatchPlayerModel
from app.arena.models.arena_question_pool import ArenaQuestionPoolModel
from app.arena.models.arena_room import ArenaRoomModel, ArenaRoomPlayerModel
from app.models.user import UserModel
from app.arena.services.presence_service import PresenceService
from app.arena.services.rank_service import RankService
from app.arena.services.realtime_gateway import RealtimeGateway
from app.arena.services.topic_catalog_service import TopicCatalogService
from app.arena.utils.profile_utils import build_user_snapshot


class RoomService:
    ALLOWED_QUESTION_TYPES = {
        "MultipleChoice",
        "MatchingPairs",
        "Ordering",
        "FeynmanMirror",
        "ExplainerMedia",
    }

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
            selectinload(ArenaRoomModel.question_pool),
        )

    def _latest_room_activity_at(self, room: ArenaRoomModel):
        latest = ensure_aware(room.updated_at or room.created_at) or utc_now()
        for player in room.players:
            for candidate in (ensure_aware(player.last_seen_at), ensure_aware(player.updated_at), ensure_aware(player.joined_at)):
                if candidate and candidate > latest:
                    latest = candidate
        return latest

    def sweep_stale_rooms(self, db: Session) -> int:
        from app.arena.domain.arena_statuses import ArenaMatchStatus, ArenaRoomStatus
        from app.arena.models.arena_match import ArenaMatchModel
        
        stale_rooms = (
            db.query(ArenaRoomModel)
            .filter(ArenaRoomModel.status == ArenaRoomStatus.IN_MATCH)
            .all()
        )
        if not stale_rooms:
            return 0
            
        count = 0
        for room in stale_rooms:
            # Check if the latest_match is finished or cancelled
            if not room.latest_match_id:
                room.status = ArenaRoomStatus.LOBBY
                db.add(room)
                count += 1
                continue
                
            match = db.query(ArenaMatchModel).filter(ArenaMatchModel.id == room.latest_match_id).first()
            if not match or match.status in (ArenaMatchStatus.FINISHED, ArenaMatchStatus.CANCELLED):
                room.status = ArenaRoomStatus.LOBBY
                # Also reset readyness for all players
                for player in room.players:
                    player.is_ready = False
                    db.add(player)
                db.add(room)
                count += 1
        
        if count > 0:
            db.commit()
            
        return count

    def _close_idle_lobby_rooms(self, db: Session) -> int:
        idle_minutes = arena_settings.ARENA_ROOM_IDLE_CLOSE_MINUTES
        if idle_minutes <= 0:
            return 0

        now = utc_now()
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
            if ensure_aware(latest_activity_at) > cutoff:
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
        public_course_id: int | None = None,
        pool_id: int | None = None,
        mode: str,
        visibility: str,
        max_players: int,
        round_count: int,
        round_time_seconds: int,
    ) -> ArenaRoomModel:
        if mode == "ranked":
            mode = "competitive"
        if pool_id:
            pool = self.topic_catalog_service.get_active_pool(db, pool_id)
            if not pool:
                raise HTTPException(status_code=404, detail="Arena question pool not found")
            public_course_id = pool.public_course_id
        elif public_course_id:
            public_course = self.topic_catalog_service.get_enabled_public_course(db, public_course_id)
            if not public_course:
                raise HTTPException(status_code=404, detail="Arena public course not found")
            # Fallback: pick first active pool
            from app.arena.models.arena_question_pool import ArenaQuestionPoolModel
            pool = db.query(ArenaQuestionPoolModel).filter(
                ArenaQuestionPoolModel.public_course_id == public_course_id,
                ArenaQuestionPoolModel.is_active.is_(True)
            ).first()
            if not pool:
                 raise HTTPException(status_code=404, detail="No active pool for this course")
            pool_id = pool.id
        else:
             raise HTTPException(status_code=400, detail="Either pool_id or public_course_id is required")

        active_season = self.rank_service.get_active_season(db)
        
        # MUTUAL EXCLUSION: Cancel any active competitive queues
        from app.arena.models.arena_queue import ArenaQueueEntryModel
        from app.arena.domain.arena_statuses import ArenaQueueStatus
        db.query(ArenaQueueEntryModel).filter(
            ArenaQueueEntryModel.user_id == current_user.id,
            ArenaQueueEntryModel.status.in_((ArenaQueueStatus.WAITING, ArenaQueueStatus.MATCHED))
        ).update({
            "status": ArenaQueueStatus.CANCELLED,
            "closed_at": utc_now()
        }, synchronize_session=False)

        room = ArenaRoomModel(
            room_code=self._generate_room_code(db),
            season_id=active_season.id if active_season else None,
            host_user_id=current_user.id,
            public_course_id=public_course_id,
            question_pool_id=pool_id,
            mode=mode,
            visibility=visibility,
            max_players=max_players,
            round_count=round_count,
            round_time_seconds=round_time_seconds,
            room_settings_json={},
        )
        db.add(room)
        db.flush()

        db.add(
            ArenaRoomPlayerModel(
                room_id=room.id,
                user_id=current_user.id,
                is_ready=False,
                connection_state="connected",
                last_seen_at=utc_now(),
                user_snapshot_json=build_user_snapshot(current_user),
            )
        )
        db.flush()
        
        # Do all operations before commit
        self.presence_service.touch_room_presence(db, room, current_user)
        self.realtime_gateway.publish_event(
            db,
            stream_type="room",
            room_code=room.room_code,
            event_type="room.created",
            payload={
                "roomCode": room.room_code,
                "status": ArenaRoomStatus.LOBBY,
                "hostUserId": current_user.id,
                "publicCourseId": room.public_course_id,
                "poolId": room.question_pool_id,
            },
        )
        
        # Single commit at the end
        db.commit()

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

        # MUTUAL EXCLUSION: Cancel any active competitive queues
        from app.arena.models.arena_queue import ArenaQueueEntryModel
        from app.arena.domain.arena_statuses import ArenaQueueStatus
        db.query(ArenaQueueEntryModel).filter(
            ArenaQueueEntryModel.user_id == current_user.id,
            ArenaQueueEntryModel.status.in_((ArenaQueueStatus.WAITING, ArenaQueueStatus.MATCHED))
        ).update({
            "status": ArenaQueueStatus.CANCELLED,
            "closed_at": utc_now()
        }, synchronize_session=False)

        db.add(
            ArenaRoomPlayerModel(
                room_id=room.id,
                user_id=current_user.id,
                is_ready=False,
                connection_state="connected",
                last_seen_at=utc_now(),
                user_snapshot_json=build_user_snapshot(current_user),
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

        # 1. 為了防止 SQLAlchemy 記憶體中仍留存被刪除的玩家快取，手動從關係集合中移出
        if player in room.players:
            room.players.remove(player)

        db.delete(player)
        db.flush()
        db.expire_all()

        # 2. 重新讀取資料庫中該房間真實存在的剩餘玩家
        remaining_players = (
            db.query(ArenaRoomPlayerModel)
            .filter(ArenaRoomPlayerModel.room_id == room.id)
            .order_by(ArenaRoomPlayerModel.joined_at.asc())
            .all()
        )

        if not remaining_players:
            room.status = ArenaRoomStatus.CLOSED
            room.closed_at = utc_now()
        elif room.host_user_id == current_user.id:
            room.host_user_id = remaining_players[0].user_id

        db.commit()
        db.expire_all()

        # 3. 讀取並重新載入完整的房間資料
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

    def kick_player(
        self, db: Session, current_user: UserModel, room_code: str, target_user_id: int
    ) -> ArenaRoomModel:
        room = self.get_room_by_code(db, room_code)
        if not room:
            raise HTTPException(status_code=404, detail="Arena room not found")
        if room.host_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the host can kick players")
        if target_user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Host cannot kick themselves")
        if room.status != ArenaRoomStatus.LOBBY:
            raise HTTPException(status_code=409, detail="Arena room is no longer in lobby state")

        original_room_code = room.room_code
        target_player = next((item for item in room.players if item.user_id == target_user_id), None)
        if not target_player:
            raise HTTPException(status_code=404, detail="Target player is not in this room")

        if target_player in room.players:
            room.players.remove(target_player)
        db.delete(target_player)
        db.flush()
        db.expire_all()

        db.commit()
        db.expire_all()

        room = self.get_room_by_code(db, original_room_code, cleanup_idle=False)
        self.realtime_gateway.publish_event(
            db,
            stream_type="room",
            room_code=original_room_code,
            event_type="room.player_kicked",
            payload={
                "roomCode": original_room_code,
                "userId": target_user_id,
                "kickedBy": current_user.id,
                "hostUserId": room.host_user_id if room else None,
                "status": room.status if room else ArenaRoomStatus.CLOSED,
            },
        )
        db.commit()
        return room

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

    def update_room_settings(
        self,
        db: Session,
        current_user: UserModel,
        room_code: str,
        *,
        question_type: str | None = None,
        pool_id: int | None = None,
    ) -> ArenaRoomModel:
        room = self.get_room_by_code(db, room_code)
        if not room:
            raise HTTPException(status_code=404, detail="Arena room not found")
        if room.host_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only the host can update room settings")
        if room.status != ArenaRoomStatus.LOBBY:
            raise HTTPException(status_code=409, detail="Arena room settings can only be updated in lobby state")

        settings = room.room_settings_json if isinstance(room.room_settings_json, dict) else {}

        normalized_question_type: str | None = None
        if question_type is not None:
            normalized_question_type = str(question_type).strip()
            if normalized_question_type not in self.ALLOWED_QUESTION_TYPES:
                raise HTTPException(status_code=400, detail="Unsupported Arena question type")
            settings["question_type"] = normalized_question_type

        if pool_id is not None:
            pool = self.topic_catalog_service.get_active_pool(db, pool_id)
            if not pool:
                raise HTTPException(status_code=404, detail="Arena question pool not found")
            room.question_pool_id = pool.id
            room.public_course_id = pool.public_course_id

        room.room_settings_json = settings
        db.add(room)
        db.commit()
        room = self.get_room_by_code(db, room.room_code, cleanup_idle=False)
        self.realtime_gateway.publish_event(
            db,
            stream_type="room",
            room_code=room.room_code,
            event_type="room.settings_changed",
            payload={
                "roomCode": room.room_code,
                "selectedQuestionType": normalized_question_type,
                "poolId": room.question_pool_id,
                "poolTitle": room.question_pool.title if room.question_pool else None,
                "publicCourseId": room.public_course_id,
                "publicCourseTitle": room.public_course.title if room.public_course else None,
                "roomSettings": settings,
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
            "question_pool_id": room.question_pool_id,
            "question_type": (room.room_settings_json or {}).get("question_type") if isinstance(room.room_settings_json, dict) else None,
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
            question_pool_id=room.question_pool_id,
            mode=room.mode,
            status=ArenaMatchStatus.IN_PROGRESS,
            player_count=len(room.players),
            round_count=room.round_count,
            completed_round_count=0,
            room_snapshot_json=room_snapshot,
            rules_snapshot_json=rules_snapshot,
            started_at=utc_now(),
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
                    user_snapshot_json=player.user_snapshot_json,
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
            "poolId": room.question_pool_id,
            "poolTitle": room.question_pool.title if room.question_pool else None,
            "selectedQuestionType": (room.room_settings_json or {}).get("question_type") if isinstance(room.room_settings_json, dict) else None,
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
                    "displayName": (player.user_snapshot_json or {}).get("displayName") 
                        or player.user.full_name 
                        or player.user.email.split("@")[0],
                    "avatarUrl": (player.user_snapshot_json or {}).get("avatarUrl") or player.user.avatar_url,
                    "level": (player.user_snapshot_json or {}).get("level") or player.user.level,
                    "isHost": player.user_id == room.host_user_id,
                    "isReady": bool(player.is_ready),
                    "team": player.team,
                    "joinedAt": to_iso_utc(player.joined_at),
                    "connectionState": presence_map.get(player.user_id, {}).get("connectionState"),
                }
                for player in sorted_players
            ],
            "latestMatchId": room.latest_match_id,
            "createdAt": to_iso_utc(room.created_at),
            "updatedAt": to_iso_utc(room.updated_at),
        }
