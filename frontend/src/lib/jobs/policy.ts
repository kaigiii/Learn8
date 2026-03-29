"use client";

import type { ActiveJobResponse } from "@/lib/apiTypes";
import { JOB_STATUS, JOB_TYPE } from "@/lib/domain/statuses";

type JobStatus = ActiveJobResponse["status"];
type JobType = ActiveJobResponse["job_type"];

interface JobCopyOptions {
  topic?: string;
  routeReady?: boolean;
}

interface JobCopyResult {
  title: string;
  description: string;
  fallbackMessage: string;
}

export function getJobCtaLabel(status?: JobStatus) {
  return status === JOB_STATUS.STALE ? "Open Flow" : "Resume";
}

export function getJobRetryLabel() {
  return "Retry";
}

export function getJobCancelLabel() {
  return "Cancel";
}

export function getJobCopy(
  jobType?: JobType,
  status?: JobStatus,
  options: JobCopyOptions = {}
): JobCopyResult {
  const resolvedIsStale = status === JOB_STATUS.STALE;

  if (
    jobType === JOB_TYPE.LESSON_GENERATION ||
    jobType === JOB_TYPE.REMEDIAL_GENERATION
  ) {
    if (!options.routeReady) {
      return {
        title: "Unfinished lesson flow found",
        description:
          "We found a lesson-related generation task, but the route context is incomplete.",
        fallbackMessage: "Reconnecting to lesson generation...",
      };
    }

    if (resolvedIsStale) {
      return {
        title:
          jobType === JOB_TYPE.LESSON_GENERATION
            ? "Lesson generation needs retry"
            : "Remedial generation needs retry",
        description:
          "The generation stalled after a disconnect or backend restart. Retry when you are ready.",
        fallbackMessage: "Generation stalled and can be retried.",
      };
    }

    return {
      title:
        jobType === JOB_TYPE.LESSON_GENERATION
          ? "Lesson still forging"
          : "Remedial lesson still generating",
      description:
        jobType === JOB_TYPE.LESSON_GENERATION
          ? "We found an unfinished lesson generation. Resume and keep waiting from the node page."
          : "We found an unfinished remedial generation. Resume the lesson to continue when it is ready.",
      fallbackMessage:
        jobType === JOB_TYPE.LESSON_GENERATION
          ? "Reconnecting to lesson generation..."
          : "Reconnecting to remedial generation...",
    };
  }

  if (
    jobType === JOB_TYPE.QUESTIONNAIRE_GENERATION ||
    jobType === JOB_TYPE.SYLLABUS_GENERATION
  ) {
    if (resolvedIsStale) {
      return {
        title:
          jobType === JOB_TYPE.QUESTIONNAIRE_GENERATION
            ? "Questionnaire generation needs retry"
            : "Syllabus generation needs retry",
        description:
          "The generation stalled after a disconnect or backend restart. Retry to resume the flow.",
        fallbackMessage: "Generation stalled and can be retried.",
      };
    }

    return {
      title:
        jobType === JOB_TYPE.QUESTIONNAIRE_GENERATION
          ? "Questionnaire still generating"
          : "Syllabus still forging",
      description:
        jobType === JOB_TYPE.QUESTIONNAIRE_GENERATION
          ? `Resume the tailoring flow${options.topic ? ` for ${options.topic}` : ""}.`
          : `Resume the syllabus forge${options.topic ? ` for ${options.topic}` : ""}.`,
      fallbackMessage:
        jobType === JOB_TYPE.QUESTIONNAIRE_GENERATION
          ? "Reconnecting to questionnaire generation..."
          : "Reconnecting to syllabus generation...",
    };
  }

  return {
    title: "Unfinished generation found",
    description:
      "We found an active background generation task. Reopen the flow to continue.",
    fallbackMessage: "Reconnecting to background generation...",
  };
}
