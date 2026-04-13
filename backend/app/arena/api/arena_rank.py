from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models.user import UserModel
from app.arena.schemas.arena_rank_schema import (
    ArenaLeaderboardResponse,
    ArenaProfileResponse,
    ArenaRankHistoryResponse,
)
from app.arena.services.rank_service import RankService

router = APIRouter()


@router.get("/profile", response_model=ArenaProfileResponse)
def get_arena_profile(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    rank_service = RankService()
    return ArenaProfileResponse(**rank_service.build_profile_payload(db, current_user))


@router.get("/leaderboard", response_model=ArenaLeaderboardResponse)
def get_arena_leaderboard(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    del current_user
    rank_service = RankService()
    bounded_limit = min(max(limit, 1), 100)
    return ArenaLeaderboardResponse(items=rank_service.list_leaderboard(db, bounded_limit))


@router.get("/leaderboard/season", response_model=ArenaLeaderboardResponse)
def get_arena_season_leaderboard(
    season_id: int | None = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    del current_user
    rank_service = RankService()
    bounded_limit = min(max(limit, 1), 100)
    return ArenaLeaderboardResponse(
        items=rank_service.list_season_leaderboard(
            db,
            season_id=season_id,
            limit=bounded_limit,
        )
    )


@router.get("/history", response_model=ArenaRankHistoryResponse)
def get_arena_rank_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    rank_service = RankService()
    return ArenaRankHistoryResponse(
        items=rank_service.list_rank_history(db, user_id=current_user.id, limit=limit)
    )
