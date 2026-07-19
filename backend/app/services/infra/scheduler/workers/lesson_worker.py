import logging
from app.core.component_loader import registry as component_registry
from app.domain.statuses import (
    JobStatus,
    LessonFailedStageStatus,
    LessonSessionPhase,
    LessonSessionStatus,
)
from app.core.time import utc_now
from app.db.session import SessionLocal
from app.models.job import JobModel
from app.models.user import UserModel
from app.services.domain.user.economy import spend_user_credits
from app.services.ai_engine.clients.factory import LLMFactory
from app.services.ai_engine.kb.rag_engine import RAGEngine
from app.core.config import settings
from app.services.domain.learning.lesson_persistence import (
    summarize_stages,
    sync_lesson_stages,
    sync_remedial_stages,
    sync_session_stages,
)
from app.services.infra.media.catalog import (
    build_media_catalog,
    build_media_index_map,
    format_media_catalog,
)
from app.services.infra.scheduler.workers.job_notifier import _notify_job_update, _publish_job_notification
from app.core.config import settings

logger = logging.getLogger(__name__)
from app.api.v1.endpoints.audio import pregenerate_audio_cache


async def _prebuild_audios(stgs, voice_pref: str = settings.DEFAULT_VOICE_PRESET):
    for s in stgs:
        if not s or not s.config:
            continue
        data = s.config.data if isinstance(s.config.data, dict) else {}
        comp = component_registry.get_component(s.component)
        voice_targets = comp.get("voice_targets") if comp else None
        if not voice_targets:
            voice_targets = ["question", "prompt", "text"]

        extracted_texts = []
        for field in voice_targets:
            if field in data and isinstance(data[field], str) and data[field].strip():
                extracted_texts.append(data[field].strip())

        text = " ".join(extracted_texts).strip()
        if not text:
            text = (
                data.get("question")
                or data.get("prompt")
                or data.get("text")
                or data.get("explanation")
                or s.topic
            )

        if text:
            # 優化：僅預先生成使用者偏好的音色，減少 80% 的 TTS 負載
            for preset_id in [voice_pref]:
                try:
                    await pregenerate_audio_cache(text, preset_id)
                except Exception:
                    pass


def _is_cancelled(db, job_id: str) -> bool:
    job = db.query(JobModel).filter(JobModel.id == job_id).first()
    return job is None or job.status == JobStatus.CANCELLED


