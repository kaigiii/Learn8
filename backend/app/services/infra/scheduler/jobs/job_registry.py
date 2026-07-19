import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.job import JobModel
from app.domain.statuses import JobStatus, ACTIVE_JOB_STATUSES
from app.core.config import settings
from app.services.infra.scheduler.workers.job_notifier import _publish_job_notification

logger = logging.getLogger(__name__)

class JobRegistry:
    _monitor_task: asyncio.Task = None

    @staticmethod
    def cleanup_on_startup():
        """
        Mark all PROCESSING or PENDING jobs as STALE on server startup.
        Because a restart means the previous worker processes are gone.
        """
        db = SessionLocal()
        try:
            # 1. Archive previously STALE jobs to CANCELLED so they don't block the UI forever
            db.query(JobModel).filter(
                JobModel.status == JobStatus.STALE
            ).update({
                JobModel.status: JobStatus.CANCELLED,
                JobModel.message: "Cleaned up on system restart.",
                JobModel.updated_at: datetime.now(timezone.utc)
            }, synchronize_session=False)
            db.commit()

            # 2. Mark currently active jobs from the interrupted run as STALE
            stale_count = db.query(JobModel).filter(
                JobModel.status.in_(ACTIVE_JOB_STATUSES)
            ).update({
                JobModel.status: JobStatus.STALE,
                JobModel.message: "System restarted. Job marked as stale; please retry.",
                JobModel.updated_at: datetime.now(timezone.utc)
            }, synchronize_session=False)
            db.commit()

            if stale_count > 0:
                logger.info(f"Cleanup on startup: Marked {stale_count} active jobs as STALE.")

            # Cleanup stuck generating courses
            from app.models.course import CourseModel
            from app.domain.statuses import CourseStatus

            generating_courses = db.query(CourseModel).filter(
                CourseModel.status == CourseStatus.GENERATING
            ).all()
            for course in generating_courses:
                if course.syllabus_json:
                    course.status = CourseStatus.READY
                else:
                    from app.services.domain.course.lifecycle import mark_syllabus_failed
                    mark_syllabus_failed(course)
            db.commit()
            if generating_courses:
                logger.info(f"Cleanup on startup: Reset status for {len(generating_courses)} generating courses.")
        except Exception as e:
            logger.error(f"Failed to cleanup jobs/courses on startup: {e}")
            db.rollback()
        finally:
            db.close()

    @staticmethod
    def heartbeat(db: Session, job: JobModel):
        """
        Update the heartbeat timestamp of a job.
        This signals that the worker is still alive even if progress hasn't changed.
        """
        try:
            job.updated_at = datetime.now(timezone.utc)
            db.commit()
        except Exception as e:
            logger.error(f"Heartbeat failed for job {job.id}: {e}")
            db.rollback()

    @staticmethod
    async def monitor_workflow():
        """
        Periodic background task to mark timed-out jobs as STALE.
        """
        timeout_delta = timedelta(minutes=settings.JOB_STALE_TIMEOUT_MINUTES)
        
        while True:
            try:
                # Sleep first or after? Let's check periodically.
                await asyncio.sleep(60 * 5)  # Every 5 minutes
                
                db = SessionLocal()
                try:
                    cutoff = datetime.now(timezone.utc) - timeout_delta
                    
                    # Find jobs that haven't sent a heartbeat/update lately
                    timed_out_jobs = db.query(JobModel).filter(
                        JobModel.status.in_(ACTIVE_JOB_STATUSES),
                        JobModel.updated_at < cutoff
                    ).all()
                    
                    if timed_out_jobs:
                        for job in timed_out_jobs:
                            job.status = JobStatus.STALE
                            job.message = f"Job timed out after {settings.JOB_STALE_TIMEOUT_MINUTES}m without updates."
                            job.updated_at = datetime.now(timezone.utc)
                            logger.warn(f"Job {job.id} timed out and marked as STALE.")
                            
                            # Notify frontend via SSE
                            _publish_job_notification(db, job)
                            
                        db.commit()
                except Exception as e:
                    logger.error(f"Error in JobRegistry monitor loop: {e}")
                    db.rollback()
                finally:
                    db.close()
                    
            except asyncio.CancelledError:
                logger.info("JobRegistry monitor task cancelled.")
                break
            except Exception as e:
                logger.error(f"JobRegistry monitor unexpected error: {e}")
                await asyncio.sleep(60) # Backoff if something is really wrong

    @staticmethod
    def start_monitor():
        if JobRegistry._monitor_task is None or JobRegistry._monitor_task.done():
            JobRegistry._monitor_task = asyncio.create_task(JobRegistry.monitor_workflow())
            logger.info("Proactive Job Monitor started.")

    @staticmethod
    def stop_monitor():
        if JobRegistry._monitor_task and not JobRegistry._monitor_task.done():
            JobRegistry._monitor_task.cancel()
            logger.info("Proactive Job Monitor stopped.")
