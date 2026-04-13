import asyncio
import json

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_current_user_for_stream, get_db
from app.core.config import settings
from app.core.time import utc_now, to_iso_utc
from app.models.user import UserModel
from app.schemas.arena_event_schema import ArenaEventEnvelope, ArenaEventListResponse
from app.schemas.arena_competitive_schema import (
    ArenaCompetitiveQueueJoinRequest,
    ArenaCompetitiveQueueResponse,
)
from app.schemas.arena_resume_schema import ArenaResumeResponse
from app.schemas.arena_room_schema import (
    ArenaRoomCreateRequest,
    ArenaRoomJoinRequest,
    ArenaRoomReadyRequest,
    ArenaRoomResponse,
    ArenaRoomStartResponse,
)
from app.schemas.arena_match_schema import (
    ArenaAnswerSubmitRequest,
    ArenaAnswerSubmitResponse,
    ArenaMatchStateResponse,
)
from app.schemas.arena_schema import ArenaPublicCourseSummary, ArenaSeasonSummary
from app.services.arena.rank_service import RankService
from app.services.arena.competitive_service import CompetitiveService
from app.services.arena.realtime_gateway import ARENA_EVENT_CHANNEL, RealtimeGateway, serialize_arena_event
from app.services.arena.round_engine import RoundEngine
from app.services.arena.room_service import RoomService
from app.services.arena.topic_catalog_service import TopicCatalogService

router = APIRouter()


def _normalize_asyncpg_db_url() -> str:
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql+"):
        return "postgresql://" + db_url.split("://", 1)[1]
    return db_url


