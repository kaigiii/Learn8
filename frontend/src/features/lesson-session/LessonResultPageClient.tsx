"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import useLessonSessionStore, {
  selectLessonSessionScoreState,
  selectLessonSessionIdentity,
} from "@/stores/session/useLessonSessionStore";
import { useLocalLessonResultSummary } from "./hooks/useLocalLessonResultSummary";
import { useLessonResultSummary } from "./hooks/useLessonResultSummary";
import { useLessonRewardAnimation } from "./hooks/useLessonRewardAnimation";
import { useResolvedLessonRoute } from "./hooks/useResolvedLessonRoute";
import { LessonResultStateScreen } from "./components/LessonResultStateScreen";
import { LessonResultSkeleton } from "./components/LessonResultSkeleton";
import { LessonResultView } from "./components/LessonResultView";
import { useDelayedVisibility } from "@/lib/ui/useDelayedVisibility";

/* ═══════════════════ Rolling Counter Hook ═══════════════════ */

function useRollingNumber(target: number, duration = 1200, delay = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return value;
}

/* ═══════════════════ Page ═══════════════════ */

export default function LessonResultPageClient({
  courseId: explicitCourseId,
  nodeId: explicitNodeId,
}: {
  courseId?: string;
  nodeId?: string;
} = {}) {
  const router = useRouter();
  const { isReady } = useRequireAuthRedirect();
  const { nodeId, backendCourseId, isBackendCourse, sessionId } =
    useResolvedLessonRoute({
      courseId: explicitCourseId,
      nodeId: explicitNodeId,
    });

  const lessonSessionIdentity = useLessonSessionStore(selectLessonSessionIdentity);
  const lessonSessionScoreState = useLessonSessionStore(selectLessonSessionScoreState);
  const endSession = useLessonSessionStore((s) => s.endSession);
  const hasLessonSession =
    lessonSessionIdentity.courseId === backendCourseId &&
    lessonSessionIdentity.nodeId === nodeId &&
    lessonSessionIdentity.totalStages > 0 &&
    lessonSessionIdentity.startTime !== null;

  const lessonSessionState = useMemo(
    () => ({
      nodeId: lessonSessionIdentity.nodeId,
      courseId: lessonSessionIdentity.courseId,
      totalStages: lessonSessionIdentity.totalStages,
      rewardEligible: lessonSessionIdentity.rewardEligible,
      resumedSession: lessonSessionIdentity.resumedSession,
      currentStageIndex: 0,
      isCorrect: null,
      showFeedback: false,
      correctCount: lessonSessionScoreState.correctCount,
      incorrectCount: lessonSessionScoreState.incorrectCount,
      hintsUsed: lessonSessionScoreState.hintsUsed,
      startTime: lessonSessionIdentity.startTime,
      endTime: lessonSessionIdentity.endTime,
      showConfetti: false,
      shakeScreen: false,
    }),
    [
      lessonSessionScoreState,
      lessonSessionIdentity,
    ]
  );
  const { localSummary, actualXp } = useLocalLessonResultSummary({
    hasLessonSession,
    backendCourseId,
    nodeId,
    sessionId,
    lessonSessionState,
  });

  const { backendSummary, summaryLoading, summaryResolved } = useLessonResultSummary({
    isReady,
    hasLessonSession,
    sessionId,
  });

  const {
    showLevelUp,
    xpBarWidth,
    barDuration,
    displayLevel,
    currentXp,
    currentXpToNext,
  } = useLessonRewardAnimation({
    enabled: hasLessonSession,
    rewardAmount: actualXp,
    rewardKey:
      hasLessonSession &&
      lessonSessionIdentity.courseId &&
      lessonSessionIdentity.nodeId &&
      lessonSessionIdentity.startTime
        ? `${lessonSessionIdentity.courseId}:${lessonSessionIdentity.nodeId}:${lessonSessionIdentity.startTime}`
        : null,
    endSession,
  });

  const courseId = backendCourseId!;
  const resultSummary = localSummary ?? backendSummary;
  const showSummaryLoadingState = useDelayedVisibility(
    !hasLessonSession && summaryLoading,
    260
  );

  const accuracy = useRollingNumber(resultSummary?.accuracy ?? 100, 1000, 1200);
  const xpGained = useRollingNumber(resultSummary?.xpGained ?? 0, 1000, 1200);

  useEffect(() => {
    if (
      !isReady ||
      hasLessonSession ||
      !isBackendCourse ||
      !summaryResolved ||
      summaryLoading ||
      resultSummary
    ) {
      return;
    }
    router.replace(`/courses/${courseId}`);
  }, [
    courseId,
    hasLessonSession,
    isBackendCourse,
    isReady,
    resultSummary,
    router,
    summaryResolved,
    summaryLoading,
  ]);

  if (!isBackendCourse) {
    return <LessonResultStateScreen title="Invalid result route." tone="warning" />;
  }

  if (!isReady) {
    return null;
  }

  if (!hasLessonSession && summaryLoading && showSummaryLoadingState) {
    return (
      <LessonResultStateScreen
        title="Loading lesson summary"
        description="Rebuilding this result page from the saved lesson session..."
        loading
      />
    );
  }

  if (!hasLessonSession && (!summaryResolved || summaryLoading)) {
    return <LessonResultSkeleton />;
  }

  if (!hasLessonSession && !resultSummary) {
    return null;
  }

  return (
    <LessonResultView
      resultSummary={resultSummary}
      accuracy={accuracy}
      xpGained={xpGained}
      showLevelUp={showLevelUp}
      displayLevel={displayLevel}
      currentXp={currentXp}
      currentXpToNext={currentXpToNext}
      xpBarWidth={xpBarWidth}
      barDuration={barDuration}
      onBackToMap={() => router.push(`/courses/${courseId}`)}
      />
  );
}
