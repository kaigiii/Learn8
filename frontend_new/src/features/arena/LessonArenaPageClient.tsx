"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams, usePathname } from "next/navigation";
import TopProgressBar from "@/components/ui/TopProgressBar";
import GameButton from "@/components/ui/GameButton";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { ensureRetryableJob, fetchScopedActiveJob } from "@/lib/jobs/recovery";
import { watchJobStream } from "@/lib/jobs/stream";
import type {
  ActiveJobResponse,
  LessonSessionPayload,
  LessonStage,
  SubmissionResponse,
} from "@/lib/apiTypes";
import { useAuthStore } from "@/stores/app/useAuthStore";
import { useProjectStore } from "@/stores/app/useProjectStore";
import useUserStore from "@/stores/app/useUserStore";
import useArenaStore from "@/stores/session/useArenaStore";
import { ArenaChatPanel } from "./components/ArenaChatPanel";
import { ArenaFeedbackOverlay } from "./components/ArenaFeedbackOverlay";
import { ArenaStageRenderer } from "./components/ArenaStageRenderer";
import { useLessonGenerationFlow } from "./hooks/useLessonGenerationFlow";
import { useMatchingPairsStage } from "./hooks/useMatchingPairsStage";

/* ═══════════════════ Page ═══════════════════ */

