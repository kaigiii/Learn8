import os
from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.core.config import settings
from app.services.infra.scheduler.jobs.job_registry import JobRegistry
from app.arena.services.maintenance_service import ArenaMaintenanceService

@asynccontextmanager
async def application_lifespan(app: FastAPI):
    """
    Handles application startup and shutdown events.
    """
    # 1. Background Jobs Setup
    JobRegistry.cleanup_on_startup()
    JobRegistry.start_monitor()
    ArenaMaintenanceService.start()

    # 1.5. Arena WS Setup
    from app.arena.services.ws_connection_manager import manager
    await manager.start_listening()

    # 2. Automatic Synchronization of Public Courses
    from app.core.course_loader import registry as course_registry
    from app.db.session import SessionLocal
    
    # Ensure activity.log exists
    log_file_path = settings.LOG_DIR / "activity.log"
    log_file_path.parent.mkdir(parents=True, exist_ok=True)
    if not log_file_path.exists():
        log_file_path.touch()

    db = SessionLocal()
    try:
        # Note: sync_to_db performs database I/O. 
        # If the number of courses is large, consider running in a thread 
        # to avoid blocking the event loop, though for seeding small sets it is fine.
        course_registry.sync_to_db(db)
    finally:
        db.close()

    yield

    # 3. Shutdown Logic
    JobRegistry.stop_monitor()
    ArenaMaintenanceService.stop()
