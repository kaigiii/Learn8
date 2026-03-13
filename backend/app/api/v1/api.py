from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    projects,
    project_files,
    questionnaire,
    courses,
    syllabus,
    lessons,
    system,
    jobs,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(
    project_files.router, prefix="/projects", tags=["project-files"]
)
api_router.include_router(
    questionnaire.router, prefix="/projects", tags=["questionnaire"]
)
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(syllabus.router, prefix="/courses", tags=["syllabus"])
api_router.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])

