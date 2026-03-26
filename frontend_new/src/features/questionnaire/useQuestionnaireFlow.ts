"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { openJobStream } from "@/lib/jobs/stream";
import type {
  CourseListItem,
  CoursePath,
  DraftData,
  LearnerProfile,
  Question,
} from "@/lib/apiTypes";

export type QuestionnaireStep = "loading" | "answering" | "forging";
export type QuestionnaireJobType = "QUESTIONNAIRE_GEN" | "SYLLABUS_GEN" | null;

function rememberCourseNavigation(courseId: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    "learn8_recent_course_navigation",
    JSON.stringify({
      courseId,
      timestamp: Date.now(),
    })
  );
}

export function useQuestionnaireFlow() {
  const router = useRouter();
  const startedRef = useRef(false);
  const activeJobIdRef = useRef<string | null>(null);
  const hasNavigatedAwayRef = useRef(false);

  const [step, setStep] = useState<QuestionnaireStep>("loading");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState("");
  const [jobProgress, setJobProgress] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [jobType, setJobType] = useState<QuestionnaireJobType>(null);

  const clearPendingQuestionnaire = useCallback(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem("learn8_pending_questionnaire");
  }, []);

  const connectQuestionnaireJob = useCallback(
    (jobId: string, pendingProjectId: number, pendingTopic: string) => {
      activeJobIdRef.current = jobId;
      setStep("loading");
      setJobType("QUESTIONNAIRE_GEN");
      setJobProgress(0);
      setJobMessage("Preparing your personalised questionnaire...");

      return openJobStream(jobId, {
        onEvent: async (data, source) => {
          setJobType("QUESTIONNAIRE_GEN");
          setJobProgress(data.progress ?? 0);
          setJobMessage(
            data.message || "Generating your personalised questionnaire..."
          );

          if (data.status === "COMPLETED") {
            if (hasNavigatedAwayRef.current) {
              source.close();
              return;
            }
            activeJobIdRef.current = null;
            source.close();
            const result =
              typeof data.result_data === "string"
                ? (JSON.parse(data.result_data) as { questions?: Question[] })
                : ((data.result_data || {}) as { questions?: Question[] });

            const generatedQuestions = result.questions || [];
            setQuestions(generatedQuestions);
            setStep("answering");

            await apiFetch(`/projects/${pendingProjectId}/draft`, {
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
          }

          if (data.status === "FAILED" || data.status === "CANCELLED") {
            if (hasNavigatedAwayRef.current) {
              source.close();
              return;
            }
            activeJobIdRef.current = null;
            source.close();
            clearPendingQuestionnaire();
            setError(data.message || "Questionnaire generation failed.");
          }
        },
        onError: (source) => {
          if (hasNavigatedAwayRef.current) {
            source.close();
            return;
          }
          activeJobIdRef.current = null;
          source.close();
          clearPendingQuestionnaire();
          setError("Lost connection while generating questionnaire.");
        },
      });
    },
    [clearPendingQuestionnaire]
  );

  const connectSyllabusJob = useCallback(
    (jobId: string, pendingProjectId: number) => {
      setStep("forging");
      activeJobIdRef.current = jobId;
      setJobType("SYLLABUS_GEN");
      setJobProgress(0);
      setJobMessage("Preparing your syllabus forge...");

      return openJobStream(jobId, {
        onEvent: async (data, source) => {
          setJobType("SYLLABUS_GEN");
          setJobProgress(data.progress ?? 0);
          setJobMessage(data.message || "Forging your personalised syllabus...");

          if (data.status === "COMPLETED") {
            if (hasNavigatedAwayRef.current) {
              source.close();
              return;
            }
            activeJobIdRef.current = null;
            source.close();
            const result =
              typeof data.result_data === "string"
                ? (JSON.parse(data.result_data) as { course_id?: number })
                : ((data.result_data || {}) as { course_id?: number });
            let resolvedCourseId = result.course_id;

            if (!resolvedCourseId) {
              const projectCourses = await apiFetch<CourseListItem[]>(
                `/courses?project_id=${pendingProjectId}`
              );
              resolvedCourseId = projectCourses[0]?.id;
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
          }

          if (data.status === "FAILED" || data.status === "CANCELLED") {
            if (hasNavigatedAwayRef.current) {
              source.close();
              return;
            }
            activeJobIdRef.current = null;
            source.close();
            clearPendingQuestionnaire();
            setStep("answering");
            setError(data.message || "Failed to forge syllabus.");
          }
        },
        onError: (source) => {
          if (hasNavigatedAwayRef.current) {
            source.close();
            return;
          }
          activeJobIdRef.current = null;
          source.close();
          clearPendingQuestionnaire();
          setStep("answering");
          setError("Lost connection while forging syllabus.");
        },
      });
    },
    [clearPendingQuestionnaire, router]
  );

  useEffect(() => {
    if (startedRef.current || typeof window === "undefined") return;
    startedRef.current = true;

    const raw = window.sessionStorage.getItem("learn8_pending_questionnaire");
    const projectIdFromQuery = new URLSearchParams(window.location.search).get(
      "projectId"
    );

    const start = async () => {
      try {
        let pendingProjectId: number | null = null;
        let pendingTopic = "";

        if (raw) {
          const pending = JSON.parse(raw) as { projectId: number; topic: string };
          pendingProjectId = pending.projectId;
          pendingTopic = pending.topic;
        } else if (projectIdFromQuery) {
          pendingProjectId = Number(projectIdFromQuery);
        }

        if (!pendingProjectId || Number.isNaN(pendingProjectId)) {
          setStep("answering");
          setError("Missing journey context. Start a new journey from Home.");
          return;
        }

        setProjectId(pendingProjectId);

        const draftResponse = await apiFetch<{ draft?: DraftData }>(
          `/projects/${pendingProjectId}/draft`
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

        const activeJob = await apiFetch<{
          job_id: string | null;
          job_type?: string;
          status?: string;
        }>("/jobs/active");

        if (activeJob.job_id && activeJob.job_type === "QUESTIONNAIRE_GEN") {
          setJobType("QUESTIONNAIRE_GEN");
          connectQuestionnaireJob(activeJob.job_id, pendingProjectId, pendingTopic);
          return;
        }

        if (activeJob.job_id && activeJob.job_type === "SYLLABUS_GEN") {
          setJobType("SYLLABUS_GEN");
          connectSyllabusJob(activeJob.job_id, pendingProjectId);
          return;
        }

        if (draft?.questions?.length) {
          setQuestions(draft.questions);
          setStep("answering");
          return;
        }

        if (!pendingTopic) {
          setStep("answering");
          setError(
            "This journey does not have a topic yet. Return to Home to start a new one."
          );
          return;
        }

        const ticket = await apiFetch<{ job_id: string; status: "PENDING" }>(
          `/projects/${pendingProjectId}/questionnaire?topic=${encodeURIComponent(
            pendingTopic
          )}`,
          { method: "POST" }
        );
        connectQuestionnaireJob(ticket.job_id, pendingProjectId, pendingTopic);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.detail : "Failed to generate questionnaire."
        );
      }
    };

    void start();
  }, [connectQuestionnaireJob, connectSyllabusJob]);

  const submitQuestionnaire = useCallback(async () => {
    if (!projectId) return;

    setStep("forging");
    setError("");
    setJobType("SYLLABUS_GEN");
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
      await apiFetch<LearnerProfile>(`/projects/${projectId}/questionnaire/submit`, {
        method: "POST",
        body: JSON.stringify({
          submission,
          topic,
          questions: augmentedQuestions,
        }),
      });

      await apiFetch(`/projects/${projectId}/draft`, {
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
        { job_id: string; status: "PENDING" } | CoursePath
      >(
        `/courses/generate-syllabus?topic=${encodeURIComponent(
          topic
        )}&project_id=${projectId}`,
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

      connectSyllabusJob(syllabusResult.job_id, projectId);
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
    projectId,
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
      setError("");
      router.push("/home");
    }
  }, [clearPendingQuestionnaire, router]);

  return {
    step,
    projectId,
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
    setError,
    submitQuestionnaire,
    cancelGeneration,
  };
}
