"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import useArenaStore, {
  selectArenaScoreState,
  selectArenaSessionIdentity,
} from "@/stores/session/useArenaStore";
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

  const arenaSessionIdentity = useArenaStore(selectArenaSessionIdentity);
  const arenaScoreState = useArenaStore(selectArenaScoreState);
  const endSession = useArenaStore((s) => s.endSession);
  const hasArenaSession =
    arenaSessionIdentity.courseId === backendCourseId &&
    arenaSessionIdentity.nodeId === nodeId &&
    arenaSessionIdentity.totalStages > 0 &&
    arenaSessionIdentity.startTime !== null;

  const arenaState = useMemo(
    () => ({
      nodeId: arenaSessionIdentity.nodeId,
      courseId: arenaSessionIdentity.courseId,
      totalStages: arenaSessionIdentity.totalStages,
      rewardEligible: arenaSessionIdentity.rewardEligible,
      resumedSession: arenaSessionIdentity.resumedSession,
      currentStageIndex: 0,
      isCorrect: null,
      showFeedback: false,
      correctCount: arenaScoreState.correctCount,
      incorrectCount: arenaScoreState.incorrectCount,
      hintsUsed: arenaScoreState.hintsUsed,
      startTime: arenaSessionIdentity.startTime,
      endTime: arenaSessionIdentity.endTime,
      showConfetti: false,
      shakeScreen: false,
    }),
    [
      arenaScoreState,
      arenaSessionIdentity,
    ]
  );
  const { localSummary, actualXp } = useLocalLessonResultSummary({
    hasArenaSession,
    backendCourseId,
    nodeId,
    sessionId,
    arenaState,
  });

  const { backendSummary, summaryLoading, summaryResolved } = useLessonResultSummary({
    isReady,
    hasArenaSession,
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
    enabled: hasArenaSession,
    rewardAmount: actualXp,
    rewardKey:
      hasArenaSession &&
      arenaSessionIdentity.courseId &&
      arenaSessionIdentity.nodeId &&
      arenaSessionIdentity.startTime
        ? `${arenaSessionIdentity.courseId}:${arenaSessionIdentity.nodeId}:${arenaSessionIdentity.startTime}`
        : null,
    endSession,
  });

  const courseId = backendCourseId!;
  const resultSummary = localSummary ?? backendSummary;
  const showSummaryLoadingState = useDelayedVisibility(
    !hasArenaSession && summaryLoading,
    260
  );

  const accuracy = useRollingNumber(resultSummary?.accuracy ?? 100, 1000, 1200);
  const xpGained = useRollingNumber(resultSummary?.xpGained ?? 0, 1000, 1200);

  useEffect(() => {
    if (
      !isReady ||
      hasArenaSession ||
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
    hasArenaSession,
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

  if (!hasArenaSession && summaryLoading && showSummaryLoadingState) {
    return (
      <LessonResultStateScreen
        title="Loading lesson summary"
        description="Rebuilding this result page from the saved lesson session..."
        loading
      />
    );
  }

  if (!hasArenaSession && (!summaryResolved || summaryLoading)) {
    return <LessonResultSkeleton />;
  }

  if (!hasArenaSession && !resultSummary) {
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
