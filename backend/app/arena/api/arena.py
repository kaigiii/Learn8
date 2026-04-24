import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Response, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.core.config import settings
from app.core.time import utc_now, to_iso_utc
from app.models.user import UserModel
from app.arena.schemas.arena_event_schema import ArenaEventEnvelope, ArenaEventListResponse
from app.arena.schemas.arena_competitive_schema import (
    ArenaCompetitiveQueueJoinRequest,
    ArenaCompetitiveQueueResponse,
)
from app.arena.schemas.arena_resume_schema import ArenaResumeResponse
from app.arena.schemas.arena_room_schema import (
    ArenaRoomCreateResponse,
    ArenaRoomCreateRequest,
    ArenaRoomJoinRequest,
    ArenaRoomReadyRequest,
    ArenaRoomResponse,
    ArenaRoomStartResponse,
    ArenaRoomSettingsUpdateRequest,
)
from app.arena.schemas.arena_match_schema import (
    ArenaMatchStateResponse,
)
from app.arena.schemas.arena_schema import ArenaPublicCourseSummary, ArenaSeasonSummary
from app.arena.services.rank_service import RankService
from app.arena.services.competitive_service import CompetitiveService
from app.arena.services.realtime_gateway import ARENA_EVENT_CHANNEL, RealtimeGateway, serialize_arena_event
from app.arena.services.round_engine import RoundEngine
from app.arena.services.room_service import RoomService
from app.arena.services.topic_catalog_service import TopicCatalogService

router = APIRouter()



