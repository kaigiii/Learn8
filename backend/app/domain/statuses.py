class CourseStatus:
    DRAFT = "draft"
    QUESTIONNAIRE_READY = "questionnaire_ready"
    PROFILING = "profiling"
    GENERATING = "generating"
    READY = "ready"
    ARCHIVED = "archived"


class NodeStatus:
    LOCKED = "locked"
    AVAILABLE = "available"
    COMPLETED = "completed"


class LessonSessionStatus:
    PLAYING_PRIMARY = "playing_primary"
    REMEDIAL_GENERATING = "remedial_generating"
    PLAYING_REMEDIAL = "playing_remedial"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class LessonSessionPhase:
    PRIMARY = "primary"
    REMEDIAL = "remedial"


class LessonFailedStageStatus:
    PENDING = "pending"
    REMEDIAL_GENERATED = "remedial_generated"
    RESOLVED = "resolved"


class JobType:
    QUESTIONNAIRE_GENERATION = "QUESTIONNAIRE_GEN"
    SYLLABUS_GENERATION = "SYLLABUS_GEN"
    LESSON_GENERATION = "LESSON_GEN"
    REMEDIAL_GENERATION = "REMEDIAL_GEN"


class JobStatus:
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    STALE = "STALE"


ACTIVE_JOB_STATUSES = (
    JobStatus.PENDING,
    JobStatus.PROCESSING,
)

TERMINAL_JOB_STATUSES = (
    JobStatus.COMPLETED,
    JobStatus.FAILED,
    JobStatus.CANCELLED,
    JobStatus.STALE,
)

RETRYABLE_GENERATION_JOB_TYPES = (
    JobType.QUESTIONNAIRE_GENERATION,
    JobType.SYLLABUS_GENERATION,
    JobType.LESSON_GENERATION,
    JobType.REMEDIAL_GENERATION,
)

ACTIVE_LESSON_SESSION_STATUSES = (
    LessonSessionStatus.PLAYING_PRIMARY,
    LessonSessionStatus.REMEDIAL_GENERATING,
    LessonSessionStatus.PLAYING_REMEDIAL,
)

INTERACTIVE_LESSON_SESSION_STATUSES = (
    LessonSessionStatus.PLAYING_PRIMARY,
    LessonSessionStatus.PLAYING_REMEDIAL,
)
