from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    arena,
    arena_admin,
    arena_rank,
    courses,
    syllabus,
    lessons,
    jobs,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(arena.router, prefix="/arena", tags=["arena"])
api_router.include_router(arena_admin.router, prefix="/arena/admin", tags=["arena-admin"])
api_router.include_router(arena_rank.router, prefix="/arena", tags=["arena-rank"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(syllabus.router, prefix="/courses", tags=["syllabus"])
api_router.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
