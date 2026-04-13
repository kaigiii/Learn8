from __future__ import annotations

from typing import Iterable

from sqlalchemy.orm import Session

from app.core.time import utc_now
from app.domain.statuses import LessonSessionPhase
from app.models.lesson import (
    LessonModel,
    LessonRemedialModel,
    LessonRemedialStageModel,
    LessonSessionModel,
    LessonSessionStageModel,
    LessonStageModel,
)
from app.schemas.lesson_schema import LessonStage


def count_stage_items(stage: LessonStage) -> int:
    data = stage.config.data if isinstance(stage.config.data, dict) else {}
    component = stage.component

    if component == "MultipleChoice":
        options = data.get("options")
        return max(1, len(options)) if isinstance(options, list) else 1
    if component == "MatchingPairs":
        pairs = data.get("pairs")
        return max(1, len(pairs)) if isinstance(pairs, list) else 1
    if component == "Ordering":
        steps = data.get("steps")
        return max(1, len(steps)) if isinstance(steps, list) else 1
    if component == "FeynmanMirror":
        return 1
    return 1


def summarize_stages(stages: Iterable[LessonStage]) -> tuple[int, int, int | None]:
    stage_list = list(stages)
    stage_count = len(stage_list)
    question_count = sum(count_stage_items(stage) for stage in stage_list)
    estimated_duration_minutes = sum(
        int(stage.recommendedDurationMinutes or 0) for stage in stage_list
    )
    return (
        stage_count,
        question_count,
        estimated_duration_minutes if estimated_duration_minutes > 0 else None,
    )


def sync_lesson_stages(
    db: Session,
    *,
    lesson: LessonModel,
    stages: list[LessonStage],
) -> list[LessonStageModel]:
    now = utc_now()
    db.query(LessonStageModel).filter(LessonStageModel.lesson_id == lesson.id).delete()

    lesson_stages: list[LessonStageModel] = []
    for index, stage in enumerate(stages):
        lesson_stage = LessonStageModel(
            lesson_id=lesson.id,
            stage_uid=stage.stageId,
            stage_order=index,
            stage_type="interactive",
            topic=stage.topic,
            skin=stage.skin.value if hasattr(stage.skin, "value") else str(stage.skin),
            component=stage.component,
            difficulty=stage.difficulty.value if getattr(stage, "difficulty", None) else None,
            recommended_duration_minutes=stage.recommendedDurationMinutes,
            item_count=count_stage_items(stage),
            schema_version=2,
            content_json=stage.config.model_dump(),
            validation_json=stage.validation.model_dump(),
            feedback_json=stage.feedback.model_dump(),
            stage_snapshot_json=stage.model_dump(),
            created_at=now,
            updated_at=now,
        )
        db.add(lesson_stage)
        lesson_stages.append(lesson_stage)

    lesson.stage_count, lesson.question_count, lesson.estimated_duration_minutes = summarize_stages(
        stages
    )
    lesson.updated_at = now
    db.add(lesson)
    db.flush()
    return lesson_stages


def sync_session_stages(
    db: Session,
    *,
    session: LessonSessionModel,
    stages: list[LessonStage],
    phase: str,
    lesson_stage_by_uid: dict[str, LessonStageModel] | None = None,
    remedial_stage_by_uid: dict[str, LessonRemedialStageModel] | None = None,
) -> list[LessonSessionStageModel]:
    now = utc_now()
    db.query(LessonSessionStageModel).filter(
        LessonSessionStageModel.lesson_session_id == session.id,
        LessonSessionStageModel.phase == phase,
    ).delete()

    session_stages: list[LessonSessionStageModel] = []
    for index, stage in enumerate(stages):
        lesson_stage = lesson_stage_by_uid.get(stage.stageId) if lesson_stage_by_uid else None
        remedial_stage = (
            remedial_stage_by_uid.get(stage.stageId) if remedial_stage_by_uid else None
        )
        session_stage = LessonSessionStageModel(
            lesson_session_id=session.id,
            lesson_stage_id=lesson_stage.id if lesson_stage else None,
            lesson_remedial_stage_id=remedial_stage.id if remedial_stage else None,
            stage_uid=stage.stageId,
            stage_order=index,
            phase=phase,
            source_stage_uid=(
                remedial_stage.stage_uid
                if phase == LessonSessionPhase.REMEDIAL and remedial_stage
                else None
            ),
            status="pending",
            topic=stage.topic,
            skin=stage.skin.value if hasattr(stage.skin, "value") else str(stage.skin),
            component=stage.component,
            difficulty=stage.difficulty.value if getattr(stage, "difficulty", None) else None,
            recommended_duration_minutes=stage.recommendedDurationMinutes,
            item_count=count_stage_items(stage),
            schema_version=2,
            content_json=stage.config.model_dump(),
            validation_json=stage.validation.model_dump(),
            feedback_json=stage.feedback.model_dump(),
            stage_snapshot_json=stage.model_dump(),
            created_at=now,
            updated_at=now,
        )
        db.add(session_stage)
        session_stages.append(session_stage)

    primary_stage_count, _, _ = summarize_stages(stages) if phase == LessonSessionPhase.PRIMARY else (0, 0, None)
    remedial_stage_count, _, _ = summarize_stages(stages) if phase == LessonSessionPhase.REMEDIAL else (0, 0, None)
    if phase == LessonSessionPhase.PRIMARY:
        session.primary_stage_count = primary_stage_count
    else:
        session.remedial_stage_count = remedial_stage_count
    session.total_stage_count = int(session.primary_stage_count or 0) + int(
        session.remedial_stage_count or 0
    )
    session.updated_at = now
    db.add(session)
    db.flush()
    return session_stages


def sync_remedial_stages(
    db: Session,
    *,
    remedial: LessonRemedialModel,
    stages: list[LessonStage],
) -> list[LessonRemedialStageModel]:
    now = utc_now()
    db.query(LessonRemedialStageModel).filter(
        LessonRemedialStageModel.lesson_remedial_id == remedial.id
    ).delete()

    remedial_stages: list[LessonRemedialStageModel] = []
    for index, stage in enumerate(stages):
        remedial_stage = LessonRemedialStageModel(
            lesson_remedial_id=remedial.id,
            stage_uid=stage.stageId,
            stage_order=index,
            stage_type="interactive",
            topic=stage.topic,
            skin=stage.skin.value if hasattr(stage.skin, "value") else str(stage.skin),
            component=stage.component,
            difficulty=stage.difficulty.value if getattr(stage, "difficulty", None) else None,
            recommended_duration_minutes=stage.recommendedDurationMinutes,
            item_count=count_stage_items(stage),
            schema_version=2,
            content_json=stage.config.model_dump(),
            validation_json=stage.validation.model_dump(),
            feedback_json=stage.feedback.model_dump(),
            stage_snapshot_json=stage.model_dump(),
            created_at=now,
            updated_at=now,
        )
        db.add(remedial_stage)
        remedial_stages.append(remedial_stage)

    remedial.stage_count, remedial.question_count, remedial.estimated_duration_minutes = summarize_stages(
        stages
    )
    remedial.updated_at = now
    db.add(remedial)
    db.flush()
    return remedial_stages
