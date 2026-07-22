"use client";

import React, { useState, useCallback } from "react";
import ForgeStatus from "@/components/feedback/ForgeStatus";
import GameButton from "@/components/ui/GameButton";
import TopProgressBar from "@/components/ui/TopProgressBar";
import { useCourseStore } from "@/stores/app/useCourseStore";
import useUserStore from "@/stores/app/useUserStore";
import useLessonSessionStore from "@/stores/session/useLessonSessionStore";
import { LessonSessionChatPanel } from "./components/LessonSessionChatPanel";
import { LessonStageRenderer } from "./components/LessonStageRenderer";
import { LessonSessionStatusPanel } from "./components/LessonSessionStatusPanel";
import { useLessonStageFlow } from "./hooks/useLessonStageFlow";
import { useLessonGenerationFlow } from "./hooks/useLessonGenerationFlow";
import { useLessonSessionFlow } from "./hooks/useLessonSessionFlow";
import { useResolvedLessonRoute } from "./hooks/useResolvedLessonRoute";
import { useDelayedVisibility } from "@/lib/ui/useDelayedVisibility";
import { LESSON_SESSION_PHASE, LESSON_SESSION_STATUS } from "@/lib/domain/statuses";
import { useI18n } from "@/lib/i18n/useI18n";
import type { TranslationKey } from "@/lib/i18n/translations";

const COMPACT_VIEWPORT_MEDIA_QUERY = "(max-width: 1023px)";

function courseSlugFromTitle(title: string): string {
  return title.toLowerCase().replace(/ /g, "-").replace(/&/g, "and");
}

function translatePublicNode(
  t: (key: TranslationKey) => string,
  courseSlug: string,
  nodeId: string,
  fallback: string
): string {
  const key = `course.${courseSlug}.node.${nodeId}` as TranslationKey;
  const result = t(key);
  return result === key ? fallback : result;
}

/* ═══════════════════ Page ═══════════════════ */