@router.get("/public-courses", response_model=list[ArenaPublicCourseSummary])
def list_public_courses(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    del current_user
    catalog_service = TopicCatalogService()
    pools = catalog_service.list_active_pools(db)
    return [
        ArenaPublicCourseSummary(
            id=pool.public_course_id,
            poolId=pool.id,
            slug=pool.public_course.slug,
            title=pool.title,
            courseTitle=pool.public_course.title,
            topic=pool.public_course.topic,
            description=pool.public_course.description,
            isFeatured=bool(pool.public_course.is_featured_arena),
            tags=list(pool.public_course.tags_json or []),
        )
        for pool in pools
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
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    round_engine = RoundEngine(background_tasks=background_tasks)
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
            from app.arena.models.arena_match import ArenaMatchModel
            from app.arena.domain.arena_statuses import ArenaMatchStatus
            match = db.query(ArenaMatchModel).filter(ArenaMatchModel.id == queue_entry.match_id).first()
            if match and match.status in (ArenaMatchStatus.IN_PROGRESS, ArenaMatchStatus.PENDING):
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
        match_active = False
        if active_room.latest_match_id:
            from app.arena.models.arena_match import ArenaMatchModel
            from app.arena.domain.arena_statuses import ArenaMatchStatus
            match = db.query(ArenaMatchModel).filter(ArenaMatchModel.id == active_room.latest_match_id).first()
            if match and match.status in (ArenaMatchStatus.IN_PROGRESS, ArenaMatchStatus.PENDING):
                match_active = True
        
        if active_room.status == "in_match" and match_active:
            return ArenaResumeResponse(
                destination="match",
                roomCode=active_room.room_code,
                matchId=active_room.latest_match_id,
            )
        return ArenaResumeResponse(
            destination="lobby",
            roomCode=active_room.room_code,
            matchId=active_room.latest_match_id if match_active else None,
        )

    return ArenaResumeResponse(destination="none")


@router.post("/competitive/queue", response_model=ArenaCompetitiveQueueResponse)
def join_competitive_queue(
    payload: ArenaCompetitiveQueueJoinRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    service = CompetitiveService()
    entry = service.join_queue(
        db,
        current_user,
        background_tasks=background_tasks,
        public_course_id=payload.publicCourseId,
        pool_id=payload.poolId,
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


@router.post("/rooms", response_model=ArenaRoomCreateResponse, status_code=status.HTTP_201_CREATED)
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
    return ArenaRoomCreateResponse(roomCode=room.room_code, status=room.status)


@router.patch("/rooms/{room_code}/settings", response_model=ArenaRoomResponse)
def update_room_settings(
    room_code: str,
    payload: ArenaRoomSettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    if payload.questionType is None and payload.poolId is None:
        raise HTTPException(status_code=400, detail="No room settings field provided")

    room_service = RoomService()
    room = room_service.update_room_settings(
        db,
        current_user,
        room_code,
        question_type=payload.questionType,
        pool_id=payload.poolId,
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
    round_engine = RoundEngine(background_tasks=None) # Start doesn't finalize yet
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


@router.get("/matches/{match_id}", response_model=ArenaMatchStateResponse)
def get_match_state(
    match_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    round_engine = RoundEngine(background_tasks=background_tasks)
    return ArenaMatchStateResponse(**round_engine.get_match_state(db, match_id, current_user))


@router.post("/matches/{match_id}/confirm", response_model=ArenaMatchStateResponse)
def confirm_match(
    background_tasks: BackgroundTasks,
    match_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    round_engine = RoundEngine(background_tasks=background_tasks)
    return ArenaMatchStateResponse(**round_engine.confirm_match(db, match_id, current_user))


from fastapi import WebSocket, WebSocketDisconnect


@router.websocket("/ws")
async def arena_websocket_endpoint(
    websocket: WebSocket,
    access_token: str | None = None,
):
    from app.api.dependencies import _resolve_current_user_from_token
    from app.db.session import SessionLocal
    from app.arena.services.ws_connection_manager import manager
    
    with SessionLocal() as db:
        try:
            current_user = _resolve_current_user_from_token(access_token or "", db)
            db.expunge(current_user)  # Detach from session so we can use it safely across async boundary
        except Exception:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await manager.connect(current_user.id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "heartbeat":
                await manager.touch_presence(current_user.id)
                await manager.send_personal_message(current_user.id, {"type": "pong"})
            
            elif action == "subscribe":
                match_id = data.get("matchId")
                room_code = data.get("roomCode")
                if match_id:
                    await manager.subscribe(current_user.id, f"arena:match:{match_id}")
                if room_code:
                    await manager.subscribe(current_user.id, f"arena:room:{room_code}")
                    
            elif action == "unsubscribe":
                match_id = data.get("matchId")
                room_code = data.get("roomCode")
                if match_id:
                    await manager.unsubscribe(current_user.id, f"arena:match:{match_id}")
                if room_code:
                    await manager.unsubscribe(current_user.id, f"arena:room:{room_code}")
                    
            elif action == "question_ready":
                match_id = data.get("matchId")
                round_id = data.get("roundId")
                req_id = data.get("reqId")

                def _mark_ready():
                    from app.arena.services.round_engine import RoundEngine
                    engine = RoundEngine()
                    with SessionLocal() as async_db:
                        return engine.mark_question_ready(
                            async_db,
                            match_id=match_id,
                            round_id=round_id,
                            current_user=current_user,
                        )

                try:
                    result = await asyncio.to_thread(_mark_ready)
                    await manager.send_personal_message(current_user.id, {
                        "action": "question_ready",
                        "reqId": req_id,
                        "payload": result,
                    })
                except HTTPException as exc:
                    await manager.send_personal_message(current_user.id, {
                        "action": "question_ready",
                        "reqId": req_id,
                        "error": {
                            "status": exc.status_code,
                            "detail": exc.detail,
                        },
                    })
                except Exception:
                    await manager.send_personal_message(current_user.id, {
                        "action": "question_ready",
                        "reqId": req_id,
                        "error": {
                            "status": 500,
                            "detail": "Unexpected ready error",
                        },
                    })

            elif action == "submit_answer":
                match_id = data.get("matchId")
                round_id = data.get("roundId")
                selected_option_id = data.get("selectedOptionId")
                req_id = data.get("reqId")
                
                def _submit():
                    from app.arena.services.round_engine import RoundEngine
                    engine = RoundEngine()
                    with SessionLocal() as async_db:
                        return engine.submit_answer(
                            async_db,
                            match_id=match_id,
                            round_id=round_id,
                            current_user=current_user,
                            selected_option_id=selected_option_id,
                            answer_payload=data.get("answerPayload")
                        )
                
                try:
                    result = await asyncio.to_thread(_submit)
                    await manager.send_personal_message(current_user.id, {
                        "action": "answer_result",
                        "reqId": req_id,
                        "payload": result,
                    })
                except HTTPException as exc:
                    await manager.send_personal_message(current_user.id, {
                        "action": "answer_result",
                        "reqId": req_id,
                        "error": {
                            "status": exc.status_code,
                            "detail": exc.detail,
                        },
                    })
                except Exception:
                    await manager.send_personal_message(current_user.id, {
                        "action": "answer_result",
                        "reqId": req_id,
                        "error": {
                            "status": 500,
                            "detail": "Unexpected submit error",
                        },
                    })
                
    except WebSocketDisconnect:
        manager.disconnect(current_user.id)
