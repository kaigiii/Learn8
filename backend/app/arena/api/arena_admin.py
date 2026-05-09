from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_arena_admin, get_db
from app.models.user import UserModel
from app.arena.schemas.arena_admin_schema import (
    ArenaAdminHealthSnapshotResponse,
    ArenaAdminMatchReviewResponse,
    ArenaAdminPlayerMatchRecordResponse,
    ArenaAdminPublicCourseResponse,
    ArenaAdminQuestionPoolResponse,
    ArenaAdminQuestionPoolUpsertRequest,
    ArenaAdminSeasonResponse,
    ArenaAdminSeasonUpsertRequest,
    ArenaAdminSyllabusQuestionResponse,
)
from app.arena.services.admin_service import AdminService
from app.arena.services.telemetry_service import TelemetryService

router = APIRouter()


@router.get("/health", response_model=ArenaAdminHealthSnapshotResponse)
def get_admin_health_snapshot(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = TelemetryService()
    return ArenaAdminHealthSnapshotResponse(**service.build_admin_health_snapshot(db))


@router.get("/player-matches", response_model=list[ArenaAdminPlayerMatchRecordResponse])
def list_admin_player_matches(
    search: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    return [
        ArenaAdminPlayerMatchRecordResponse(**row)
        for row in service.list_player_match_records(db, search=search, limit=limit)
    ]


@router.get("/match-reviews", response_model=list[ArenaAdminMatchReviewResponse])
def list_admin_match_reviews(
    limit: int = 25,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    return [ArenaAdminMatchReviewResponse(**row) for row in service.list_match_reviews(db, limit=limit)]


@router.get("/public-courses", response_model=list[ArenaAdminPublicCourseResponse])
def list_admin_public_courses(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    return [service.serialize_public_course(course) for course in service.list_public_courses(db)]
    
@router.patch("/public-courses/{course_id}/status", response_model=ArenaAdminPublicCourseResponse)
def update_public_course_status(
    course_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    is_published = payload.get("isPublished", True)
    course = service.toggle_public_course_status(db, course_id, is_published)
    return ArenaAdminPublicCourseResponse(**service.serialize_public_course(course))




@router.get(
    "/public-courses/{public_course_id}/available-questions",
    response_model=list[ArenaAdminSyllabusQuestionResponse],
)
def list_available_syllabus_questions(
    public_course_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    return [
        ArenaAdminSyllabusQuestionResponse(**row)
        for row in service.extract_questions_from_syllabus(db, public_course_id=public_course_id)
    ]


@router.get("/question-pools", response_model=list[ArenaAdminQuestionPoolResponse])
def list_admin_question_pools(
    public_course_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    return [
        ArenaAdminQuestionPoolResponse(**service.serialize_question_pool(pool))
        for pool in service.list_question_pools(db, public_course_id=public_course_id)
    ]


@router.post("/question-pools", response_model=ArenaAdminQuestionPoolResponse)
def create_admin_question_pool(
    payload: ArenaAdminQuestionPoolUpsertRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    pool = service.upsert_question_pool(db, pool_id=None, payload=payload.model_dump())
    return ArenaAdminQuestionPoolResponse(**service.serialize_question_pool(pool))


@router.put("/question-pools/{pool_id}", response_model=ArenaAdminQuestionPoolResponse)
def update_admin_question_pool(
    pool_id: int,
    payload: ArenaAdminQuestionPoolUpsertRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    pool = service.upsert_question_pool(db, pool_id=pool_id, payload=payload.model_dump())
    return ArenaAdminQuestionPoolResponse(**service.serialize_question_pool(pool))

@router.delete("/question-pools/{pool_id}")
def delete_admin_question_pool(
    pool_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    success = service.delete_question_pool(db, pool_id=pool_id)
    if not success:
        raise HTTPException(status_code=404, detail="Question pool not found")
    return {"status": "ok"}

@router.get("/seasons", response_model=list[ArenaAdminSeasonResponse])
def list_admin_seasons(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    return [ArenaAdminSeasonResponse(**service.serialize_season(season)) for season in service.list_seasons(db)]


@router.post("/seasons", response_model=ArenaAdminSeasonResponse)
def create_admin_season(
    payload: ArenaAdminSeasonUpsertRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    season = service.upsert_season(db, season_id=None, payload=payload.model_dump())
    return ArenaAdminSeasonResponse(**service.serialize_season(season))


@router.put("/seasons/{season_id}", response_model=ArenaAdminSeasonResponse)
def update_admin_season(
    season_id: int,
    payload: ArenaAdminSeasonUpsertRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_arena_admin),
):
    del current_user
    service = AdminService()
    season = service.upsert_season(db, season_id=season_id, payload=payload.model_dump())
    return ArenaAdminSeasonResponse(**service.serialize_season(season))