@router.get("/public-courses", response_model=list[ArenaPublicCourseSummary])
def list_public_courses(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    del current_user
    catalog_service = TopicCatalogService()
    courses = catalog_service.list_enabled_public_courses(db)
    return [
        ArenaPublicCourseSummary(
            id=course.id,
            slug=course.slug,
            title=course.title,
            topic=course.topic,
            description=course.description,
            difficulty=course.difficulty,
            tags=list(course.tags_json or []),
        )
        for course in courses
    ]


@router.get("/public-courses/{course_id}", response_model=dict)
def get_public_course(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    from app.models.public_course import PublicCourseModel
    from app.schemas.course_schema import CoursePath
    course = db.query(PublicCourseModel).filter(PublicCourseModel.id == course_id, PublicCourseModel.is_published == True).first()
    if not course:
        raise HTTPException(status_code=404, detail="Public course not found")
    
    if not course.syllabus_json:
        raise HTTPException(status_code=409, detail="This public course does not have a mapped syllabus yet")
        
    path = CoursePath(**course.syllabus_json)
    path.id = course.id
    path.topic = course.topic
    
    return path.model_dump()



@router.get("/season", response_model=ArenaSeasonSummary | None)
def get_active_season(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    del current_user
    rank_service = RankService()
    season = rank_service.get_active_season(db)
    if not season:
        return None
    return ArenaSeasonSummary(
        id=season.id,
        name=season.name,
        status=season.status,
        isActive=season.is_active,
        startedAt=to_iso_utc(season.started_at),
        endedAt=to_iso_utc(season.ended_at),
    )


@router.get("/resume", response_model=ArenaResumeResponse)
def get_arena_resume_target(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    round_engine = RoundEngine()
    active_match = round_engine.get_active_match_for_user(db, current_user.id)
    if active_match:
        return ArenaResumeResponse(
            destination="match",
            roomCode=active_match.room_snapshot_json.get("room_code")
            if isinstance(active_match.room_snapshot_json, dict)
            else None,
            matchId=active_match.id,
        )

    competitive_service = CompetitiveService()
    queue_entry = competitive_service.get_current_entry(db, current_user)
    if queue_entry:
        if queue_entry.match_id:
            from app.models.arena_match import ArenaMatchModel
            from app.domain.arena_statuses import ArenaMatchStatus
            match = db.query(ArenaMatchModel).filter(ArenaMatchModel.id == queue_entry.match_id).first()
            if match and match.status != ArenaMatchStatus.PENDING:
                return ArenaResumeResponse(
                    destination="match",
                    matchId=queue_entry.match_id,
                )
        return ArenaResumeResponse(
            destination="queue",
            queueId=queue_entry.id,
        )

    room_service = RoomService()
    active_room = room_service.get_active_room_for_user(db, current_user.id)
    if active_room:
        if active_room.status == "in_match" and active_room.latest_match_id:
            return ArenaResumeResponse(
                destination="match",
                roomCode=active_room.room_code,
                matchId=active_room.latest_match_id,
            )
        return ArenaResumeResponse(
            destination="lobby",
            roomCode=active_room.room_code,
            matchId=active_room.latest_match_id,
        )

    return ArenaResumeResponse(destination="none")


@router.post("/competitive/queue", response_model=ArenaCompetitiveQueueResponse)
def join_competitive_queue(
    payload: ArenaCompetitiveQueueJoinRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    service = CompetitiveService()
    entry = service.join_queue(
        db,
        current_user,
        public_course_id=payload.publicCourseId,
        round_count=payload.roundCount,
        round_time_seconds=payload.roundTimeSeconds,
    )
    return ArenaCompetitiveQueueResponse(**service.serialize_entry(entry))


@router.get("/competitive/queue/current", response_model=ArenaCompetitiveQueueResponse | None)
def get_current_competitive_queue(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    service = CompetitiveService()
    entry = service.get_current_entry(db, current_user)
    if entry is None:
        return None
    return ArenaCompetitiveQueueResponse(**service.serialize_entry(entry))


@router.delete("/competitive/queue/current", status_code=status.HTTP_204_NO_CONTENT)
def cancel_current_competitive_queue(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    service = CompetitiveService()
    service.cancel_current_entry(db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/rooms", response_model=ArenaRoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    payload: ArenaRoomCreateRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    room_service = RoomService()
    room = room_service.create_room(
        db,
        current_user,
        public_course_id=payload.publicCourseId,
        mode=payload.mode.value,
        visibility=payload.visibility.value,
        max_players=payload.maxPlayers,
        round_count=payload.roundCount,
        round_time_seconds=payload.roundTimeSeconds,
    )
    return ArenaRoomResponse(**room_service.serialize_room(room))


@router.post("/rooms/join", response_model=ArenaRoomResponse)
def join_room(
    payload: ArenaRoomJoinRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    room_service = RoomService()
    room = room_service.join_room(db, current_user, payload.roomCode)
    return ArenaRoomResponse(**room_service.serialize_room(room))


@router.get("/rooms/{room_code}", response_model=ArenaRoomResponse)
def get_room(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    room_service = RoomService()
    room = room_service.get_room_by_code(db, room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Arena room not found")
    if not any(player.user_id == current_user.id for player in room.players):
        raise HTTPException(status_code=403, detail="You are not part of this Arena room")
    room_service.presence_service.touch_room_presence(db, room, current_user)
    db.commit()
    room = room_service.get_room_by_code(db, room_code)
    return ArenaRoomResponse(**room_service.serialize_room(room))


@router.post("/rooms/{room_code}/ready", response_model=ArenaRoomResponse)
def set_room_ready(
    room_code: str,
    payload: ArenaRoomReadyRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    room_service = RoomService()
    room = room_service.set_ready(db, current_user, room_code, is_ready=payload.isReady)
    return ArenaRoomResponse(**room_service.serialize_room(room))


@router.post("/rooms/{room_code}/start", response_model=ArenaRoomStartResponse)
def start_room_match(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    room_service = RoomService()
    match = room_service.start_room_match(db, current_user, room_code)
    round_engine = RoundEngine()
    round_engine.initialize_match_rounds(db, match.id)
    return ArenaRoomStartResponse(
        roomCode=room_code.upper(),
        matchId=match.id,
        status=match.status,
    )


@router.post("/rooms/{room_code}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_room(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    room_service = RoomService()
    room_service.leave_room(db, current_user, room_code)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/rooms/{room_code}/events", response_model=ArenaEventListResponse)
def list_room_events(
    room_code: str,
    after_cursor: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    del current_user
    gateway = RealtimeGateway()
    events = gateway.list_events(db, room_code=room_code, after_cursor=after_cursor, limit=limit)
    return ArenaEventListResponse(items=[ArenaEventEnvelope(**serialize_arena_event(event)) for event in events])


@router.post("/rooms/{room_code}/presence", status_code=status.HTTP_204_NO_CONTENT)
def heartbeat_room_presence(
    room_code: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    room_service = RoomService()
    room = room_service.get_room_by_code(db, room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Arena room not found")
    if not any(player.user_id == current_user.id for player in room.players):
        raise HTTPException(status_code=403, detail="You are not part of this Arena room")
    room_service.presence_service.touch_room_presence(db, room, current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/matches/{match_id}/events", response_model=ArenaEventListResponse)
def list_match_events(
    match_id: int,
    after_cursor: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    del current_user
    gateway = RealtimeGateway()
    events = gateway.list_events(db, match_id=match_id, after_cursor=after_cursor, limit=limit)
    return ArenaEventListResponse(items=[ArenaEventEnvelope(**serialize_arena_event(event)) for event in events])


async def _make_arena_event_stream(
    filter_type: str,  # 'room' or 'match'
    filter_value: str | int,
    after_cursor: int = 0,
):
    db_url = _normalize_asyncpg_db_url()
    conn = await asyncpg.connect(db_url)
    queue: asyncio.Queue[str] = asyncio.Queue()
    cursor = max(after_cursor, 0)

    async def emit_backlog():
        nonlocal cursor
        where_clause = "room_code = $1" if filter_type == "room" else "match_id = $1"
        query_val = filter_value.upper() if filter_type == "room" else filter_value
        
        rows = await conn.fetch(
            f"""
            SELECT id, event_id, stream_type, room_code, match_id, event_type, version, payload_json, created_at
            FROM arena_events
            WHERE {where_clause} AND id > $2
            ORDER BY id ASC
            LIMIT 200
            """,
            query_val,
            cursor,
        )
        for row in rows:
            payload = {
                "cursor": row["id"],
                "eventId": row["event_id"],
                "streamType": row["stream_type"],
                "roomCode": row["room_code"],
                "matchId": row["match_id"],
                "eventType": row["event_type"],
                "version": row["version"],
                "payload": row["payload_json"] if isinstance(row["payload_json"], dict) else {},
                "createdAt": to_iso_utc(row["created_at"]),
            }
            cursor = row["id"]
            yield f"data: {json.dumps(payload)}\n\n"

    def notification_handler(connection, pid, channel, payload):
        asyncio.create_task(queue.put(payload))

    await conn.add_listener(ARENA_EVENT_CHANNEL, notification_handler)
    try:
        async for item in emit_backlog():
            yield item
        while True:
            try:
                await asyncio.wait_for(queue.get(), timeout=10.0)
                async for item in emit_backlog():
                    yield item
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"
    finally:
        await conn.remove_listener(ARENA_EVENT_CHANNEL, notification_handler)
        await conn.close()


@router.get("/rooms/{room_code}/stream")
async def stream_room_events(
    room_code: str,
    after_cursor: int = 0,
    current_user: UserModel = Depends(get_current_user_for_stream),
):
    del current_user
    return StreamingResponse(
        _make_arena_event_stream("room", room_code, after_cursor),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/matches/{match_id}/stream")
async def stream_match_events(
    match_id: int,
    after_cursor: int = 0,
    current_user: UserModel = Depends(get_current_user_for_stream),
):
    del current_user
    return StreamingResponse(
        _make_arena_event_stream("match", match_id, after_cursor),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/matches/{match_id}", response_model=ArenaMatchStateResponse)
def get_match_state(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    round_engine = RoundEngine()
    return ArenaMatchStateResponse(**round_engine.get_match_state(db, match_id, current_user))


@router.post("/matches/{match_id}/confirm", response_model=ArenaMatchStateResponse)
def confirm_match(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    round_engine = RoundEngine()
    return ArenaMatchStateResponse(**round_engine.confirm_match(db, match_id, current_user))


@router.post("/matches/{match_id}/presence", status_code=status.HTTP_204_NO_CONTENT)
def heartbeat_match_presence(
    match_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    round_engine = RoundEngine()
    match = round_engine.get_match(db, match_id)
    if not match:
        raise HTTPException(status_code=404, detail="Arena match not found")
    round_engine._ensure_participant(match, current_user)
    round_engine.presence_service.touch_match_presence(db, match, current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/matches/{match_id}/answers", response_model=ArenaAnswerSubmitResponse)
def submit_match_answer(
    match_id: int,
    payload: ArenaAnswerSubmitRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    round_engine = RoundEngine()
    result = round_engine.submit_answer(
        db,
        match_id=match_id,
        round_id=payload.roundId,
        current_user=current_user,
        selected_option_id=payload.selectedOptionId,
    )
    return ArenaAnswerSubmitResponse(**result)
