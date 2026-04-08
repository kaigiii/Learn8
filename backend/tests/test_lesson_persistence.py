import asyncio

from app.api.v1.endpoints.lessons import start_lesson_session
from app.models.course import CourseModel
from app.models.lesson import LessonModel, LessonRemedialModel, LessonSessionModel, LessonSessionStageModel
from app.schemas.lesson_schema import (
    Feedback,
    GenericConfig,
    LessonSessionStartRequest,
    LessonStage,
    SkinType,
    Validation,
    ValidationType,
)
from app.services.commons.lesson_persistence import (
    sync_lesson_stages,
    sync_remedial_stages,
    sync_session_stages,
)


def _create_course(db_session, user_id: int) -> CourseModel:
    course = CourseModel(
        user_id=user_id,
        topic="Python Basics",
        title="Python Basics",
        syllabus_json={"units": []},
    )
    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)
    return course


def _build_stage(stage_id: str, prompt: str) -> LessonStage:
    return LessonStage(
        stageId=stage_id,
        topic="Python Basics",
        skin=SkinType.Classic,
        component="MultipleChoice",
        difficulty="medium",
        recommendedDurationMinutes=5,
        validation=Validation(type=ValidationType.Exact, condition="b"),
        feedback=Feedback(success="Nice work", error="Try again"),
        config=GenericConfig(
            data={
                "question": prompt,
                "options": [
                    {"id": "a", "text": "tuple"},
                    {"id": "b", "text": "list"},
                ],
                "correctOptionId": "b",
            },
            initialState={},
        ),
    )


def test_sync_session_stages_allows_primary_and_remedial_overlap(db_session, user):
    course = _create_course(db_session, user.id)
    lesson = LessonModel(
        user_id=user.id,
        course_id=course.id,
        node_id="node-1",
        course_topic="Python Basics",
        status="generated",
        schema_version=2,
    )
    session = LessonSessionModel(
        user_id=user.id,
        course_id=course.id,
        lesson=lesson,
        node_id="node-1",
        course_topic="Python Basics",
        schema_version=2,
    )
    db_session.add_all([lesson, session])
    db_session.flush()

    primary_stages = [_build_stage("primary-1", "Primary 1"), _build_stage("primary-2", "Primary 2")]
    remedial_stages = [_build_stage("remedial-1", "Remedial 1"), _build_stage("remedial-2", "Remedial 2")]
    lesson_stage_by_uid = {
        item.stage_uid: item for item in sync_lesson_stages(db_session, lesson=lesson, stages=primary_stages)
    }
    remedial = LessonRemedialModel(
        user_id=user.id,
        course_id=course.id,
        lesson_session_id=session.id,
        node_id="node-1",
        course_topic="Python Basics",
        schema_version=2,
    )
    db_session.add(remedial)
    db_session.flush()
    remedial_stage_by_uid = {
        item.stage_uid: item for item in sync_remedial_stages(db_session, remedial=remedial, stages=remedial_stages)
    }

    sync_session_stages(
        db_session,
        session=session,
        stages=primary_stages,
        phase="primary",
        lesson_stage_by_uid=lesson_stage_by_uid,
    )
    sync_session_stages(
        db_session,
        session=session,
        stages=remedial_stages,
        phase="remedial",
        remedial_stage_by_uid=remedial_stage_by_uid,
    )
    db_session.commit()

    stored = (
        db_session.query(LessonSessionStageModel)
        .filter(LessonSessionStageModel.lesson_session_id == session.id)
        .order_by(LessonSessionStageModel.phase.asc(), LessonSessionStageModel.stage_order.asc())
        .all()
    )
    assert len(stored) == 4
    assert [item.stage_order for item in stored if item.phase == "primary"] == [0, 1]
    assert [item.stage_order for item in stored if item.phase == "remedial"] == [0, 1]
    assert all(item.lesson_stage_id is not None for item in stored if item.phase == "primary")
    assert all(item.lesson_remedial_stage_id is not None for item in stored if item.phase == "remedial")


def test_start_lesson_session_uses_canonical_lesson_stages(db_session, user):
    course = _create_course(db_session, user.id)
    lesson = LessonModel(
        user_id=user.id,
        course_id=course.id,
        node_id="node-2",
        course_topic="Python Basics",
        status="generated",
        schema_version=2,
    )
    db_session.add(lesson)
    db_session.flush()
    canonical_stages = [
        _build_stage("canonical-1", "Canonical 1"),
        _build_stage("canonical-2", "Canonical 2"),
    ]
    sync_lesson_stages(db_session, lesson=lesson, stages=canonical_stages)
    db_session.commit()

    payload = asyncio.run(
        start_lesson_session(
            LessonSessionStartRequest(
                lessonId=lesson.id,
                courseId=course.id,
                nodeId="node-2",
                topic="Python Basics",
            ),
            current_user=user,
            db=db_session,
        )
    )

    assert [stage.stageId for stage in payload.primaryStages] == ["canonical-1", "canonical-2"]
    session = (
        db_session.query(LessonSessionModel)
        .filter(LessonSessionModel.id == payload.sessionId)
        .first()
    )
    assert session is not None
    stored_session_stages = (
        db_session.query(LessonSessionStageModel)
        .filter(LessonSessionStageModel.lesson_session_id == session.id, LessonSessionStageModel.phase == "primary")
        .order_by(LessonSessionStageModel.stage_order.asc())
        .all()
    )
    assert len(stored_session_stages) == 2
    assert [item.stage_uid for item in stored_session_stages] == ["canonical-1", "canonical-2"]
