
from fastapi import APIRouter
from app.api.v1.endpoints import auth, projects, courses, lessons, system

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
api_router.include_router(system.router, prefix="/system", tags=["system"]) # Paths like /submit-answer
