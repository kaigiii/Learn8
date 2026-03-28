"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import { ensureRetryableJob, fetchScopedActiveJob } from "@/lib/jobs/recovery";
import { watchJobStream } from "@/lib/jobs/stream";
import type { CoursePath, LessonNode, LessonStage } from "@/lib/apiTypes";
import { useResolvedLessonRoute } from "./useResolvedLessonRoute";

interface UseLessonGenerationFlowParams {
  routeCourseId?: string;
  nodeId: string;
  currentCourseId: number | null;
  onStagesReady?: (stages: LessonStage[]) => void;
}

export function useLessonGenerationFlow({
  routeCourseId,
  nodeId,
  currentCourseId,
  onStagesReady,
}: UseLessonGenerationFlowParams) {
  const router = useRouter();
  const { isReady } = useRequireAuthRedirect();
  const { backendCourseIdNumber } = useResolvedLessonRoute({
    courseId: routeCourseId,
    nodeId,
  });
  const [backendCourse, setBackendCourse] = useState<CoursePath | null>(null);
  const [backendStages, setBackendStages] = useState<LessonStage[]>([]);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState("");
  const [backendJobProgress, setBackendJobProgress] = useState(0);
  const [backendJobMessage, setBackendJobMessage] = useState(
    "Preparing lesson generation..."
  );
  const [backendJobId, setBackendJobId] = useState<string | null>(null);

  const backendCourseId = backendCourseIdNumber;
  const isBackendLesson = backendCourseId !== null;

  useEffect(() => {
    if (!isBackendLesson) return;
    if (!isReady) return;

    const loadCourse = async () => {
      try {
        const data = await apiFetch<CoursePath>(`/courses/${backendCourseId}`);
        setBackendCourse(data);
      } catch (err) {
        setBackendError(
          err instanceof ApiError ? err.detail : "Failed to load lesson context."
        );
      }
    };

    void loadCourse();
  }, [backendCourseId, isBackendLesson, isReady, router]);

  const backendNode = useMemo(() => {
    if (!backendCourse) return null;
    for (const unit of backendCourse.units) {
      const found = unit.nodes.find((node) => node.id === nodeId);
      if (found) return found as LessonNode;
    }
    return null;
  }, [backendCourse, nodeId]);

  useEffect(() => {
    if (!isBackendLesson || !backendCourse || !backendNode) return;

    let eventSource: EventSource | null = null;
    const storageKey = "learn8_pending_lesson";

    const clearPendingLesson = () => {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(storageKey);
      }
    };

    const applyStages = (stages: LessonStage[]) => {
      setBackendStages(stages);
      setBackendLoading(false);
      setBackendJobProgress(100);
      setBackendJobMessage("Lesson ready.");
      onStagesReady?.(stages);
      clearPendingLesson();
    };

    const connectLessonJob = (jobId: string) => {
      setBackendLoading(true);
      setBackendJobId(jobId);
      eventSource = watchJobStream(jobId, {
        onUpdate: (data) => {
          setBackendJobProgress(data.progress ?? 0);
          setBackendJobMessage(data.message || "Forging lesson stages...");
        },
        onCompleted: (data) => {
          setBackendJobId(null);
          const result = (data.result_data || {}) as { stages?: LessonStage[] };
          applyStages(result.stages || []);
        },
        onFailed: (data) => {
          setBackendJobId(null);
          clearPendingLesson();
          setBackendLoading(false);
          setBackendError(data.message || "Lesson generation failed.");
        },
        onCancelled: (data) => {
          setBackendJobId(null);
          clearPendingLesson();
          setBackendLoading(false);
          setBackendError(data.message || "Lesson generation was cancelled.");
        },
        onStale: (data) => {
          setBackendJobId(null);
          clearPendingLesson();
          setBackendLoading(false);
          setBackendError(data.message || "Lesson generation stalled. Re-enter to retry.");
        },
        onError: () => {
          setBackendJobId(null);
          clearPendingLesson();
          setBackendLoading(false);
          setBackendError("Lost connection while generating the lesson.");
        },
      });
    };

    const generateLesson = async () => {
      setBackendLoading(false);
      setBackendError("");
      setBackendJobProgress(0);
      setBackendJobMessage("Preparing lesson generation...");
      try {
        if (typeof window !== "undefined") {
          const rawPending = window.sessionStorage.getItem(storageKey);
          if (rawPending) {
            try {
              const pending = JSON.parse(rawPending) as {
                nodeId?: string;
                courseId?: number;
              };
              if (
                pending.nodeId === nodeId &&
                pending.courseId === backendCourseId
              ) {
                const activeJob = await ensureRetryableJob(await fetchScopedActiveJob({
                  jobType: "LESSON_GEN",
                  nodeId,
                }));
                if (activeJob.job_id) {
                  connectLessonJob(String(activeJob.job_id));
                  return;
                }
              }
            } catch {
              window.sessionStorage.removeItem(storageKey);
            }
          }
        }

        const response = await apiFetch<{
          status: "PENDING" | "COMPLETED";
          job_id?: string;
          result_data?: { stages?: LessonStage[] };
        }>(
          `/lessons/generate-lesson-from-node?topic=${encodeURIComponent(
            backendCourse.topic || backendCourse.courseTitle
          )}&course_id=${backendCourseId ?? currentCourseId ?? ""}`,
          {
            method: "POST",
            body: JSON.stringify(backendNode),
          }
        );

        if (response.status === "COMPLETED") {
          setBackendJobId(null);
          applyStages(response.result_data?.stages || []);
          return;
        }

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            storageKey,
            JSON.stringify({
              nodeId,
              courseId: backendCourseId,
            })
          );
        }
        connectLessonJob(String(response.job_id));
      } catch (err) {
        setBackendJobId(null);
        clearPendingLesson();
        setBackendLoading(false);
        setBackendError(
          err instanceof ApiError ? err.detail : "Failed to generate lesson."
        );
      }
    };

    void generateLesson();
    return () => {
      eventSource?.close();
    };
  }, [
    backendCourse,
    backendCourseId,
    backendNode,
    currentCourseId,
    isBackendLesson,
    nodeId,
    onStagesReady,
  ]);

  const cancelGeneration = useCallback(async () => {
    if (!backendJobId) {
      router.push(`/courses/${backendCourseId}`);
      return;
    }

    try {
      await apiFetch(`/jobs/${backendJobId}/cancel`, {
        method: "POST",
      });
    } catch {
      // Ignore cancel failure and still unwind local UI state.
    } finally {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("learn8_pending_lesson");
      }
      setBackendJobId(null);
      setBackendLoading(false);
      setBackendError("");
      router.push(`/courses/${backendCourseId}`);
    }
  }, [backendCourseId, backendJobId, router]);

  return {
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
  };
}
