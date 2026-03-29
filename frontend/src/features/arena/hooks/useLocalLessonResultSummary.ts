"use client";

import { useMemo } from "react";
import type { LessonSessionSummary } from "@/lib/apiTypes";
import {
  LESSON_SESSION_PHASE,
  LESSON_SESSION_STATUS,
} from "@/lib/domain/statuses";
import { getAccuracy, getElapsedTime, getXpGained, type ArenaState } from "@/stores/session/useArenaStore";

interface UseLocalLessonResultSummaryParams {
  hasArenaSession: boolean;
  backendCourseId: string | null;
  nodeId: string;
  sessionId: number | null;
  arenaState: ArenaState;
}

export function useLocalLessonResultSummary({
  hasArenaSession,
  backendCourseId,
  nodeId,
  sessionId,
  arenaState,
}: UseLocalLessonResultSummaryParams) {
  const actualAccuracy = useMemo(() => getAccuracy(arenaState), [arenaState]);
  const actualTime = useMemo(() => getElapsedTime(arenaState), [arenaState]);
  const actualXp = useMemo(() => getXpGained(arenaState), [arenaState]);

  const localSummary = useMemo<LessonSessionSummary | null>(() => {
    if (!hasArenaSession) {
      return null;
    }

    if (arenaState.resumedSession) {
      return null;
    }

    return {
      sessionId: sessionId ?? 0,
      courseId: backendCourseId ? Number(backendCourseId) : null,
      nodeId,
      status: LESSON_SESSION_STATUS.COMPLETED,
      activePhase: LESSON_SESSION_PHASE.PRIMARY,
      rewardEligible: arenaState.rewardEligible,
      totalStages: arenaState.totalStages,
      attemptedCount: arenaState.correctCount + arenaState.incorrectCount,
      correctCount: arenaState.correctCount,
      incorrectCount: arenaState.incorrectCount,
      skippedCount: Math.max(
        0,
        arenaState.totalStages - (arenaState.correctCount + arenaState.incorrectCount)
      ),
      accuracy: actualAccuracy,
      elapsedSeconds: 0,
      elapsedLabel: actualTime,
      xpGained: actualXp,
    };
  }, [actualAccuracy, actualTime, actualXp, arenaState, backendCourseId, hasArenaSession, nodeId, sessionId]);

  return {
    localSummary,
    actualXp,
  };
}
