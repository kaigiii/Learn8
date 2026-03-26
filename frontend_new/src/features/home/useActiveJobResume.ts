"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { openJobStream } from "@/lib/jobs/stream";

export interface ActiveJobResumeState {
  jobId: string;
  jobType: string;
  resumeHref: string;
  title: string;
  description: string;
  progress?: number;
  message?: string;
}

export function useActiveJobResume(token: string | null) {
  const [activeJob, setActiveJob] = useState<ActiveJobResumeState | null>(null);

  useEffect(() => {
    if (!token) return;

    const buildResumeState = async () => {
      try {
        const active = await apiFetch<{
          job_id: string | null;
          job_type?: string;
          status?: string;
        }>("/jobs/active");

        if (!active.job_id || !active.job_type) {
          setActiveJob(null);
          return;
        }

        if (typeof window === "undefined") {
          setActiveJob(null);
          return;
        }

        if (active.job_type === "LESSON_GEN") {
          const raw = window.sessionStorage.getItem("learn8_pending_lesson");
          if (raw) {
            const pending = JSON.parse(raw) as { courseId?: number; nodeId?: string };
            if (pending.courseId && pending.nodeId) {
              setActiveJob({
                jobId: active.job_id,
                jobType: active.job_type,
                resumeHref: `/courses/${pending.courseId}/nodes/${pending.nodeId}`,
                title: "Lesson still forging",
                description: "We found an unfinished lesson generation. Resume and keep waiting from the node page.",
                progress: 0,
                message: "Reconnecting to lesson generation...",
              });
              return;
            }
          }
        }

        if (active.job_type === "QUESTIONNAIRE_GEN" || active.job_type === "SYLLABUS_GEN") {
          const raw = window.sessionStorage.getItem("learn8_pending_questionnaire");
          const pending = raw ? (JSON.parse(raw) as { topic?: string }) : null;
          setActiveJob({
            jobId: active.job_id,
            jobType: active.job_type,
            resumeHref: "/questionnaire",
            title:
              active.job_type === "QUESTIONNAIRE_GEN"
                ? "Questionnaire still generating"
                : "Syllabus still forging",
            description:
              active.job_type === "QUESTIONNAIRE_GEN"
                ? `Resume the tailoring flow${pending?.topic ? ` for ${pending.topic}` : ""}.`
                : `Resume the syllabus forge${pending?.topic ? ` for ${pending.topic}` : ""}.`,
            progress: 0,
            message:
              active.job_type === "QUESTIONNAIRE_GEN"
                ? "Reconnecting to questionnaire generation..."
                : "Reconnecting to syllabus generation...",
          });
          return;
        }

        setActiveJob({
          jobId: active.job_id,
          jobType: active.job_type,
          resumeHref: "/home",
          title: "Unfinished generation found",
          description: "We found an active background generation task. Reopen the flow to continue.",
          progress: 0,
          message: "Reconnecting to background generation...",
        });
      } catch {
        setActiveJob(null);
      }
    };

    void buildResumeState();
  }, [token]);

  useEffect(() => {
    if (!activeJob?.jobId) return;

    const eventSource = openJobStream(activeJob.jobId, {
      onEvent: (data, source) => {
        setActiveJob((prev) => {
          if (!prev || prev.jobId !== activeJob.jobId) return prev;
          return {
            ...prev,
            progress: data.progress ?? prev.progress ?? 0,
            message: data.message || prev.message,
          };
        });

        if (
          data.status === "COMPLETED" ||
          data.status === "FAILED" ||
          data.status === "CANCELLED"
        ) {
          source.close();
        }
      },
      onError: (source) => {
        source.close();
      },
    });

    return () => {
      eventSource.close();
    };
  }, [activeJob?.jobId]);

  const cancelActiveJob = useCallback(async () => {
    if (!activeJob?.jobId) return;

    try {
      await apiFetch(`/jobs/${activeJob.jobId}/cancel`, {
        method: "POST",
      });
    } catch {
      // Ignore cancel failure and still clear stale local state.
    } finally {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("learn8_pending_questionnaire");
        window.sessionStorage.removeItem("learn8_pending_lesson");
      }
      setActiveJob(null);
    }
  }, [activeJob?.jobId]);

  return {
    activeJob,
    setActiveJob,
    cancelActiveJob,
  };
}
