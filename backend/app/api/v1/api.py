from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    courses,
    syllabus,
    lessons,
    jobs,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(syllabus.router, prefix="/courses", tags=["syllabus"])
api_router.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
