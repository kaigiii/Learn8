"use client";

import React, { useState, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import ForgeStatus from "@/components/feedback/ForgeStatus";
import GameButton from "@/components/ui/GameButton";
import TopProgressBar from "@/components/ui/TopProgressBar";
import { useCourseStore } from "@/stores/app/useCourseStore";
import useUserStore from "@/stores/app/useUserStore";
import useArenaStore from "@/stores/session/useArenaStore";
import { ArenaChatPanel } from "./components/ArenaChatPanel";
import { ArenaFeedbackOverlay } from "./components/ArenaFeedbackOverlay";
import { ArenaStageRenderer } from "./components/ArenaStageRenderer";
import { ArenaStatusPanel } from "./components/ArenaStatusPanel";
import { useArenaStageFlow } from "./hooks/useArenaStageFlow";
import { useLessonGenerationFlow } from "./hooks/useLessonGenerationFlow";
import { useLessonSessionFlow } from "./hooks/useLessonSessionFlow";
import { useResolvedLessonRoute } from "./hooks/useResolvedLessonRoute";
import { useDelayedVisibility } from "@/lib/ui/useDelayedVisibility";
import { LESSON_SESSION_PHASE, LESSON_SESSION_STATUS } from "@/lib/domain/statuses";

/* ═══════════════════ Page ═══════════════════ */

export default function LessonArenaPageClient({
  courseId: explicitCourseId,
  nodeId: explicitNodeId,
}: {
  courseId?: string;
  nodeId?: string;
} = {}) {
  const { nodeId, routeCourseId } = useResolvedLessonRoute({
    courseId: explicitCourseId,
    nodeId: explicitNodeId,
  });
  const resolvedRouteCourseId = routeCourseId ?? undefined;
  const currentCourseId = useCourseStore((s) => s.currentCourseId);

  // Arena store
  const startSession = useArenaStore((s) => s.startSession);
  const arenaMarkCorrect = useArenaStore((s) => s.markCorrect);
  const arenaMarkIncorrect = useArenaStore((s) => s.markIncorrect);
  const arenaUseHint = useArenaStore((s) => s.useHint);
  const arenaTriggerConfetti = useArenaStore((s) => s.triggerConfetti);
  const arenaTriggerShake = useArenaStore((s) => s.triggerShake);
  const arenaHintsUsed = useArenaStore((s) => s.hintsUsed);

  // User store
  const setLastActiveNode = useUserStore((s) => s.setLastActiveNode);

  const [stageIdx, setStageIdx] = useState(0);
  const resetInteractiveStageState = useCallback(() => {
    setStageIdx(0);
  }, []);
  const {
    backendCourseId,
    isBackendLesson,
    backendCourse,
    backendNode,
    backendStages,
    backendLoading,
    backendError,
    backendJobProgress,
    backendJobMessage,
    cancelGeneration,
  } = useLessonGenerationFlow({
    routeCourseId: resolvedRouteCourseId,
    nodeId,
    currentCourseId,
    onStagesReady: resetInteractiveStageState,
  });

  const {
    lessonSession,
    sessionLoading,
    phaseTransitionLoading,
    phaseTransitionMessage,
    phaseTransitionError,
    sessionError,
    activePhase,
    isSessionInteractive,
    isNavigatingToResult,
    completeCurrentPhase,
    retrySessionStart,
    retryPhaseTransition,
    handleExitLesson,
  } = useLessonSessionFlow({
    backendCourseId,
    routeCourseId: resolvedRouteCourseId,
    nodeId,
    currentCourseId,
    hintsUsed: arenaHintsUsed,
    backendCourse,
    backendNode,
    backendStages,
    onSessionStarted: (session) => {
      startSession({
        nodeId,
        courseId: String(backendCourseId),
        totalStages: Math.max(session.activeStages.length, 1),
        rewardEligible: session.rewardEligible,
        resumedSession: session.resumedSession,
      });
      setLastActiveNode(nodeId);
    },
    onRemedialStagesReady: resetInteractiveStageState,
  });
  const activeStages = lessonSession?.activeStages ?? backendStages;
  const backendStage = activeStages[stageIdx] ?? null;
  const backendMatchStage = useMemo(() => {
    if (backendStage?.component !== "MatchingPairs") return null;
    const data = backendStage.config.data as {
      question?: string;
      pairs?: { left: string; right: string }[];
    };
    return {
      question: data.question || backendStage.topic,
      pairs: (data.pairs || []).map((pair) => ({ left: pair.left, right: pair.right })),
    };
  }, [backendStage]);
  const activeStageCount = Math.max(activeStages.length, 1);
  const primaryStageCount = lessonSession?.primaryStages.length ?? backendStages.length;
  const remedialStageCount = lessonSession?.remedialStages.length ?? 0;
  const isRemedialPhase =
    lessonSession?.activePhase === LESSON_SESSION_PHASE.REMEDIAL ||
    lessonSession?.status === LESSON_SESSION_STATUS.PLAYING_REMEDIAL;
  const displayStageOffset = isRemedialPhase ? primaryStageCount : 0;
  const displayStageIdx = stageIdx + displayStageOffset;
  const displayTotalStages = Math.max(primaryStageCount + remedialStageCount, activeStageCount);
  const headerStageIdx = stageIdx;
  const headerTotalStages = isRemedialPhase
    ? Math.max(remedialStageCount, activeStageCount)
    : Math.max(primaryStageCount, activeStageCount);
  const headerStageLabel = isRemedialPhase ? "Remedial" : "Stage";
  const progress = (displayStageIdx / displayTotalStages) * 100;
  const nodeDescription = backendNode?.description ?? "";
  const matchPairs = useMemo(() => backendMatchStage?.pairs ?? [], [backendMatchStage]);

  const { matchingStage, submitStage, continueStage, skipStage, useHint } =
    useArenaStageFlow({
      lessonSession,
      isSessionInteractive,
      backendCourse,
      backendStage,
      matchPairs,
      stageIdx,
      totalStages: activeStageCount,
      onCorrect: () => {
        arenaMarkCorrect();
        arenaTriggerConfetti();
      },
      onIncorrect: () => {
        arenaMarkIncorrect();
        arenaTriggerShake();
      },
      onHintUsed: arenaUseHint,
      onAdvanceStage: () => setStageIdx((i) => i + 1),
      onCompletePhase: completeCurrentPhase,
    });

  const hasPendingStatusFlow =
    backendLoading ||
    sessionLoading ||
    phaseTransitionLoading ||
    (!!lessonSession && (!isSessionInteractive || isNavigatingToResult));
  const awaitingSessionStart =
    backendStages.length > 0 && !lessonSession && !sessionError;
  const showDelayedStatusPanel = useDelayedVisibility(hasPendingStatusFlow, 260);
  const shouldRenderStatusPanel =
    !!phaseTransitionError || (!backendStage ? hasPendingStatusFlow : showDelayedStatusPanel);
  const shouldRenderArenaSkeleton =
    (!backendStage && hasPendingStatusFlow && !shouldRenderStatusPanel && !backendError) ||
    awaitingSessionStart;
  const shouldRenderImmersiveStatus =
    shouldRenderStatusPanel ||
    shouldRenderArenaSkeleton ||
    !!sessionError ||
    !!backendError;

  if (!isBackendLesson) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]">
        <TopProgressBar progress={0} />
        <div className="mx-auto flex min-h-[calc(100vh-12px)] max-w-3xl items-center justify-center px-6">
          <div className="rounded-3xl border border-amber-200 bg-white/80 px-6 py-5 text-sm text-brand-gray-700 shadow-lg backdrop-blur">
            Invalid lesson route.
          </div>
        </div>
      </div>
    );
  }

  if (shouldRenderImmersiveStatus) {
    return (
      <div className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]">
        <main className="relative z-10 flex min-h-dvh flex-1 flex-col">
          <div className="flex flex-1 flex-col">
            {shouldRenderStatusPanel ? (
              <ArenaStatusPanel
                phaseTransitionError={phaseTransitionError}
                phaseTransitionLoading={phaseTransitionLoading}
                phaseTransitionMessage={phaseTransitionMessage}
                hasPendingNavigation={
                  !!lessonSession && (!isSessionInteractive || isNavigatingToResult)
                }
                backendJobMessage={backendJobMessage}
                backendJobProgress={backendJobProgress}
                activePhase={activePhase}
                onRetry={() => void retryPhaseTransition()}
                onExit={handleExitLesson}
                onCancelGeneration={() => void cancelGeneration()}
              />
            ) : shouldRenderArenaSkeleton ? (
              <ForgeStatus
                title="Preparing your lesson..."
                subtitle="Loading the stage flow and reconnecting to the lesson session."
                statusMessage={
                  backendJobMessage ||
                  (sessionLoading
                    ? "Starting lesson session..."
                    : "Preparing lesson experience...")
                }
                progress={backendLoading ? backendJobProgress : undefined}
                actions={
                  backendLoading ? (
                    <GameButton
                      variant="secondary"
                      onClick={() => void cancelGeneration()}
                    >
                      Cancel
                    </GameButton>
                  ) : undefined
                }
              />
            ) : sessionError ? (
              <ForgeStatus
                error={sessionError}
                title="Lesson session interrupted"
                subtitle="We couldn't prepare this lesson session. You can retry or exit back to the map."
                actions={
                  <>
                    <GameButton
                      variant="secondary"
                      onClick={() => void retrySessionStart()}
                    >
                      Retry
                    </GameButton>
                    <GameButton variant="primary" onClick={handleExitLesson}>
                      Exit
                    </GameButton>
                  </>
                }
              />
            ) : (
              <ForgeStatus
                error={backendError}
                title="Lesson generation interrupted"
                subtitle="This lesson couldn't be generated right now. Return to the map and try again from the node."
                actions={
                  <GameButton variant="primary" onClick={handleExitLesson}>
                    Exit
                  </GameButton>
                }
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen max-h-screen overflow-hidden bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8] flex flex-col">
      {/* ─── Top Nav ─── */}
      <div className="flex items-center gap-3 px-8 pt-4 pb-1">
        <button
          type="button"
          onClick={handleExitLesson}
          className="relative z-20 h-9 w-9 rounded-full bg-white/60 backdrop-blur flex items-center justify-center hover:bg-white/80 transition"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand-gray-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="flex-1">
          <TopProgressBar progress={progress} className="h-3" />
        </div>
      </div>

      {/* ─── Main content: two columns ─── */}
      <div className="flex-1 flex gap-8 px-8 pb-4 w-full min-h-0">
        {/* ── Left: Question + Match Grid ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {backendStage ? (
              <ArenaStageRenderer
                stage={backendStage}
                lesson={{
                  stageIdx: headerStageIdx,
                  totalStages: headerTotalStages,
                  stageLabel: headerStageLabel,
                  nodeDescription,
                  matchPairs,
                  matchQuestion: backendMatchStage?.question || backendStage.topic,
                  matchingStage,
                }}
                actions={{
                  onSubmitStage: submitStage,
                  onSkipStage: skipStage,
                  onContinue: continueStage,
                  onHintUse: useHint,
                }}
              />
            ) : null}
        </div>

        {/* ── Right: AI Chat Assistant ── */}
        <div className="w-[360px] flex-shrink-0 pt-2">
          <ArenaChatPanel
            courseId={backendCourseId ?? currentCourseId}
            courseTopic={backendCourse?.topic || backendCourse?.courseTitle || ""}
            courseTitle={backendCourse?.courseTitle || ""}
            nodeId={nodeId}
            nodeTitle={backendNode?.title || ""}
            nodeDescription={nodeDescription}
            lessonSession={lessonSession}
            currentStage={backendStage}
            stageIdx={displayStageIdx}
            totalStages={displayTotalStages}
          />
        </div>
      </div>

      {/* ─── Feedback overlay ─── */}
      <AnimatePresence>
        {matchingStage.feedback && (
          <ArenaFeedbackOverlay
            type={matchingStage.feedback}
            onContinue={continueStage}
            showConfetti={matchingStage.showConfetti}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
