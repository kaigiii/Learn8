"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { openJobStream } from "@/lib/jobs/stream";
import type { CoursePath, LessonNode, LessonStage } from "@/lib/apiTypes";

interface UseLessonGenerationFlowParams {
  routeCourseId?: string;
  nodeId: string;
  token: string | null;
  currentProjectId: number | null;
  onStagesReady?: (stages: LessonStage[]) => void;
}

export function useLessonGenerationFlow({
  routeCourseId,
  nodeId,
  token,
  currentProjectId,
  onStagesReady,
}: UseLessonGenerationFlowParams) {
  const router = useRouter();
  const [backendCourseId, setBackendCourseId] = useState<number | null>(null);
  const [backendCourse, setBackendCourse] = useState<CoursePath | null>(null);
  const [backendStages, setBackendStages] = useState<LessonStage[]>([]);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState("");
  const [backendJobProgress, setBackendJobProgress] = useState(0);
  const [backendJobMessage, setBackendJobMessage] = useState(
    "Preparing lesson generation..."
  );
  const [backendJobId, setBackendJobId] = useState<string | null>(null);

  const isBackendLesson = backendCourseId !== null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchCourseId = new URLSearchParams(window.location.search).get("courseId");
    const resolvedCourseId =
      routeCourseId && /^\d+$/.test(routeCourseId)
        ? routeCourseId
        : searchCourseId;
    setBackendCourseId(
      resolvedCourseId && /^\d+$/.test(resolvedCourseId)
        ? Number(resolvedCourseId)
        : null
    );
  }, [routeCourseId]);

  useEffect(() => {
    if (!isBackendLesson) return;
    if (!token) {
      router.replace("/auth/login");
      return;
    }

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
  }, [backendCourseId, isBackendLesson, router, token]);

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
      setBackendJobId(jobId);
      eventSource = openJobStream(jobId, {
        onEvent: (data, source) => {
          setBackendJobProgress(data.progress ?? 0);
          setBackendJobMessage(data.message || "Forging lesson stages...");
          if (data.status === "COMPLETED") {
            setBackendJobId(null);
            source.close();
            const result = (data.result_data || {}) as { stages?: LessonStage[] };
            applyStages(result.stages || []);
          }
          if (data.status === "FAILED" || data.status === "CANCELLED") {
            setBackendJobId(null);
            source.close();
            clearPendingLesson();
            setBackendLoading(false);
            setBackendError(data.message || "Lesson generation failed.");
          }
        },
        onError: (source) => {
          setBackendJobId(null);
          source.close();
          clearPendingLesson();
          setBackendLoading(false);
          setBackendError("Lost connection while generating the lesson.");
        },
      });
    };

    const generateLesson = async () => {
      setBackendLoading(true);
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
                const activeJob = await apiFetch<{
                  job_id: string | null;
                  job_type?: string;
                }>("/jobs/active");
                if (activeJob.job_id && activeJob.job_type === "LESSON_GEN") {
                  connectLessonJob(activeJob.job_id);
                  return;
                }
              }
            } catch {
              window.sessionStorage.removeItem(storageKey);
            }
          }
        }

        const projectQuery = currentProjectId ? `&project_id=${currentProjectId}` : "";
        const response = await apiFetch<{
          status: "PENDING" | "COMPLETED";
          job_id?: string;
          result_data?: { stages?: LessonStage[] };
        }>(
          `/lessons/generate-lesson-from-node?topic=${encodeURIComponent(
            backendCourse.topic || backendCourse.courseTitle
          )}${projectQuery}`,
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
    currentProjectId,
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
