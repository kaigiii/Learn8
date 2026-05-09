from fastapi import HTTPException

from app.domain.statuses import CourseStatus
from app.models.course import CourseModel


EDITABLE_DRAFT_STATUSES = {
    CourseStatus.DRAFT,
    CourseStatus.QUESTIONNAIRE_READY,
    CourseStatus.PROFILING,
}

QUESTIONNAIRE_STARTABLE_STATUSES = {
    CourseStatus.DRAFT,
    CourseStatus.QUESTIONNAIRE_READY,
}

QUESTIONNAIRE_SUBMITTABLE_STATUSES = {
    CourseStatus.QUESTIONNAIRE_READY,
    CourseStatus.PROFILING,
}

SYLLABUS_STARTABLE_STATUSES = {
    CourseStatus.PROFILING,
    CourseStatus.READY,
}


def _raise_invalid_transition(detail: str) -> None:
    raise HTTPException(status_code=409, detail=detail)


def course_has_topic(course: CourseModel) -> bool:
    return bool((course.topic or "").strip())


def course_has_profile(course: CourseModel) -> bool:
    return bool(course.profile_json)


def sync_questionnaire_readiness_from_draft(course: CourseModel) -> None:
    if course.status == CourseStatus.DRAFT and course_has_topic(course):
        course.status = CourseStatus.QUESTIONNAIRE_READY


def ensure_course_can_edit_draft(course: CourseModel) -> None:
    if course.status == CourseStatus.ARCHIVED:
        _raise_invalid_transition("Archived courses cannot be edited.")
    if course.status == CourseStatus.GENERATING:
        _raise_invalid_transition(
            "Course draft is locked while syllabus generation is in progress."
        )
    if course.status not in EDITABLE_DRAFT_STATUSES:
        _raise_invalid_transition(
            f"Draft editing is not allowed while course status is '{course.status}'."
        )


def ensure_course_can_generate_questionnaire(course: CourseModel) -> None:
    if course.status == CourseStatus.ARCHIVED:
        _raise_invalid_transition("Archived courses cannot generate questionnaires.")
    if course.status == CourseStatus.GENERATING:
        _raise_invalid_transition(
            "Questionnaire generation is unavailable while syllabus generation is running."
        )
    if course.status == CourseStatus.READY:
        _raise_invalid_transition(
            "This course already has a syllabus. Edit the draft first if you want to regenerate the questionnaire."
        )
    if course.status not in QUESTIONNAIRE_STARTABLE_STATUSES:
        _raise_invalid_transition(
            f"Questionnaire generation is not allowed while course status is '{course.status}'."
        )
    if not course_has_topic(course):
        _raise_invalid_transition(
            "A topic is required before generating a questionnaire."
        )


def ensure_course_can_submit_questionnaire(course: CourseModel) -> None:
    if course.status == CourseStatus.ARCHIVED:
        _raise_invalid_transition("Archived courses cannot submit questionnaires.")
    if course.status == CourseStatus.GENERATING:
        _raise_invalid_transition(
            "Questionnaire submission is unavailable while syllabus generation is running."
        )
    if course.status not in QUESTIONNAIRE_SUBMITTABLE_STATUSES:
        _raise_invalid_transition(
            f"Questionnaire submission is not allowed while course status is '{course.status}'."
        )


def ensure_course_can_generate_syllabus(course: CourseModel, regenerate: bool) -> None:
    if course.status == CourseStatus.ARCHIVED:
        _raise_invalid_transition("Archived courses cannot generate syllabi.")
    if course.status == CourseStatus.GENERATING:
        _raise_invalid_transition("Syllabus generation is already in progress.")
    if course.status not in SYLLABUS_STARTABLE_STATUSES:
        _raise_invalid_transition(
            f"Syllabus generation is not allowed while course status is '{course.status}'."
        )
    if not course_has_profile(course):
        _raise_invalid_transition(
            "Learner profile is required before generating a syllabus."
        )
    if course.status == CourseStatus.READY and not regenerate:
        _raise_invalid_transition(
            "This course syllabus is already ready. Use regenerate=true to replace it."
        )


def ensure_course_ready_for_learning(course: CourseModel) -> None:
    if course.status != CourseStatus.READY:
        _raise_invalid_transition(
            f"Learning actions are only available when course status is '{CourseStatus.READY}'."
        )


def mark_questionnaire_started(course: CourseModel) -> None:
    if course_has_topic(course):
        course.status = CourseStatus.QUESTIONNAIRE_READY


def mark_questionnaire_completed(course: CourseModel) -> None:
    course.status = CourseStatus.PROFILING


def mark_syllabus_started(course: CourseModel) -> None:
    course.status = CourseStatus.GENERATING


def mark_syllabus_completed(course: CourseModel) -> None:
    course.status = CourseStatus.READY


def mark_syllabus_failed(course: CourseModel) -> None:
    if course_has_profile(course):
        course.status = CourseStatus.PROFILING
    elif course_has_topic(course):
        course.status = CourseStatus.QUESTIONNAIRE_READY
    else:
        course.status = CourseStatus.DRAFT
