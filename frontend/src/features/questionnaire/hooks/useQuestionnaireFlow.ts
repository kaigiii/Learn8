"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { JOB_STATUS, JOB_TYPE } from "@/lib/domain/statuses";
import { ensureRetryableJob, fetchScopedActiveJob } from "@/lib/jobs/recovery";
import { getJobCopy } from "@/lib/jobs/policy";
import {
  clearPendingQuestionnaireNavigation,
  getPendingQuestionnaireNavigation,
  rememberCourseNavigation,
} from "@/lib/navigation/intents";
import { watchJobStream } from "@/lib/jobs/stream";
import type {
  CourseListItem,
  CoursePath,
  DraftData,
  LearnerProfile,
  Question,
} from "@/lib/apiTypes";

export type QuestionnaireStep = "loading" | "answering" | "forging";
export type QuestionnaireJobType =
  | typeof JOB_TYPE.QUESTIONNAIRE_GENERATION
  | typeof JOB_TYPE.SYLLABUS_GENERATION
  | null;

export function useQuestionnaireFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeJobIdRef = useRef<string | null>(null);
  const hasNavigatedAwayRef = useRef(false);

  const [step, setStep] = useState<QuestionnaireStep>("answering");
  const [courseId, setCourseId] = useState<number | null>(null);
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState("");
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [jobType, setJobType] = useState<QuestionnaireJobType>(null);
  const [canRetryGeneration, setCanRetryGeneration] = useState(false);

  const clearPendingQuestionnaire = useCallback(() => {
    clearPendingQuestionnaireNavigation();
  }, []);

  const resetQuestionnaireState = useCallback(() => {
    activeJobIdRef.current = null;
    hasNavigatedAwayRef.current = false;
    setCourseId(null);
    setTopic("");
    setQuestions([]);
    setAnswers({});
    setFreeText("");
    setError("");
    setJobProgress(0);
    setJobMessage("");
    setJobType(null);
    setCanRetryGeneration(false);
    setStep("answering");
  }, []);

  const connectQuestionnaireJob = useCallback(
    (jobId: string, pendingCourseId: number, pendingTopic: string) => {
      activeJobIdRef.current = jobId;
      setCanRetryGeneration(false);
      setStep("loading");
      setJobType(JOB_TYPE.QUESTIONNAIRE_GENERATION);
      setJobProgress(0);
      setJobMessage(
        getJobCopy(JOB_TYPE.QUESTIONNAIRE_GENERATION, JOB_STATUS.PROCESSING)
          .fallbackMessage
      );

      return watchJobStream(jobId, {
        onUpdate: (data) => {
          setJobType(JOB_TYPE.QUESTIONNAIRE_GENERATION);
          setJobProgress(data.progress ?? 0);
          setJobMessage(
            data.message || "Generating your personalised questionnaire..."
          );
        },
        onCompleted: async (data) => {
          if (hasNavigatedAwayRef.current) return;
          activeJobIdRef.current = null;
          setCanRetryGeneration(false);
          const result =
            typeof data.result_data === "string"
              ? (JSON.parse(data.result_data) as { questions?: Question[] })
              : ((data.result_data || {}) as { questions?: Question[] });

          const generatedQuestions = result.questions || [];
          setQuestions(generatedQuestions);
          setStep("answering");

          await apiFetch(`/courses/${pendingCourseId}/draft`, {
            method: "PUT",
            body: JSON.stringify({
              draft: {
                topic: pendingTopic,
                questions: generatedQuestions,
                answers: {},
                freeText: "",
              },
            }),
          });
        },
        onFailed: (data) => {
          if (hasNavigatedAwayRef.current) return;
          activeJobIdRef.current = null;
          setCanRetryGeneration(false);
          setStep("answering");
          setError(data.message || "Questionnaire generation failed.");
        },
        onCancelled: (data) => {
          if (hasNavigatedAwayRef.current) return;
          activeJobIdRef.current = null;
          clearPendingQuestionnaire();
          setCanRetryGeneration(false);
          setError(data.message || "Questionnaire generation was cancelled.");
        },
        onStale: async (data) => {
          if (hasNavigatedAwayRef.current) return;
          activeJobIdRef.current = null;
          setCanRetryGeneration(true);
          setError(
            data.message ||
              getJobCopy(JOB_TYPE.QUESTIONNAIRE_GENERATION, JOB_STATUS.STALE)
                .fallbackMessage
          );
        },
        onError: () => {
          if (hasNavigatedAwayRef.current) return;
          activeJobIdRef.current = null;
          setCanRetryGeneration(true);
          setStep("answering");
          setError("Lost connection while generating questionnaire. Retry when the backend is back.");
        },
      });
    },
    [clearPendingQuestionnaire]
  );

  const connectSyllabusJob = useCallback(
    (jobId: string, pendingCourseId: number) => {
      setStep("forging");
      activeJobIdRef.current = jobId;
      setCanRetryGeneration(false);
      setJobType(JOB_TYPE.SYLLABUS_GENERATION);
      setJobProgress(0);
      setJobMessage(
        getJobCopy(JOB_TYPE.SYLLABUS_GENERATION, JOB_STATUS.PROCESSING)
          .fallbackMessage
      );

      return watchJobStream(jobId, {
        onUpdate: (data) => {
          setJobType(JOB_TYPE.SYLLABUS_GENERATION);
          setJobProgress(data.progress ?? 0);
          setJobMessage(data.message || "Forging your personalised syllabus...");
        },
        onCompleted: async (data) => {
          if (hasNavigatedAwayRef.current) return;
          activeJobIdRef.current = null;
          setCanRetryGeneration(false);
          const result =
            typeof data.result_data === "string"
              ? (JSON.parse(data.result_data) as { course_id?: number })
              : ((data.result_data || {}) as { course_id?: number });
          let resolvedCourseId = result.course_id;

          if (!resolvedCourseId) {
            resolvedCourseId = pendingCourseId;
          }

          clearPendingQuestionnaire();
          if (!resolvedCourseId) {
            setStep("answering");
            setError("Syllabus finished, but the course could not be located.");
            return;
          }

          hasNavigatedAwayRef.current = true;
          rememberCourseNavigation(resolvedCourseId);
          router.push(`/courses/${resolvedCourseId}`);
        },
        onFailed: (data) => {
          if (hasNavigatedAwayRef.current) return;
          activeJobIdRef.current = null;
          clearPendingQuestionnaire();
          setCanRetryGeneration(false);
          setStep("answering");
          setError(data.message || "Failed to forge syllabus.");
        },
        onCancelled: (data) => {
          if (hasNavigatedAwayRef.current) return;
          activeJobIdRef.current = null;
          clearPendingQuestionnaire();
          setCanRetryGeneration(false);
          setStep("answering");
          setError(data.message || "Syllabus generation was cancelled.");
        },
        onStale: (data) => {
          if (hasNavigatedAwayRef.current) return;
          activeJobIdRef.current = null;
          setCanRetryGeneration(true);
          setStep("answering");
          setError(
            data.message ||
              getJobCopy(JOB_TYPE.SYLLABUS_GENERATION, JOB_STATUS.STALE)
                .fallbackMessage
          );
        },
        onError: () => {
          if (hasNavigatedAwayRef.current) return;
          activeJobIdRef.current = null;
          setCanRetryGeneration(true);
          setStep("answering");
          setError("Lost connection while forging syllabus. Retry when the backend is back.");
        },
      });
    },
    [clearPendingQuestionnaire, router]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    resetQuestionnaireState();

    const courseIdFromQuery = searchParams.get("courseId");

    const start = async () => {
      try {
        let pendingCourseId: number | null = null;
        let pendingTopic = "";
        const pending = getPendingQuestionnaireNavigation();

        if (pending) {
          pendingCourseId = pending.courseId ?? null;
          pendingTopic = pending.topic || "";
        } else if (courseIdFromQuery) {
          pendingCourseId = Number(courseIdFromQuery);
        }

        if (!pendingCourseId || Number.isNaN(pendingCourseId)) {
          setStep("answering");
          setCanRetryGeneration(false);
          setError("Missing course context. Start a new course from Home.");
          return;
        }

        setCourseId(pendingCourseId);

        const draftResponse = await apiFetch<{ draft?: DraftData }>(
          `/courses/${pendingCourseId}/draft`
        );
        const draft = draftResponse.draft;

        if (draft?.topic) {
          pendingTopic = draft.topic;
          setTopic(draft.topic);
        }
        if (draft?.answers) {
          setAnswers(draft.answers);
        }
        if (draft?.freeText) {
          setFreeText(draft.freeText);
        }

        const syllabusJob = await ensureRetryableJob(
          await fetchScopedActiveJob({
            jobType: JOB_TYPE.SYLLABUS_GENERATION,
            courseId: pendingCourseId,
          })
        );
        if (syllabusJob.job_id) {
          setJobType(JOB_TYPE.SYLLABUS_GENERATION);
          connectSyllabusJob(String(syllabusJob.job_id), pendingCourseId);
          return;
        }

        if (draft?.questions?.length) {
          setQuestions(draft.questions);
          setStep("answering");
          setCanRetryGeneration(false);
          return;
        }

        const questionnaireJob = await ensureRetryableJob(
          await fetchScopedActiveJob({
            jobType: JOB_TYPE.QUESTIONNAIRE_GENERATION,
            courseId: pendingCourseId,
          })
        );
        if (questionnaireJob.job_id) {
          setJobType(JOB_TYPE.QUESTIONNAIRE_GENERATION);
          connectQuestionnaireJob(
            String(questionnaireJob.job_id),
            pendingCourseId,
            pendingTopic
          );
          return;
        }

        if (!pendingTopic) {
          setStep("answering");
          setCanRetryGeneration(false);
          setError(
            "This course does not have a topic yet. Return to Home to start a new one."
          );
          return;
        }

        const ticket = await apiFetch<{
          job_id: string;
          status: typeof JOB_STATUS.PENDING;
        }>(
          `/courses/${pendingCourseId}/questionnaire?topic=${encodeURIComponent(
            pendingTopic
          )}`,
          { method: "POST" }
        );
        connectQuestionnaireJob(ticket.job_id, pendingCourseId, pendingTopic);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.detail : "Failed to generate questionnaire."
        );
      }
    };

    void start();
  }, [
    connectQuestionnaireJob,
    connectSyllabusJob,
    resetQuestionnaireState,
    searchParams,
  ]);

  const submitQuestionnaire = useCallback(async () => {
    if (!courseId) return;

    setStep("forging");
    setError("");
    setCanRetryGeneration(false);
    setJobType(JOB_TYPE.SYLLABUS_GENERATION);
    setJobProgress(0);
    setJobMessage("Packaging your answers into a learner profile...");

    const submission = {
      responses: Object.entries(answers).map(([question_id, answer]) => ({
        question_id,
        answer,
      })),
    };

    const augmentedQuestions = [...questions];
    if (freeText.trim()) {
      augmentedQuestions.push({
        id: "free-text-note",
        text: "Additional User Notes",
        type: "text",
      });
      submission.responses.push({
        question_id: "free-text-note",
        answer: freeText.trim(),
      });
    }

    try {
      await apiFetch<LearnerProfile>(`/courses/${courseId}/questionnaire/submit`, {
        method: "POST",
        body: JSON.stringify({
          submission,
          topic,
          questions: augmentedQuestions,
        }),
      });

      await apiFetch(`/courses/${courseId}/draft`, {
        method: "PUT",
        body: JSON.stringify({
          draft: {
            topic,
            questions,
            answers,
            freeText,
          },
        }),
      });

      const syllabusResult = await apiFetch<
        { job_id: string; status: typeof JOB_STATUS.PENDING } | CoursePath
      >(
        `/courses/generate-syllabus?topic=${encodeURIComponent(
          topic
        )}&course_id=${courseId}`,
        { method: "POST" }
      );

      if ("courseTitle" in syllabusResult && syllabusResult.id) {
        clearPendingQuestionnaire();
        hasNavigatedAwayRef.current = true;
        rememberCourseNavigation(syllabusResult.id);
        router.push(`/courses/${syllabusResult.id}`);
        return;
      }

      if (!("job_id" in syllabusResult)) {
        throw new Error("Syllabus response did not include a job id.");
      }

      connectSyllabusJob(syllabusResult.job_id, courseId);
    } catch (err) {
      setStep("answering");
      setError(
        err instanceof ApiError ? err.detail : "Failed to submit questionnaire."
      );
    }
  }, [
    answers,
    clearPendingQuestionnaire,
    connectSyllabusJob,
    freeText,
    courseId,
    questions,
    router,
    topic,
  ]);

  const cancelGeneration = useCallback(async () => {
    const jobId = activeJobIdRef.current;
    if (!jobId) {
      router.push("/home");
      return;
    }

    try {
      await apiFetch(`/jobs/${jobId}/cancel`, {
        method: "POST",
      });
    } catch {
      // Ignore cancel failure and still unwind local UI state.
    } finally {
      activeJobIdRef.current = null;
      clearPendingQuestionnaire();
      setStep("answering");
      setCanRetryGeneration(false);
      setError("");
      router.push("/home");
    }
  }, [clearPendingQuestionnaire, router]);

  const retryGeneration = useCallback(async () => {
    if (!courseId || !jobType) return;

    try {
      setError("");
      setCanRetryGeneration(false);

      const activeJob = await fetchScopedActiveJob({
        jobType,
        courseId,
      });

      if (!activeJob.job_id) {
        setError("No retryable generation was found for this flow.");
        return;
      }

      const resumableJob = await ensureRetryableJob(activeJob);
      if (!resumableJob.job_id) {
        setError("This generation cannot be retried right now.");
        return;
      }

      if (jobType === JOB_TYPE.QUESTIONNAIRE_GENERATION) {
        connectQuestionnaireJob(resumableJob.job_id, courseId, topic);
        return;
      }

      connectSyllabusJob(resumableJob.job_id, courseId);
    } catch (err) {
      setCanRetryGeneration(true);
      setError(
        err instanceof ApiError ? err.detail : "Failed to retry generation."
      );
    }
  }, [
    connectQuestionnaireJob,
    connectSyllabusJob,
    jobType,
    courseId,
    topic,
  ]);

  return {
    step,
    courseId,
    topic,
    setTopic,
    questions,
    answers,
    setAnswers,
    freeText,
    setFreeText,
    error,
    jobProgress,
    jobMessage,
    jobType,
    canRetryGeneration,
    setError,
    retryGeneration,
    submitQuestionnaire,
    cancelGeneration,
  };
}
