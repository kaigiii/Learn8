"use client";

import { useMemo } from "react";
import type { LessonSessionSummary } from "@/lib/apiTypes";
import {
  LESSON_SESSION_PHASE,
  LESSON_SESSION_STATUS,
} from "@/lib/domain/statuses";
import { getAccuracy, getElapsedTime, getXpGained, type LessonSessionState } from "@/stores/session/useLessonSessionStore";

interface UseLocalLessonResultSummaryParams {
  hasLessonSession: boolean;
  backendCourseId: string | null;
  nodeId: string;
  sessionId: number | null;
  lessonSessionState: LessonSessionState;
}

export function useLocalLessonResultSummary({
  hasLessonSession,
  backendCourseId,
  nodeId,
  sessionId,
  lessonSessionState,
}: UseLocalLessonResultSummaryParams) {
  const actualAccuracy = useMemo(() => getAccuracy(lessonSessionState), [lessonSessionState]);
  const actualTime = useMemo(() => getElapsedTime(lessonSessionState), [lessonSessionState]);
  const actualXp = useMemo(() => getXpGained(lessonSessionState), [lessonSessionState]);

  const localSummary = useMemo<LessonSessionSummary | null>(() => {
    if (!hasLessonSession) {
      return null;
    }

    if (lessonSessionState.resumedSession) {
      return null;
    }

    return {
      sessionId: sessionId ?? 0,
      courseId: backendCourseId ? Number(backendCourseId) : null,
      nodeId,
      status: LESSON_SESSION_STATUS.COMPLETED,
      activePhase: LESSON_SESSION_PHASE.PRIMARY,
      rewardEligible: lessonSessionState.rewardEligible,
      totalStages: lessonSessionState.totalStages,
      attemptedCount: lessonSessionState.correctCount + lessonSessionState.incorrectCount,
      correctCount: lessonSessionState.correctCount,
      incorrectCount: lessonSessionState.incorrectCount,
      skippedCount: Math.max(
        0,
        lessonSessionState.totalStages - (lessonSessionState.correctCount + lessonSessionState.incorrectCount)
      ),
      accuracy: actualAccuracy,
      elapsedSeconds: 0,
      elapsedLabel: actualTime,
      xpGained: actualXp,
    };
  }, [actualAccuracy, actualTime, actualXp, lessonSessionState, backendCourseId, hasLessonSession, nodeId, sessionId]);

  return {
    localSummary,
    actualXp,
  };
}
