"use client";

interface RecentCourseNavigation {
  courseId?: number;
  timestamp?: number;
}

interface PendingLessonNavigation {
  courseId?: number;
  nodeId?: string;
 }

interface PendingQuestionnaireNavigation {
  courseId?: number;
  topic?: string;
}

const RECENT_COURSE_KEY = "learn8_recent_course_navigation";
const PENDING_LESSON_KEY = "learn8_pending_lesson";
const PENDING_QUESTIONNAIRE_KEY = "learn8_pending_questionnaire";
const RECENT_COURSE_TTL_MS = 15_000;

function readSessionJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function rememberCourseNavigation(courseId: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    RECENT_COURSE_KEY,
    JSON.stringify({
      courseId,
      timestamp: Date.now(),
    })
  );
}

export function getRecentCourseNavigation(): number | null {
  const recent = readSessionJson<RecentCourseNavigation>(RECENT_COURSE_KEY);
  if (!recent?.courseId || !Number.isFinite(recent.courseId)) {
    return null;
  }

  const timestamp = recent.timestamp ?? 0;
  if (Date.now() - timestamp > RECENT_COURSE_TTL_MS) {
    clearRecentCourseNavigation();
    return null;
  }

  return recent.courseId;
}

export function clearRecentCourseNavigation() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(RECENT_COURSE_KEY);
}

export function rememberPendingLessonNavigation(courseId: number, nodeId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    PENDING_LESSON_KEY,
    JSON.stringify({
      courseId,
      nodeId,
    })
  );
}

export function clearPendingLessonNavigation() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_LESSON_KEY);
}

export function getPendingLessonHref(): string | null {
  const pending = getPendingLessonNavigation();
  if (!pending?.courseId || !pending?.nodeId) return null;
  return `/courses/${pending.courseId}/nodes/${pending.nodeId}`;
}

export function getPendingLessonNavigation() {
  return readSessionJson<PendingLessonNavigation>(PENDING_LESSON_KEY);
}

export function rememberPendingQuestionnaireNavigation(
  courseId: number,
  topic?: string
) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    PENDING_QUESTIONNAIRE_KEY,
    JSON.stringify({
      courseId,
      topic,
    })
  );
}

export function getPendingQuestionnaireNavigation() {
  return readSessionJson<PendingQuestionnaireNavigation>(PENDING_QUESTIONNAIRE_KEY);
}

export function clearPendingQuestionnaireNavigation() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_QUESTIONNAIRE_KEY);
}

export function getPendingQuestionnaireHref(): string | null {
  const pending = getPendingQuestionnaireNavigation();
  if (typeof pending?.courseId !== "number") return null;
  return `/questionnaire?courseId=${pending.courseId}`;
}

export function clearAllNavigationIntents() {
  clearRecentCourseNavigation();
  clearPendingLessonNavigation();
  clearPendingQuestionnaireNavigation();
}

export function resolvePreferredAuthenticatedHref(fallbackHref = "/home") {
  return (
    getPendingLessonHref() ||
    getPendingQuestionnaireHref() ||
    (() => {
      const courseId = getRecentCourseNavigation();
      return courseId ? `/courses/${courseId}` : null;
    })() ||
    fallbackHref
  );
}