export default function LessonArenaPageClient({
  courseId: explicitCourseId,
  nodeId: explicitNodeId,
}: {
  courseId?: string;
  nodeId?: string;
} = {}) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const nodeId = explicitNodeId ?? (params.nodeId as string);
  const routeCourseId = explicitCourseId ?? (params.courseId as string | undefined);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  // Arena store
  const arenaStore = useArenaStore();
  const { startSession, markCorrect: arenaMarkCorrect, markIncorrect: arenaMarkIncorrect, useHint: arenaUseHint, triggerConfetti: arenaTriggerConfetti, triggerShake: arenaTriggerShake } = arenaStore;

  // User store
  const spendGems = useUserStore((s) => s.spendGems);
  const setLastActiveNode = useUserStore((s) => s.setLastActiveNode);

  const [stageIdx, setStageIdx] = useState(0);
  const [lessonSession, setLessonSession] = useState<LessonSessionPayload | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [phaseTransitionLoading, setPhaseTransitionLoading] = useState(false);
  const [phaseTransitionMessage, setPhaseTransitionMessage] = useState("");
  const [phaseTransitionError, setPhaseTransitionError] = useState("");
  const isExitingRef = useRef(false);
  const isFinalizingRef = useRef(false);
  const isNavigatingToResultRef = useRef(false);
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
    routeCourseId,
    nodeId,
    currentProjectId,
    onStagesReady: resetInteractiveStageState,
  });

  const activeStages = lessonSession?.activeStages ?? backendStages;
  const activePhase = lessonSession?.activePhase ?? "primary";
  const isSessionInteractive =
    !lessonSession ||
    lessonSession.status === "playing_primary" ||
    lessonSession.status === "playing_remedial";
  const backendStage = activeStages[stageIdx] ?? null;
  const backendMatchStage = useMemo(() => {
    if (backendStage?.component !== "MatchingPairs") return null;
    const data = backendStage.config.data as { question?: string; pairs?: { left: string; right: string }[] };
    return {
      question: data.question || backendStage.topic,
      pairs: (data.pairs || []).map((pair) => ({ left: pair.left, right: pair.right })),
    };
  }, [backendStage]);
  const totalStages = Math.max(activeStages.length, 1);
  const progress = (stageIdx / totalStages) * 100;
  const nodeDescription = backendNode?.description ?? "";
  const matchPairs = backendMatchStage?.pairs ?? [];

  const connectRemedialJob = useCallback(
    (jobId: string, sessionId: number) => {
      if (isExitingRef.current) {
        return null;
      }
      setPhaseTransitionError("");
      setPhaseTransitionLoading(true);
      setPhaseTransitionMessage("Generating your targeted remedial lesson...");
      return watchJobStream(jobId, {
        onUpdate: (data) => {
          if (isExitingRef.current) {
            return;
          }
          setPhaseTransitionMessage(data.message || "Generating remedial lesson...");
        },
        onCompleted: async () => {
          const session = await apiFetch<LessonSessionPayload>(
            `/lessons/sessions/${sessionId}`
          );
          if (isExitingRef.current) {
            return;
          }
          setLessonSession(session);
          resetInteractiveStageState();
          setPhaseTransitionLoading(false);
        },
        onFailed: (data) => {
          setPhaseTransitionLoading(false);
          setPhaseTransitionError(
            data.message || "Remedial generation stopped before it finished."
          );
        },
        onCancelled: (data) => {
          setPhaseTransitionLoading(false);
          setPhaseTransitionError(
            data.message || "Remedial generation was cancelled."
          );
        },
        onStale: (data) => {
          setPhaseTransitionLoading(false);
          setPhaseTransitionError(
            data.message || "Remedial generation stalled. Retry to continue."
          );
        },
        onError: () => {
          setPhaseTransitionLoading(false);
          setPhaseTransitionError(
            "Lost connection while generating remedial lesson. Retry after the backend is back."
          );
        },
      });
    },
    [resetInteractiveStageState]
  );

  const navigateToResult = useCallback(
    (sessionId: number) => {
      const resolvedCourseId = backendCourseId ?? routeCourseId;
      if (!resolvedCourseId) {
        return;
      }

      const targetHref = `/courses/${resolvedCourseId}/nodes/${nodeId}/result?sessionId=${sessionId}`;
      isNavigatingToResultRef.current = true;
      router.replace(targetHref);

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          if (window.location.pathname === pathname) {
            window.location.replace(targetHref);
          }
        }, 180);
      }
    },
    [backendCourseId, nodeId, pathname, routeCourseId, router]
  );

  useEffect(() => {
    if (backendStages.length === 0 || !backendCourseId || lessonSession || sessionLoading) return;

    const startBackendSession = async () => {
      setSessionLoading(true);
      try {
        const session = await apiFetch<LessonSessionPayload>("/lessons/sessions/start", {
          method: "POST",
          body: JSON.stringify({
            courseId: backendCourseId,
            nodeId,
            topic: backendCourse?.topic || backendCourse?.courseTitle || backendNode?.title || "Lesson",
            projectId: currentProjectId,
            primaryStages: backendStages,
          }),
        });
        if (isExitingRef.current) {
          return;
        }
        setLessonSession(session);
        startSession({
          nodeId,
          courseId: String(backendCourseId),
          totalStages: Math.max(session.activeStages.length, 1),
        });
        setLastActiveNode(nodeId);

        if (session.status === "remedial_generating") {
          const activeJob = await ensureRetryableJob(await fetchScopedActiveJob({
            jobType: "REMEDIAL_GEN",
            sessionId: session.sessionId,
          }));
          if (activeJob.job_id) {
            connectRemedialJob(String(activeJob.job_id), session.sessionId);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSessionLoading(false);
      }
    };

    void startBackendSession();
  }, [
    backendCourse?.courseTitle,
    backendCourse?.topic,
    backendCourseId,
    backendNode?.title,
    backendStages,
    connectRemedialJob,
    currentProjectId,
    lessonSession,
    nodeId,
    sessionLoading,
    setLastActiveNode,
    startSession,
  ]);

  const submitBackendStage = useCallback(
    async (stageToSubmit: LessonStage, userInput: unknown) => {
      if (!lessonSession || !isSessionInteractive || isFinalizingRef.current) {
        return;
      }
      const response = await apiFetch<SubmissionResponse>("/lessons/submit-answer", {
        method: "POST",
        body: JSON.stringify({
          sessionId: lessonSession.sessionId,
          stageId: stageToSubmit.stageId,
          userInput,
          context_topic: backendCourse?.topic || backendCourse?.courseTitle || stageToSubmit.topic,
          component: stageToSubmit.component,
        }),
      });

      if (response.result === "correct") {
        arenaMarkCorrect();
        arenaTriggerConfetti();
      } else if (response.result === "incorrect") {
        arenaMarkIncorrect();
        arenaTriggerShake();
      }
      return response;
    },
    [
      arenaMarkCorrect,
      arenaMarkIncorrect,
      arenaTriggerConfetti,
      arenaTriggerShake,
      backendCourse,
      isSessionInteractive,
      lessonSession,
    ]
  );

  const matchingStage = useMatchingPairsStage({
    pairs: matchPairs,
    enabled: backendStage?.component === "MatchingPairs",
    onCorrectStageComplete: async (pairsPayload) => {
      if (backendStage) {
        const response = await submitBackendStage(backendStage, { matches: pairsPayload });
        if (!response) return;
        if (response.result === "correct") {
          matchingStage.markCorrectFeedback();
          return;
        }
        matchingStage.markIncorrectFeedback();
      }
    },
    onHintUse: () => {
      const canAfford = spendGems(10);
      if (canAfford) arenaUseHint();
      return canAfford;
    },
  });

  const completeCurrentPhase = useCallback(async () => {
    if (!lessonSession || isFinalizingRef.current) return;
    isFinalizingRef.current = true;

    if (lessonSession.activePhase === "primary") {
      setPhaseTransitionError("");
      let phaseTransitionVisible = false;
      const delayedTransitionId = window.setTimeout(() => {
        phaseTransitionVisible = true;
        setPhaseTransitionLoading(true);
        setPhaseTransitionMessage(
          "Finalising this lesson and checking whether targeted review is needed..."
        );
      }, 350);
      try {
        const session = await apiFetch<LessonSessionPayload>(
          `/lessons/sessions/${lessonSession.sessionId}/complete-primary`,
          { method: "POST" }
        );
        window.clearTimeout(delayedTransitionId);
        if (isExitingRef.current) {
          return;
        }
        setLessonSession(session);

        if (session.status === "completed") {
          if (phaseTransitionVisible) {
            setPhaseTransitionLoading(false);
          }
          navigateToResult(session.sessionId);
          return;
        }

        if (session.status === "remedial_generating" && session.remedialJobId) {
          if (!phaseTransitionVisible) {
            setPhaseTransitionLoading(true);
            setPhaseTransitionMessage("Generating your targeted remedial lesson...");
          }
          connectRemedialJob(session.remedialJobId, session.sessionId);
          return;
        }
      } catch (err) {
        window.clearTimeout(delayedTransitionId);
        if (phaseTransitionVisible) {
          setPhaseTransitionLoading(false);
        }
        setPhaseTransitionError(
          err instanceof ApiError
            ? err.detail
            : "Unable to complete the lesson phase right now."
        );
        isFinalizingRef.current = false;
        throw err;
      }
      window.clearTimeout(delayedTransitionId);
      if (phaseTransitionVisible) {
        setPhaseTransitionLoading(false);
      }
      isFinalizingRef.current = false;
      return;
    }

    setPhaseTransitionLoading(true);
    setPhaseTransitionError("");
    setPhaseTransitionMessage("Finalising your remedial lesson...");
    try {
      const session = await apiFetch<LessonSessionPayload>(
        `/lessons/sessions/${lessonSession.sessionId}/complete-remedial`,
        { method: "POST" }
      );
      if (isExitingRef.current) {
        return;
      }
      setLessonSession(session);
      navigateToResult(session.sessionId);
    } catch (err) {
      setPhaseTransitionError(
        err instanceof ApiError
          ? err.detail
          : "Unable to finalise remedial lesson right now."
      );
      isFinalizingRef.current = false;
    } finally {
      setPhaseTransitionLoading(false);
    }
  }, [connectRemedialJob, lessonSession, navigateToResult]);

  const retryPhaseTransition = useCallback(async () => {
    if (!lessonSession) return;

    setPhaseTransitionError("");

    if (lessonSession.status === "remedial_generating") {
      const activeJob = await fetchScopedActiveJob({
        jobType: "REMEDIAL_GEN",
        sessionId: lessonSession.sessionId,
      });
      if (activeJob.job_id) {
        const resumableJob = await ensureRetryableJob(activeJob);
        if (resumableJob.job_id) {
          connectRemedialJob(String(resumableJob.job_id), lessonSession.sessionId);
          return;
        }
        return;
      }

      const refreshedSession = await apiFetch<LessonSessionPayload>(
        `/lessons/sessions/${lessonSession.sessionId}`
      );
      setLessonSession(refreshedSession);

      if (refreshedSession.status === "playing_remedial") {
        resetInteractiveStageState();
        return;
      }
    }

    setPhaseTransitionError(
      "Remedial generation is not currently resumable. Exit and re-enter later."
    );
  }, [connectRemedialJob, lessonSession, resetInteractiveStageState]);

  const handleExitLesson = useCallback(() => {
    const targetHref = backendCourseId ? `/courses/${backendCourseId}` : "/home";
    isExitingRef.current = true;

    setPhaseTransitionLoading(false);
    setSessionLoading(false);

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("learn8_pending_lesson");
      window.location.replace(targetHref);
    }
  }, [backendCourseId]);

  /* Continue to next stage or result */
  const handleContinue = useCallback(() => {
    if (stageIdx < totalStages - 1) {
      setStageIdx((i) => i + 1);
      matchingStage.clearFeedback();
    } else {
      void completeCurrentPhase();
    }
  }, [completeCurrentPhase, matchingStage, stageIdx, totalStages]);

  const skipBackendStage = useCallback(
    async (stageToSkip: LessonStage) => {
      const response = await submitBackendStage(stageToSkip, { skipped: true });
      if (!response) {
        return;
      }
      handleContinue();
    },
    [handleContinue, submitBackendStage]
  );

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
          {backendLoading ||
          sessionLoading ||
          phaseTransitionLoading ||
          !!phaseTransitionError ||
          (!!lessonSession &&
            (!isSessionInteractive || isNavigatingToResultRef.current)) ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="w-full max-w-lg rounded-3xl bg-white/70 px-8 py-6 text-center shadow-lg">
                  {phaseTransitionError ? (
                    <>
                      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-500">
                        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M12 8v5" />
                          <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                      </div>
                      <p className="font-heading text-lg font-bold text-brand-gray-700">
                        Remedial generation interrupted
                      </p>
                      <p className="mt-2 text-sm text-brand-gray-500">
                        {phaseTransitionError}
                      </p>
                      <div className="mt-5 flex items-center justify-center gap-3">
                        <GameButton variant="secondary" onClick={() => void retryPhaseTransition()}>
                          Retry
                        </GameButton>
                        <GameButton variant="primary" onClick={handleExitLesson}>
                          Exit
                        </GameButton>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-teal/20 border-t-brand-teal" />
                      <p className="font-heading text-lg font-bold text-brand-gray-700">
                        {phaseTransitionLoading ||
                        (!!lessonSession &&
                          (!isSessionInteractive || isNavigatingToResultRef.current))
                          ? "Finalising current lesson..."
                          : "Forging lesson stages..."}
                      </p>
                      <p className="mt-2 text-sm text-brand-gray-500">
                        {phaseTransitionLoading
                          ? phaseTransitionMessage
                          : lessonSession &&
                              (!isSessionInteractive || isNavigatingToResultRef.current)
                            ? "Wrapping up your results and moving you to the lesson summary..."
                            : backendJobMessage}
                      </p>
                      <div className="mx-auto mt-5 h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-teal to-[#5fb3af] transition-all duration-500"
                          style={{
                            width: `${
                              phaseTransitionLoading ||
                              (!!lessonSession &&
                                (!isSessionInteractive || isNavigatingToResultRef.current))
                                ? 85
                                : Math.max(0, Math.min(backendJobProgress, 100))
                            }%`,
                          }}
                        />
                      </div>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-brand-teal/80">
                        {phaseTransitionLoading ||
                        (!!lessonSession &&
                          (!isSessionInteractive || isNavigatingToResultRef.current))
                          ? activePhase === "primary"
                            ? "Primary complete"
                            : "Remedial complete"
                          : `${Math.round(Math.max(0, Math.min(backendJobProgress, 100)))}% complete`}
                      </p>
                    </>
                  )}
                  {!phaseTransitionLoading &&
                    !phaseTransitionError &&
                    !(lessonSession &&
                      (!isSessionInteractive || isNavigatingToResultRef.current)) && (
                    <div className="mt-5">
                    <GameButton
                      variant="secondary"
                      onClick={() => void cancelGeneration()}
                    >
                      Cancel Generation
                    </GameButton>
                    </div>
                  )}
                </div>
              </div>
            ) : backendError ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="rounded-3xl bg-white/80 px-8 py-6 text-center shadow-lg">
                  <p className="font-heading text-lg font-bold text-rose-500">
                    {backendError}
                  </p>
                </div>
              </div>
            ) : backendStage ? (
              <ArenaStageRenderer
                stage={backendStage}
                stageIdx={stageIdx}
                totalStages={totalStages}
                nodeDescription={nodeDescription}
                matchPairs={matchPairs}
                matchQuestion={backendMatchStage?.question || backendStage.topic}
                matchingStage={matchingStage}
                onSubmitStage={(stage, input) => submitBackendStage(stage, input)}
                onSkipStage={skipBackendStage}
                onContinue={handleContinue}
                onHintUse={() => {
                  const canAfford = spendGems(10);
                  if (canAfford) arenaUseHint();
                  return canAfford;
                }}
              />
            ) : null}
        </div>

        {/* ── Right: AI Chat Assistant ── */}
        <div className="w-[360px] flex-shrink-0 pt-2">
          <ArenaChatPanel />
        </div>
      </div>

      {/* ─── Feedback overlay ─── */}
      <AnimatePresence>
        {matchingStage.feedback && (
          <ArenaFeedbackOverlay
            type={matchingStage.feedback}
            onContinue={handleContinue}
            showConfetti={matchingStage.showConfetti}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
