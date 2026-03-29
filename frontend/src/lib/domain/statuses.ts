export const COURSE_STATUS = {
  DRAFT: "draft",
  QUESTIONNAIRE_READY: "questionnaire_ready",
  PROFILING: "profiling",
  GENERATING: "generating",
  READY: "ready",
  ARCHIVED: "archived",
} as const;

export type CourseStatus = (typeof COURSE_STATUS)[keyof typeof COURSE_STATUS];

export const NODE_STATUS = {
  LOCKED: "locked",
  AVAILABLE: "available",
  COMPLETED: "completed",
} as const;

export type NodeStatus = (typeof NODE_STATUS)[keyof typeof NODE_STATUS];

export const JOB_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  STALE: "STALE",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const JOB_TYPE = {
  QUESTIONNAIRE_GENERATION: "QUESTIONNAIRE_GEN",
  SYLLABUS_GENERATION: "SYLLABUS_GEN",
  LESSON_GENERATION: "LESSON_GEN",
  REMEDIAL_GENERATION: "REMEDIAL_GEN",
} as const;

export type JobType = (typeof JOB_TYPE)[keyof typeof JOB_TYPE];

export const LESSON_SESSION_STATUS = {
  PLAYING_PRIMARY: "playing_primary",
  REMEDIAL_GENERATING: "remedial_generating",
  PLAYING_REMEDIAL: "playing_remedial",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  FAILED: "failed",
} as const;

export type LessonSessionStatus =
  (typeof LESSON_SESSION_STATUS)[keyof typeof LESSON_SESSION_STATUS];

export const LESSON_SESSION_PHASE = {
  PRIMARY: "primary",
  REMEDIAL: "remedial",
} as const;

export type LessonSessionPhase =
  (typeof LESSON_SESSION_PHASE)[keyof typeof LESSON_SESSION_PHASE];

export const ACTIVE_LESSON_SESSION_STATUSES = [
  LESSON_SESSION_STATUS.PLAYING_PRIMARY,
  LESSON_SESSION_STATUS.PLAYING_REMEDIAL,
] as const;