export default function LessonSessionPageClient({
  courseId: explicitCourseId,
  nodeId: explicitNodeId,
}: {
  courseId?: string;
  nodeId?: string;
} = {}) {
  const { t } = useI18n();
  const { nodeId, routeCourseId } = useResolvedLessonRoute({
    courseId: explicitCourseId,
    nodeId: explicitNodeId,
  });
  const resolvedRouteCourseId = routeCourseId ?? undefined;
  const currentCourseId = useCourseStore((s) => s.currentCourseId);

  // Lesson session store
  const startSession = useLessonSessionStore((s) => s.startSession);
  const markCorrect = useLessonSessionStore((s) => s.markCorrect);
  const markIncorrect = useLessonSessionStore((s) => s.markIncorrect);
  const useSessionHint = useLessonSessionStore((s) => s.useHint);
  const triggerConfetti = useLessonSessionStore((s) => s.triggerConfetti);
  const triggerShake = useLessonSessionStore((s) => s.triggerShake);
  const hintsUsed = useLessonSessionStore((s) => s.hintsUsed);

  // User store
  const setLastActiveNode = useUserStore((s) => s.setLastActiveNode);
  const [isCompactViewport, setIsCompactViewport] = useState(true);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const previousCompactViewportRef = React.useRef<boolean | null>(null);

  const [stageIdx, setStageIdx] = useState(0);

  React.useEffect(() => {
    const media = window.matchMedia(COMPACT_VIEWPORT_MEDIA_QUERY);
    const applyViewport = (compact: boolean) => {
      setIsCompactViewport(compact);
      if (previousCompactViewportRef.current === null || previousCompactViewportRef.current !== compact) {
        setIsChatPanelOpen(!compact);
      }
      previousCompactViewportRef.current = compact;
    };

    applyViewport(media.matches);
    const handleChange = (event: MediaQueryListEvent) => {
      applyViewport(event.matches);
    };

    media.addEventListener("change", handleChange);
    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

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
    stagesLoadedInstantly,
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
    handleSubmissionConflict,
  } = useLessonSessionFlow({
    backendCourseId,
    routeCourseId: resolvedRouteCourseId,
    nodeId,
    currentCourseId,
    hintsUsed,
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
  const topicOverride = React.useMemo(() => {
    if (!backendCourse?.isPublic || !nodeId || !backendCourse.courseTitle) return undefined;
    const courseSlug = courseSlugFromTitle(backendCourse.courseTitle);
    const fallback = backendNode?.title || "";
    const translated = translatePublicNode(t, courseSlug, nodeId, fallback);
    return translated !== fallback ? translated : undefined;
  }, [backendCourse?.isPublic, backendCourse?.courseTitle, nodeId, backendNode?.title, t]);

  const activeStages = lessonSession?.activeStages ?? backendStages;
  const backendStage = activeStages[stageIdx] ?? null;
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

  const { submitStage, continueStage, skipStage, useHint } = useLessonStageFlow({
    lessonSession,
    isSessionInteractive,
    backendCourse,
    stageIdx,
    totalStages: activeStageCount,
    onCorrect: () => {
      markCorrect();
      triggerConfetti();
    },
    onIncorrect: () => {
      markIncorrect();
      triggerShake();
    },
    onHintUsed: useSessionHint,
    onAdvanceStage: () => setStageIdx((i) => i + 1),
    onCompletePhase: completeCurrentPhase,
    onSubmissionConflict: handleSubmissionConflict,
  });

  const hasPendingStatusFlow =
    backendLoading ||
    (sessionLoading && !stagesLoadedInstantly) ||
    phaseTransitionLoading ||
    (!!lessonSession && (!isSessionInteractive || isNavigatingToResult));
  const awaitingSessionStart =
    !stagesLoadedInstantly && backendStages.length > 0 && !lessonSession && !sessionError;
  const showDelayedStatusPanel = useDelayedVisibility(hasPendingStatusFlow, 260);
  // phaseTransitionLoading is user-initiated (skip / final continue) and the
  // request always takes hundreds of ms — show the panel immediately instead
  // of waiting for the anti-flash delay, which otherwise looks like the
  // button click did nothing on the last question.
  const shouldRenderStatusPanel =
    !!phaseTransitionError ||
    phaseTransitionLoading ||
    (!backendStage ? hasPendingStatusFlow : showDelayedStatusPanel);
  const shouldRenderLessonSessionSkeleton =
    (!backendStage && hasPendingStatusFlow && !shouldRenderStatusPanel && !backendError) ||
    awaitingSessionStart ||
    (!lessonSession && !backendError && !sessionError);
  const shouldRenderImmersiveStatus =
    !lessonSession ||
    shouldRenderStatusPanel ||
    shouldRenderLessonSessionSkeleton ||
    !!sessionError ||
    !!backendError;

  if (!isBackendLesson) {
    return (
      <div className="relative min-h-screen app-shared-bg">
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
      <div className="relative min-h-dvh overflow-hidden app-shared-bg">
        <main className="relative z-10 flex min-h-dvh flex-1 flex-col">
          <div className="flex flex-1 flex-col">
            {shouldRenderStatusPanel ? (
              <LessonSessionStatusPanel
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
            ) : shouldRenderLessonSessionSkeleton ? (
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
    <div className="relative min-h-screen max-h-screen overflow-hidden app-shared-bg flex flex-col">
      {/* ─── Top Nav ─── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-1 sm:px-6 lg:px-8">
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
        {isCompactViewport ? (
          <button
            type="button"
            onClick={() => setIsChatPanelOpen((prev) => !prev)}
            className="h-9 rounded-full border border-white/80 bg-white/75 px-3 text-xs font-heading font-bold text-brand-gray-700 shadow-sm backdrop-blur transition hover:bg-white"
          >
            {isChatPanelOpen ? "Hide tutor" : "Show tutor"}
          </button>
        ) : null}
      </div>

      {/* ─── Main content: two columns ─── */}
      <div className="relative flex w-full min-h-0 flex-1 gap-4 px-4 pb-4 sm:px-6 lg:gap-8 lg:px-8">
        {/* ── Left: Question + Match Grid ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {backendStage ? (
              <LessonStageRenderer
                stage={backendStage}
                lesson={{
                  stageIdx: headerStageIdx,
                  totalStages: headerTotalStages,
                  stageLabel: headerStageLabel,
                  nodeDescription,
                  courseId: backendCourseId ?? currentCourseId,
                  topicOverride,
                }}
                actions={{
                  submitStage,
                  skipStage,
                  continueStage,
                  useHint,
                }}
              />
            ) : null}
        </div>

        {/* ── Right: AI Chat Assistant ── */}
        {isCompactViewport ? (
          isChatPanelOpen ? (
            <div className="absolute inset-x-4 bottom-4 top-[72px] z-30 sm:inset-x-6">
              <LessonSessionChatPanel
                courseId={backendCourseId ?? currentCourseId}
                courseTopic={backendCourse?.topic || backendCourse?.courseTitle || ""}
                courseTitle={backendCourse?.courseTitle || ""}
                nodeId={nodeId}
                nodeTitle={topicOverride || backendNode?.title || ""}
                nodeDescription={nodeDescription}
                lessonSession={lessonSession}
                currentStage={backendStage}
                stageIdx={displayStageIdx}
                totalStages={displayTotalStages}
                compact
              />
            </div>
          ) : null
        ) : (
          <div className="w-[360px] flex-shrink-0 pt-2">
            <LessonSessionChatPanel
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
        )}
      </div>
    </div>
  );
}