async def run_lesson_generation_job(
    job_id: str,
    user_id: int,
    course_id: int | None,
    topic: str,
    node_data: dict,
    course_folder_name: str | None,
    profile_summary: str,
    allowed_components: list[str] | None = None,
    voice_preset: str = settings.DEFAULT_VOICE_PRESET,
):
    """
    在背景獨立執行單元課程生成的 Worker。
    """
    db = SessionLocal()
    job = None
    try:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job or job.status == JobStatus.CANCELLED:
            return

        node_title = node_data.get("title", "單元")
        _notify_job_update(
            db, job, 10, f"準備為您生成「{node_title}」的關卡內容...", status=JobStatus.PROCESSING
        )

        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        COST = settings.COST_LESSON_GENERATION

        provider = LLMFactory.create()
        rag_engine = RAGEngine(provider)
        from app.services.infra.files.service import FileService
        from app.services.ai_engine.agents.course_architect import AIArchitectService

        file_service = FileService()
        architect_service = AIArchitectService(provider, rag_engine, file_service)

        _notify_job_update(db, job, 30, f"AI 正在為您撰寫「{node_title}」的個人化講義...")

        from app.schemas.course_schema import LessonNode
        from app.models.course_media_asset import CourseMediaAssetModel

        node = LessonNode(**node_data)
        resolved_allowed_components = (
            list(allowed_components)
            if allowed_components
            else component_registry.get_component_names()
        )

        media_catalog = None
        media_index_map = {}
        if course_id is not None:
            assets = (
                db.query(CourseMediaAssetModel)
                .filter(CourseMediaAssetModel.course_id == course_id)
                .order_by(
                    CourseMediaAssetModel.source_filename.asc(),
                    CourseMediaAssetModel.page_number.asc().nullslast(),
                    CourseMediaAssetModel.asset_index.asc().nullslast(),
                    CourseMediaAssetModel.id.asc(),
                )
                .all()
            )
            if assets:
                catalog_items = build_media_catalog(assets)
                media_catalog = format_media_catalog(catalog_items)
                media_index_map = build_media_index_map(catalog_items)

        stages = await architect_service.generate_lesson_from_node(
            node,
            topic,
            user_id=user.id,
            course_folder=course_folder_name,
            course_id=course_id,
            profile=profile_summary,
            allowed_components=allowed_components,
            media_catalog=media_catalog,
        )

        if _is_cancelled(db, job_id):
            return

        if not stages:
            raise Exception("未能成功生成課程內容。")

        # 啟動非同步背景任務預建音檔快取
        import asyncio
        asyncio.create_task(_prebuild_audios(stages, voice_preset))

        if stages:
            for stage in stages:
                if stage.component != "ExplainerMedia":
                    continue
                data = stage.config.data if isinstance(stage.config.data, dict) else {}
                media_type = str(data.get("mediaType") or "none").lower()
                raw_index = data.get("mediaIndex") or data.get("media_index")

                if media_type == "image" and raw_index:
                    try:
                        index = int(raw_index)
                        selected = media_index_map.get(index)
                        if selected:
                            data["mediaType"] = "image"
                            data["mediaIndex"] = index
                            data["mediaDescription"] = selected.description or data.get("mediaDescription")
                            data["mediaUrl"] = selected.asset_url or data.get("mediaUrl")
                            stage.config.data = data
                    except (TypeError, ValueError):
                        pass


        _notify_job_update(db, job, 80, "內容準備完成，正在儲存到資料庫...")

        # 寫入資料庫
        from app.models.lesson import LessonModel

        generation_metadata = {
            "allowed_components": resolved_allowed_components,
            "source": "lesson_generation",
            "job_id": job_id,
            "course_id": course_id,
            "node_id": node.id,
        }
        existing_lesson_query = db.query(LessonModel).filter(
            LessonModel.node_id == node.id,
            LessonModel.course_topic == topic,
            LessonModel.user_id == user.id,
        )
        if course_id is not None:
            existing_lesson_query = existing_lesson_query.filter(
                LessonModel.course_id == course_id
            )

        existing_lesson = existing_lesson_query.order_by(LessonModel.created_at.desc()).first()

        if existing_lesson:
            existing_lesson.generation_metadata_json = generation_metadata
            existing_lesson.status = "generated"
            existing_lesson.schema_version = 2
            existing_lesson.generator_provider = settings.LLM_PROVIDER
            existing_lesson.generator_model = (
                settings.GEMINI_MODEL
                if settings.LLM_PROVIDER == "google"
                else settings.LMSTUDIO_MODEL
            )
            existing_lesson.created_at = utc_now()
            db.add(existing_lesson)
            db.flush()
            sync_lesson_stages(db, lesson=existing_lesson, stages=stages)
        else:
            new_lesson = LessonModel(
                node_id=node.id,
                course_topic=topic,
                status="generated",
                schema_version=2,
                generator_provider=settings.LLM_PROVIDER,
                generator_model=(
                    settings.GEMINI_MODEL
                    if settings.LLM_PROVIDER == "google"
                    else settings.LMSTUDIO_MODEL
                ),
                generation_metadata_json=generation_metadata,
                user_id=user.id,
                course_id=course_id,
            )
            db.add(new_lesson)
            db.flush()
            sync_lesson_stages(db, lesson=new_lesson, stages=stages)

        # 扣點數
        spend_user_credits(
            db,
            user,
            COST,
            reason="lesson_generation",
            idempotency_scope="job:lesson_generation_charge",
            idempotency_key=job_id,
            metadata={
                "source": "lesson_generation",
                "job_id": job_id,
                "course_id": course_id,
                "node_id": node.id,
            },
        )
        job.progress = 100
        job.message = "🎉 單元建立完成！"
        job.status = JobStatus.COMPLETED
        job.result_data = {
            "stages": [s.model_dump() for s in stages],
            "allowed_components": resolved_allowed_components,
            "node_id": node.id,
            "course_id": course_id,
            "topic": topic,
        }
        db.commit()
        db.refresh(job)
        _publish_job_notification(db, job)

    except Exception as e:
        logger.error(f"Lesson generation job failed: {e}")
        db.rollback()
        if job is not None:
            job.progress = int(job.progress or 0)
            job.message = f"生成失敗: {str(e)}"
            job.status = JobStatus.FAILED
            db.commit()
            db.refresh(job)
            _publish_job_notification(db, job)

    finally:
        db.close()


