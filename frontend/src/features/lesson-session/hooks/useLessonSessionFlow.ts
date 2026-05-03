"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, apiFetch, resolveErrorMessage } from "@/lib/apiClient";
import {
  ACTIVE_LESSON_SESSION_STATUSES,
  JOB_TYPE,
  LESSON_SESSION_PHASE,
  LESSON_SESSION_STATUS,
} from "@/lib/domain/statuses";
import { ensureRetryableJob, fetchScopedActiveJob } from "@/lib/jobs/recovery";
import { clearPendingLessonNavigation } from "@/lib/navigation/intents";
import { watchJobStream } from "@/lib/jobs/stream";
import type {
  CoursePath,
  LessonNode,
  LessonSessionPayload,
  LessonStage,
} from "@/lib/apiTypes";
import type { LessonSessionSummary } from "@/lib/apiTypes";
import { cacheLessonSessionSummary } from "./useLessonResultSummary";

interface UseLessonSessionFlowParams {
  backendCourseId: number | null;
  routeCourseId?: string;
  nodeId: string;
  currentCourseId: number | null;
  hintsUsed: number;
  backendCourse: CoursePath | null;
  backendNode: LessonNode | null;
  backendStages: LessonStage[];
  onSessionStarted: (session: LessonSessionPayload) => void;
  onRemedialStagesReady: () => void;
}

