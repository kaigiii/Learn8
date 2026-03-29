"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { JOB_STATUS } from "@/lib/domain/statuses";
import { clearAllNavigationIntents } from "@/lib/navigation/intents";
import {
  buildActiveJobResumeState,
  type ActiveJobResumeState,
} from "@/lib/jobs/recovery";
import { watchJobStream } from "@/lib/jobs/stream";
import type { ActiveJobResponse } from "@/lib/apiTypes";

export function useActiveJobResume(token: string | null) {
  const [activeJob, setActiveJob] = useState<ActiveJobResumeState | null>(null);

  useEffect(() => {
    if (!token) return;

    const buildResumeState = async () => {
      try {
        const active = await apiFetch<ActiveJobResponse>("/jobs/active");
        setActiveJob(buildActiveJobResumeState(active));
      } catch {
        setActiveJob(null);
      }
    };

    void buildResumeState();
  }, [token]);

  useEffect(() => {
    if (!activeJob?.jobId) return;

    const eventSource = watchJobStream(activeJob.jobId, {
      onUpdate: (data) => {
        setActiveJob((prev) => {
          if (!prev || prev.jobId !== activeJob.jobId) return prev;
          return {
            ...prev,
            progress: data.progress ?? prev.progress ?? 0,
            message: data.message || prev.message,
          };
        });
      },
      onCompleted: () => {
        setActiveJob(null);
      },
      onFailed: (data) => {
        setActiveJob((prev) =>
          prev && prev.jobId === activeJob.jobId
            ? {
                ...prev,
                status: JOB_STATUS.STALE,
                message: data.message || prev.message,
                retryable: true,
              }
            : prev
        );
      },
      onStale: (data) => {
        setActiveJob((prev) =>
          prev && prev.jobId === activeJob.jobId
            ? {
                ...prev,
                status: JOB_STATUS.STALE,
                message: data.message || prev.message,
                retryable: true,
              }
            : prev
        );
      },
      onCancelled: () => {
        setActiveJob(null);
      },
      onError: () => {
        // Keep the banner so the user can reopen or retry once the backend is back.
      },
    });

    return () => {
      eventSource.close();
    };
  }, [activeJob?.jobId]);

  const cancelActiveJob = useCallback(async () => {
    if (!activeJob?.jobId) return;

    try {
      const cancelled = await apiFetch<ActiveJobResponse>(`/jobs/${activeJob.jobId}/cancel`, {
        method: "POST",
      });

      if (cancelled.status === JOB_STATUS.CANCELLED) {
        clearAllNavigationIntents();
        setActiveJob(null);
        return;
      }

      // If the backend says the job is already terminal, refresh local banner state from that.
      setActiveJob((prev) =>
        prev
          ? {
              ...prev,
              status: cancelled.status,
              message: cancelled.message || prev.message,
            }
          : prev
      );
    } catch (error) {
      console.error("[useActiveJobResume] Failed to cancel active job", error);
      return;
    } finally {
      // no-op
    }
  }, [activeJob?.jobId]);

  const retryActiveJob = useCallback(async () => {
    if (!activeJob?.jobId) return;

    const retried = await apiFetch<ActiveJobResponse>(`/jobs/${activeJob.jobId}/retry`, {
      method: "POST",
    });

    setActiveJob((prev) =>
      prev
        ? {
            ...prev,
            jobId: retried.job_id || prev.jobId,
            status: retried.status,
            message: retried.message || prev.message,
            retryable: retried.retryable,
          }
        : prev
    );
  }, [activeJob?.jobId]);

  const refreshActiveJob = useCallback(async () => {
    if (!token) return;
    try {
      const active = await apiFetch<ActiveJobResponse>("/jobs/active");
      setActiveJob(buildActiveJobResumeState(active));
    } catch {
      clearAllNavigationIntents();
      setActiveJob(null);
    }
  }, [token]);

  return {
    activeJob,
    setActiveJob,
    cancelActiveJob,
    retryActiveJob,
    refreshActiveJob,
  };
}
