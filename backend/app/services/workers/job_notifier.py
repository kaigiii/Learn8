import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.models.job import JobModel

logger = logging.getLogger(__name__)


def _notify_job_update(
    db: Session,
    job: JobModel,
    progress: int,
    message: str,
    status: str = None,
    result_data: dict = None,
):
    """
    更新資料庫中的 Job 狀態，並立刻發佈 PostgreSQL NOTIFY，讓 SSE 訂閱者能秒速收到變化。
    此函式為所有 Worker 共用的核心通知機制。
    """
    job.progress = progress
    job.message = message
    if status is not None:
        job.status = status
    if result_data is not None:
        job.result_data = result_data

    db.commit()
    db.refresh(job)

    # 準備發送給 Pub/Sub 的 Payload
    rd = job.result_data
    if isinstance(rd, str):
        try:
            rd = json.loads(rd)
        except:
            pass

    payload = {
        "job_id": job.id,
        "status": job.status,
        "progress": job.progress,
        "message": job.message,
        "result_data": rd,
    }

    # 使用 PostgreSQL LISTEN/NOTIFY
    payload_str = json.dumps(payload)
    # 注意：SQLAlchemy execute 需要使用 text() 來處理原生 SQL 參數
    db.execute(
        text("SELECT pg_notify('job_channel', :payload)"), {"payload": payload_str}
    )
    db.commit()