async def run_remedial_generation_job(
    job_id: str,
    user_id: int,
    topic: str,
    node_id: str | None,
    course_id: int | None,
    failed_stages: list[dict],
    session_id: int | None = None,
    learner_profile_summary: str = "",
    voice_preset: str = settings.DEFAULT_VOICE_PRESET,
):
    """
    在背景獨立執行補救課程生成的 Worker。
    """
    db = SessionLocal()
    job = None
    try:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job or job.status == JobStatus.CANCELLED:
            return

        _notify_job_update(
            db, job, 10, "Analyzing failed stages...", status=JobStatus.PROCESSING
        )

        provider = LLMFactory.create()
        rag_engine = RAGEngine(provider)
        from app.services.infra.files.service import FileService
        from app.services.ai_engine.agents.course_architect import AIArchitectService
        from app.schemas.lesson_schema import FailedStageRecord

        file_service = FileService()
        architect_service = AIArchitectService(provider, rag_engine, file_service)

        from app.models.course_media_asset import CourseMediaAssetModel
        from app.services.infra.media.catalog import (
            build_media_catalog,
            build_media_index_map,
            format_media_catalog,
        )

        media_catalog = None
        media_index_map = {}
        if course_id is not None:
            assets = (
                db.query(CourseMediaAssetModel)
                .filter(CourseMediaAssetModel.course_id == course_id)
                .order_by(
                    CourseMediaAssetModel.source_filename.asc(),
                    CourseMediaAssetModel.page_number.asc().nullslast(),
                    CourseMediaAssetModel.asset_index.asc().nullslast(),
                    CourseMediaAssetModel.id.asc(),
                )
                .all()
            )
            if assets:
                catalog_items = build_media_catalog(assets)
                media_catalog = format_media_catalog(catalog_items)
                media_index_map = build_media_index_map(catalog_items)

        failed_records = [FailedStageRecord(**record) for record in failed_stages]
        remedial_stages = await architect_service.generate_remedial_stages(
            failed_records,
            topic=topic or "General Concept",
            learner_profile_summary=learner_profile_summary,
            media_catalog=media_catalog,
        )

        # Post-process media indices in remedial stages
        if remedial_stages:
            for stage in remedial_stages:
                if stage.component != "ExplainerMedia":
                    continue
                data = stage.config.data if isinstance(stage.config.data, dict) else {}
                media_type = str(data.get("mediaType") or "none").lower()
                raw_index = data.get("mediaIndex") or data.get("media_index")

                if media_type == "image" and raw_index:
                    try:
                        index = int(raw_index)
                        selected = media_index_map.get(index)
                        if selected:
                            data["mediaType"] = "image"
                            data["mediaIndex"] = index
                            data["mediaDescription"] = selected.description or data.get("mediaDescription")
                            data["mediaUrl"] = selected.asset_url or data.get("mediaUrl")
                            stage.config.data = data
                    except (TypeError, ValueError):
                        pass

        if _is_cancelled(db, job_id):
            return

        if not remedial_stages:
            raise Exception("No remedial stages were generated.")

        stages_json = []
        for stage in remedial_stages:
            stage_payload = stage.model_dump()
            initial_state = (
                stage_payload.get("config", {}).get("initialState", {}) or {}
            )
            stage_payload["config"]["initialState"] = {
                **initial_state,
                "isRemedial": True,
            }
            stages_json.append(stage_payload)
        remedial_stage_count, remedial_question_count, remedial_estimated_minutes = summarize_stages(
            remedial_stages
        )

        from app.models.lesson import (
            LessonFailedStageModel,
            LessonRemedialModel,
            LessonSessionModel,
        )

        remedial_record = (
            db.query(LessonRemedialModel)
            .filter(
                LessonRemedialModel.user_id == user_id,
                LessonRemedialModel.node_id == node_id,
                LessonRemedialModel.course_topic == topic,
                LessonRemedialModel.course_id == course_id,
            )
            .first()
        )
        if remedial_record:
            remedial_record.lesson_session_id = session_id
            remedial_record.stage_count = remedial_stage_count
            remedial_record.question_count = remedial_question_count
            remedial_record.estimated_duration_minutes = remedial_estimated_minutes
            remedial_record.schema_version = 2
            db.add(remedial_record)
            db.flush()
        else:
            remedial_record = LessonRemedialModel(
                user_id=user_id,
                course_id=course_id,
                lesson_session_id=session_id,
                node_id=node_id,
                course_topic=topic,
                stage_count=remedial_stage_count,
                question_count=remedial_question_count,
                estimated_duration_minutes=remedial_estimated_minutes,
                schema_version=2,
            )
            db.add(remedial_record)
            db.flush()

        sync_remedial_stages(db, remedial=remedial_record, stages=remedial_stages)

        if session_id:
            session = (
                db.query(LessonSessionModel)
                .filter(LessonSessionModel.id == session_id)
                .first()
            )
            if session:
                session.status = LessonSessionStatus.PLAYING_REMEDIAL
                session.active_phase = LessonSessionPhase.REMEDIAL
                session.schema_version = 2
                db.add(session)
                db.flush()
                remedial_stage_by_uid = {
                    item.stage_uid: item for item in (remedial_record.stages or [])
                }
                sync_session_stages(
                    db,
                    session=session,
                    stages=remedial_stages,
                    phase=LessonSessionPhase.REMEDIAL,
                    remedial_stage_by_uid=remedial_stage_by_uid,
                )

            failed_records = (
                db.query(LessonFailedStageModel)
                .filter(
                    LessonFailedStageModel.lesson_session_id == session_id,
                    LessonFailedStageModel.status == LessonFailedStageStatus.PENDING,
                )
                .all()
            )
            for record in failed_records:
                record.status = LessonFailedStageStatus.REMEDIAL_GENERATED
                db.add(record)
        db.commit()

        # 啟動非同步背景任務預建補救課程音檔快取
        import asyncio
        asyncio.create_task(_prebuild_audios(remedial_stages, voice_preset))

        _notify_job_update(
            db,
            job,
            100,
            "Remedial lesson is ready.",
            status=JobStatus.COMPLETED,
            result_data={"stages": stages_json, "session_id": session_id},
        )

    except Exception as e:
        logger.error(f"Remedial generation job failed: {e}")
        db.rollback()
        if job is not None:
            _notify_job_update(
                db,
                job,
                job.progress or 0,
                f"Remedial generation failed: {str(e)}",
                status=JobStatus.FAILED,
            )

    finally:
        db.close()