export function useLessonSessionFlow({
  backendCourseId,
  routeCourseId,
  nodeId,
  currentCourseId,
  hintsUsed,
  backendCourse,
  backendNode,
  backendStages,
  onSessionStarted,
  onRemedialStagesReady,
}: UseLessonSessionFlowParams) {
  const router = useRouter();
  const pathname = usePathname();

  const [lessonSession, setLessonSession] = useState<LessonSessionPayload | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [sessionRetryNonce, setSessionRetryNonce] = useState(0);
  const [phaseTransitionLoading, setPhaseTransitionLoading] = useState(false);
  const [phaseTransitionMessage, setPhaseTransitionMessage] = useState("");
  const [phaseTransitionError, setPhaseTransitionError] = useState("");

  const isExitingRef = useRef(false);
  const isFinalizingRef = useRef(false);
  const isNavigatingToResultRef = useRef(false);

  const activePhase = lessonSession?.activePhase ?? LESSON_SESSION_PHASE.PRIMARY;
  const isSessionInteractive =
    !!lessonSession &&
    ACTIVE_LESSON_SESSION_STATUSES.includes(lessonSession.status as never);

  const debugLessonFlow = useCallback((message: string, payload?: unknown) => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }
    if (payload === undefined) {
      console.info(`[LessonSessionFlow] ${message}`);
      return;
    }
    console.info(`[LessonSessionFlow] ${message}`, payload);
  }, []);

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
          debugLessonFlow("Remedial job completed", { jobId, sessionId });
          const session = await apiFetch<LessonSessionPayload>(
            `/lessons/sessions/${sessionId}`
          );
          if (isExitingRef.current) {
            return;
          }
          setLessonSession(session);
          onRemedialStagesReady();
          isFinalizingRef.current = false;
          setPhaseTransitionLoading(false);
        },
        onFailed: (data) => {
          isFinalizingRef.current = false;
          setPhaseTransitionLoading(false);
          setPhaseTransitionError(
            data.message || "Remedial generation stopped before it finished."
          );
        },
        onCancelled: (data) => {
          isFinalizingRef.current = false;
          setPhaseTransitionLoading(false);
          setPhaseTransitionError(
            data.message || "Remedial generation was cancelled."
          );
        },
        onStale: (data) => {
          isFinalizingRef.current = false;
          setPhaseTransitionLoading(false);
          setPhaseTransitionError(
            data.message || "Remedial generation stalled. Retry to continue."
          );
        },
        onError: () => {
          isFinalizingRef.current = false;
          setPhaseTransitionLoading(false);
          setPhaseTransitionError(
            "Lost connection while generating remedial lesson. Retry after the backend is back."
          );
        },
      });
    },
    [onRemedialStagesReady]
  );

  const navigateToResult = useCallback(
    (sessionId: number, prefetchedSummary?: LessonSessionSummary | null) => {
      const resolvedCourseId = backendCourseId ?? routeCourseId;
      if (!resolvedCourseId) {
        return;
      }

      if (prefetchedSummary) {
        cacheLessonSessionSummary(prefetchedSummary);
      }

      const targetHref = `/courses/${resolvedCourseId}/nodes/${nodeId}/result?sessionId=${sessionId}`;
      isNavigatingToResultRef.current = true;
      void router.prefetch(targetHref);
      router.replace(targetHref);

      window.setTimeout(() => {
        if (window.location.pathname === pathname) {
          window.location.replace(targetHref);
        }
      }, 180);
    },
    [backendCourseId, nodeId, pathname, routeCourseId, router]
  );

  useEffect(() => {
    if (
      backendStages.length === 0 ||
      !backendCourseId ||
      lessonSession ||
      sessionLoading
    ) {
      return;
    }

    const startBackendSession = async () => {
      setSessionLoading(true);
      setSessionError("");
      try {
        const session = await apiFetch<LessonSessionPayload>("/lessons/sessions/start", {
          method: "POST",
          body: JSON.stringify({
            courseId: backendCourseId,
            nodeId,
            topic:
              backendCourse?.topic ||
              backendCourse?.courseTitle ||
              backendNode?.title ||
              "Lesson",
          }),
        });
        if (isExitingRef.current) {
          return;
        }
        setLessonSession(session);
        onSessionStarted(session);

        if (session.status === LESSON_SESSION_STATUS.REMEDIAL_GENERATING) {
          const activeJob = await ensureRetryableJob(
            await fetchScopedActiveJob({
              jobType: JOB_TYPE.REMEDIAL_GENERATION,
              sessionId: session.sessionId,
            })
          );
          if (activeJob.job_id) {
            connectRemedialJob(String(activeJob.job_id), session.sessionId);
          }
        }
      } catch (err) {
        if (!isExitingRef.current) {
          setSessionError(
            err instanceof ApiError
              ? err.detail
              : "Unable to start the lesson session right now."
          );
        }
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
    currentCourseId,
    lessonSession,
    nodeId,
    onSessionStarted,
    sessionLoading,
    sessionRetryNonce,
  ]);

  const completeCurrentPhase = useCallback(async () => {
    if (!lessonSession || isFinalizingRef.current) {
      return;
    }
    isFinalizingRef.current = true;

    const isPrimaryPhase =
      lessonSession.activePhase === LESSON_SESSION_PHASE.PRIMARY &&
      lessonSession.status !== LESSON_SESSION_STATUS.PLAYING_REMEDIAL;

    debugLessonFlow("completeCurrentPhase invoked", {
      sessionId: lessonSession.sessionId,
      activePhase: lessonSession.activePhase,
      status: lessonSession.status,
      hintsUsed,
      isPrimaryPhase,
    });

    if (isPrimaryPhase) {
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
        debugLessonFlow("Calling complete-primary", {
          sessionId: lessonSession.sessionId,
        });
        const session = await apiFetch<LessonSessionPayload>(
          `/lessons/sessions/${lessonSession.sessionId}/complete-primary`,
          {
            method: "POST",
            body: JSON.stringify({ hintsUsed }),
          }
        );
        window.clearTimeout(delayedTransitionId);
        if (isExitingRef.current) {
          return;
        }
        setLessonSession(session);
        debugLessonFlow("complete-primary returned", {
          sessionId: session.sessionId,
          activePhase: session.activePhase,
          status: session.status,
          remedialJobId: session.remedialJobId,
        });

        if (session.status === LESSON_SESSION_STATUS.COMPLETED) {
          let summary: LessonSessionSummary | null = null;
          try {
            summary = await apiFetch<LessonSessionSummary>(
              `/lessons/sessions/${session.sessionId}/summary`
            );
          } catch {
            summary = null;
          }
          if (phaseTransitionVisible) {
            setPhaseTransitionLoading(false);
          }
          navigateToResult(session.sessionId, summary);
          return;
        }

        if (
          session.status === LESSON_SESSION_STATUS.REMEDIAL_GENERATING &&
          session.remedialJobId
        ) {
          isFinalizingRef.current = false;
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
      debugLessonFlow("Calling complete-remedial", {
        sessionId: lessonSession.sessionId,
      });
      const session = await apiFetch<LessonSessionPayload>(
        `/lessons/sessions/${lessonSession.sessionId}/complete-remedial`,
        {
          method: "POST",
          body: JSON.stringify({ hintsUsed }),
        }
      );
      if (isExitingRef.current) {
        return;
      }
      setLessonSession(session);
      debugLessonFlow("complete-remedial returned", {
        sessionId: session.sessionId,
        activePhase: session.activePhase,
        status: session.status,
      });
      let summary: LessonSessionSummary | null = null;
      try {
        summary = await apiFetch<LessonSessionSummary>(
          `/lessons/sessions/${session.sessionId}/summary`
        );
      } catch {
        summary = null;
      }
      navigateToResult(session.sessionId, summary);
    } catch (err) {
      debugLessonFlow("completeCurrentPhase failed", {
        sessionId: lessonSession.sessionId,
        error: resolveErrorMessage(err, "Unknown lesson session error."),
      });
      setPhaseTransitionError(
        err instanceof ApiError
          ? err.detail
          : "Unable to finalise remedial lesson right now."
      );
      isFinalizingRef.current = false;
    } finally {
      setPhaseTransitionLoading(false);
    }
  }, [connectRemedialJob, debugLessonFlow, hintsUsed, lessonSession, navigateToResult]);

  const retryPhaseTransition = useCallback(async () => {
    if (!lessonSession) {
      return;
    }

    setPhaseTransitionError("");

    if (lessonSession.status === LESSON_SESSION_STATUS.REMEDIAL_GENERATING) {
      const activeJob = await fetchScopedActiveJob({
        jobType: JOB_TYPE.REMEDIAL_GENERATION,
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

      if (refreshedSession.status === LESSON_SESSION_STATUS.PLAYING_REMEDIAL) {
        onRemedialStagesReady();
        return;
      }
    }

    setPhaseTransitionError(
      "Remedial generation is not currently resumable. Exit and re-enter later."
    );
  }, [connectRemedialJob, lessonSession, onRemedialStagesReady]);

  const retrySessionStart = useCallback(async () => {
    setSessionError("");
    setSessionRetryNonce((value) => value + 1);
  }, []);

  const handleSubmissionConflict = useCallback(async () => {
    if (!lessonSession) {
      return;
    }

    try {
      const refreshedSession = await apiFetch<LessonSessionPayload>(
        `/lessons/sessions/${lessonSession.sessionId}`
      );
      if (isExitingRef.current) {
        return;
      }

      setLessonSession(refreshedSession);

      if (refreshedSession.status === LESSON_SESSION_STATUS.COMPLETED) {
        let summary: LessonSessionSummary | null = null;
        try {
          summary = await apiFetch<LessonSessionSummary>(
            `/lessons/sessions/${refreshedSession.sessionId}/summary`
          );
        } catch {
          summary = null;
        }
        navigateToResult(refreshedSession.sessionId, summary);
        return;
      }

      if (
        refreshedSession.status === LESSON_SESSION_STATUS.REMEDIAL_GENERATING &&
        refreshedSession.remedialJobId
      ) {
        connectRemedialJob(refreshedSession.remedialJobId, refreshedSession.sessionId);
      }
    } catch {
      // Silent fallback: caller should avoid crashing even if recovery fetch fails.
    }
  }, [connectRemedialJob, lessonSession, navigateToResult]);

  const handleExitLesson = useCallback(() => {
    const targetHref = backendCourseId ? `/courses/${backendCourseId}` : "/home";
    isExitingRef.current = true;

    setPhaseTransitionLoading(false);
    setSessionLoading(false);

    if (typeof window !== "undefined") {
      sessionStorage.setItem("just_completed_node", "true");
    }

    clearPendingLessonNavigation();
    window.location.replace(targetHref);
  }, [backendCourseId]);

  return {
    lessonSession,
    sessionLoading,
    sessionError,
    phaseTransitionLoading,
    phaseTransitionMessage,
    phaseTransitionError,
    activePhase,
    isSessionInteractive,
    isNavigatingToResult: isNavigatingToResultRef.current,
    completeCurrentPhase,
    retrySessionStart,
    retryPhaseTransition,
    handleExitLesson,
    handleSubmissionConflict,
    setLessonSession,
    setPhaseTransitionError,
  };
}
