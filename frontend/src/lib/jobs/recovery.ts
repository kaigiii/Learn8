"use client";

import { apiFetch } from "@/lib/apiClient";
import type { ActiveJobResponse } from "@/lib/apiTypes";
import {
  JOB_STATUS,
  JOB_TYPE,
  type JobType,
} from "@/lib/domain/statuses";
import { getJobCopy } from "@/lib/jobs/policy";
import { clampJobProgress } from "@/lib/jobs/presentation";

export interface ActiveJobResumeState {
  jobId: string;
  jobType: JobType;
  status?: ActiveJobResponse["status"];
  resumeHref: string;
  title: string;
  description: string;
  progress?: number;
  message?: string;
  retryable?: boolean;
}

type JobResultData = Record<string, unknown>;

interface PendingLessonContext {
  courseId?: number;
  nodeId?: string;
}

interface PendingQuestionnaireContext {
  courseId?: number;
  topic?: string;
}

interface ActiveJobScope {
  jobType?: JobType;
  courseId?: number;
  nodeId?: string;
  sessionId?: number;
}

export function getJobResultData(activeJob: ActiveJobResponse): JobResultData {
  return activeJob.result_data || {};
}

export async function fetchScopedActiveJob({
  jobType,
  courseId,
  nodeId,
  sessionId,
}: ActiveJobScope): Promise<ActiveJobResponse> {
  const params = new URLSearchParams();
  if (jobType) params.set("job_type", jobType);
  if (typeof courseId === "number") {
    params.set("course_id", String(courseId));
  }
  if (nodeId) params.set("node_id", nodeId);
  if (typeof sessionId === "number") params.set("session_id", String(sessionId));

  const query = params.toString();
  return apiFetch<ActiveJobResponse>(`/jobs/active${query ? `?${query}` : ""}`);
}

export async function ensureRetryableJob(
  activeJob: ActiveJobResponse
): Promise<ActiveJobResponse> {
  if (
    !activeJob.job_id ||
    activeJob.status !== JOB_STATUS.STALE ||
    !activeJob.retryable
  ) {
    return activeJob;
  }

  return apiFetch<ActiveJobResponse>(`/jobs/${activeJob.job_id}/retry`, {
    method: "POST",
  });
}

export function matchesQuestionnaireCourseJob(
  activeJob: ActiveJobResponse,
  courseId: number,
  allowedTypes: JobType[] = [
    JOB_TYPE.QUESTIONNAIRE_GENERATION,
    JOB_TYPE.SYLLABUS_GENERATION,
  ]
) {
  if (!activeJob.job_id || !activeJob.job_type) return false;
  if (!allowedTypes.includes(activeJob.job_type)) return false;
  const resultData = getJobResultData(activeJob);
  return resultData.course_id === courseId;
}

export function matchesLessonGenerationJob(
  activeJob: ActiveJobResponse,
  nodeId: string
) {
  if (!activeJob.job_id || activeJob.job_type !== JOB_TYPE.LESSON_GENERATION) {
    return false;
  }
  const resultData = getJobResultData(activeJob);
  return resultData.node_id === nodeId;
}

export function matchesRemedialGenerationJob(
  activeJob: ActiveJobResponse,
  sessionId: number
) {
  if (
    !activeJob.job_id ||
    activeJob.job_type !== JOB_TYPE.REMEDIAL_GENERATION
  ) {
    return false;
  }
  const resultData = getJobResultData(activeJob);
  return resultData.session_id === sessionId;
}

function readPendingLessonContext(): PendingLessonContext | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem("learn8_pending_lesson");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingLessonContext;
  } catch {
    window.sessionStorage.removeItem("learn8_pending_lesson");
    return null;
  }
}

function readPendingQuestionnaireContext(): PendingQuestionnaireContext | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem("learn8_pending_questionnaire");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingQuestionnaireContext;
  } catch {
    window.sessionStorage.removeItem("learn8_pending_questionnaire");
    return null;
  }
}

export function buildActiveJobResumeState(
  activeJob: ActiveJobResponse
): ActiveJobResumeState | null {
  if (!activeJob.job_id || !activeJob.job_type) {
    return null;
  }

  const resultData = getJobResultData(activeJob);

  if (
    activeJob.job_type === JOB_TYPE.LESSON_GENERATION ||
    activeJob.job_type === JOB_TYPE.REMEDIAL_GENERATION
  ) {
    const pending = readPendingLessonContext();
    const courseId = pending?.courseId;
    const nodeId = pending?.nodeId ?? (resultData.node_id as string | undefined);
    const jobCopy = getJobCopy(activeJob.job_type, activeJob.status, {
      routeReady: !!courseId && !!nodeId,
    });

    if (!courseId || !nodeId) {
      return {
        jobId: activeJob.job_id,
        jobType: activeJob.job_type,
        status: activeJob.status,
        resumeHref: "/home",
        title: jobCopy.title,
        description: jobCopy.description,
        progress: clampJobProgress(activeJob.progress),
        message: activeJob.message || jobCopy.fallbackMessage,
        retryable: activeJob.retryable,
      };
    }

    return {
      jobId: activeJob.job_id,
      jobType: activeJob.job_type,
      status: activeJob.status,
      resumeHref: `/courses/${courseId}/nodes/${nodeId}`,
      title: jobCopy.title,
      description: jobCopy.description,
      progress: clampJobProgress(activeJob.progress),
      message: activeJob.message || jobCopy.fallbackMessage,
      retryable: activeJob.retryable,
    };
  }

  if (
    activeJob.job_type === JOB_TYPE.QUESTIONNAIRE_GENERATION ||
    activeJob.job_type === JOB_TYPE.SYLLABUS_GENERATION
  ) {
    const pending = readPendingQuestionnaireContext();
    const courseId =
      pending?.courseId || (resultData.course_id as number | undefined);
    const topic = pending?.topic || (resultData.topic as string | undefined);
    const jobCopy = getJobCopy(activeJob.job_type, activeJob.status, { topic });

    return {
      jobId: activeJob.job_id,
      jobType: activeJob.job_type,
      status: activeJob.status,
      resumeHref: courseId ? `/questionnaire?courseId=${courseId}` : "/questionnaire",
      title: jobCopy.title,
      description: jobCopy.description,
      progress: clampJobProgress(activeJob.progress),
      message: activeJob.message || jobCopy.fallbackMessage,
      retryable: activeJob.retryable,
    };
  }

  const jobCopy = getJobCopy(activeJob.job_type, activeJob.status);

  return {
    jobId: activeJob.job_id,
    jobType: activeJob.job_type,
    status: activeJob.status,
    resumeHref: "/home",
    title: jobCopy.title,
    description: jobCopy.description,
    progress: clampJobProgress(activeJob.progress),
    message: activeJob.message || jobCopy.fallbackMessage,
    retryable: activeJob.retryable,
  };
}
