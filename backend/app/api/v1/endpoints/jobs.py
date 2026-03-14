import json
import asyncio
import asyncpg
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.config import settings
from app.api.dependencies import get_db, get_current_user
from app.models.job import JobModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
STALE_JOB_TIMEOUT = timedelta(minutes=10)


@router.get("/{job_id}/stream")
async def stream_job_status(job_id: str):
    """
    建立 Server-Sent Events (SSE) 連線，透過 PostgreSQL LISTEN 即時推送任務進度。
    這支 API 實現了零延遲、零資料庫輪詢的事件驅動架構 (Event-Driven)。
    """

    async def event_generator():
        # 確保 asyncpg 能使用標準的 postgresql:// 連線字串
        db_url = settings.DATABASE_URL
        if db_url.startswith("postgresql+"):
            db_url = "postgresql://" + db_url.split("://", 1)[1]

        try:
            conn = await asyncpg.connect(db_url)
        except Exception as e:
            logger.error(f"SSE DB Connection failed: {e}")
            yield f"data: {json.dumps({'status': 'FAILED', 'message': '推播伺服器連線失敗'})}\n\n"
            return

        queue = asyncio.Queue()

        def notification_handler(connection, pid, channel, payload):
            asyncio.create_task(queue.put(payload))

        # 註冊監聽專屬頻道 "job_channel"
        await conn.add_listener("job_channel", notification_handler)

        try:
            # 建立連線的第一時間，先主動去查一次目前狀態 (避免錯過一開始的通知)
            row = await conn.fetchrow(
                "SELECT status, progress, message, result_data FROM generation_jobs WHERE id = $1",
                job_id,
            )

            if not row:
                yield f"data: {json.dumps({'status': 'FAILED', 'message': '找不到該任務 (Job not found)'})}\n\n"
                return

            # 傳送初次狀態
            initial_data = dict(row)
            if "result_data" in initial_data and isinstance(
                initial_data["result_data"], str
            ):
                try:
                    initial_data["result_data"] = json.loads(
                        initial_data["result_data"]
                    )
                except:
                    pass

            yield f"data: {json.dumps(initial_data)}\n\n"

            # 如果一查就發現已經做完了，直接中斷連線
            if initial_data.get("status") in ["COMPLETED", "FAILED", "CANCELLED"]:
                return

            # 開始進入掛起模式，等待 PostgreSQL 喚醒
            while True:
                # 系統沉睡於此，完全不消耗 CPU 也不查 DB
                payload_str = await queue.get()

                try:
                    data = json.loads(payload_str)
                except json.JSONDecodeError:
                    logger.warning(
                        f"[SSE WARNING] Received non-JSON payload for job {job_id[:8]}: {payload_str}"
                    )
                    continue  # Skip if payload is not valid JSON
                except Exception as e:
                    logger.error(
                        f"[SSE ERROR] Unexpected error parsing payload for job {job_id[:8]}: {e}"
                    )
                    continue

                # 確認這個推播是屬於這個人的 Job
                if data.get("job_id") != job_id:
                    continue

                row = await conn.fetchrow(
                    "SELECT status, progress, message, result_data FROM generation_jobs WHERE id = $1",
                    job_id,
                )
                if not row:
                    continue

                event_data = dict(row)
                event_data["job_id"] = job_id
                if "result_data" in event_data and isinstance(
                    event_data["result_data"], str
                ):
                    try:
                        event_data["result_data"] = json.loads(
                            event_data["result_data"]
                        )
                    except Exception:
                        pass

                logger.info(
                    f"[SSE SEND] {job_id[:8]} - status: {event_data.get('status')}, prog: {event_data.get('progress')}"
                )
                yield f"data: {json.dumps(event_data)}\n\n"

                if event_data.get("status") in ["COMPLETED", "FAILED", "CANCELLED"]:
                    logger.info(
                        f"[SSE CLOSE] Stream for {job_id[:8]} terminating normally due to final status."
                    )
                    break

        except asyncio.CancelledError:
            logger.info(f"[SSE CANCELLED] Stream for {job_id[:8]} was cancelled.")
        except Exception as e:
            logger.error(
                f"[SSE EXCEPTION] Unhandled exception in event_generator for {job_id[:8]}: {e}",
                exc_info=True,
            )
        finally:
            logger.info(f"[SSE DONE] Cleaning up listener for {job_id[:8]}")
            await conn.remove_listener("job_channel", notification_handler)
            await conn.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/active")
async def check_active_jobs(
    current_user=Depends(get_current_user), db: Session = Depends(get_db)
):
    cutoff = datetime.now(timezone.utc) - STALE_JOB_TIMEOUT

    stale_jobs = (
        db.query(JobModel)
        .filter(
            JobModel.user_id == current_user.id,
            JobModel.status.in_(["PENDING", "PROCESSING"]),
            func.coalesce(JobModel.updated_at, JobModel.created_at) < cutoff,
        )
        .all()
    )
    for job in stale_jobs:
        job.status = "FAILED"
        job.message = "Job expired after backend restart or timeout."
    if stale_jobs:
        db.commit()

    # 尋找最新一筆處理中 (PROCESSING) 或等待中 (PENDING) 的任務
    active_job = (
        db.query(JobModel)
        .filter(
            JobModel.user_id == current_user.id,
            JobModel.status.in_(["PENDING", "PROCESSING"]),
        )
        .order_by(JobModel.created_at.desc())
        .first()
    )

    if active_job:
        return {
            "job_id": active_job.id,
            "status": active_job.status,
            "job_type": active_job.job_type,
        }
    return {"job_id": None}
