"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ForgeStatus from "@/components/shared/ForgeStatus";
import TopStatsBar from "@/components/shared/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import { ApiError, apiFetch, buildSseUrl } from "@/lib/api";
import type {
  CoursePath,
  DraftData,
  JobStreamEvent,
  LearnerProfile,
  Question,
} from "@/lib/types";

type Step = "loading" | "answering" | "forging";

export default function QuestionnairePage() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [step, setStep] = useState<Step>("loading");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState("");

  const connectQuestionnaireJob = useCallback(
    (jobId: string, pendingProjectId: number, pendingTopic: string) => {
      const eventSource = new EventSource(buildSseUrl(jobId));
      eventSource.onmessage = async (event) => {
        const data = JSON.parse(event.data) as JobStreamEvent;

        if (data.status === "COMPLETED") {
          eventSource.close();
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
          eventSource.close();
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem("learn8_pending_questionnaire");
          }
          setError(data.message || "Questionnaire generation failed.");
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("learn8_pending_questionnaire");
        }
        setError("Lost connection while generating questionnaire.");
      };
    },
    []
  );

  const connectSyllabusJob = useCallback(
    (jobId: string) => {
      setStep("forging");
      const eventSource = new EventSource(buildSseUrl(jobId));
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data) as JobStreamEvent;

        if (data.status === "COMPLETED") {
          eventSource.close();
          const result =
            typeof data.result_data === "string"
              ? (JSON.parse(data.result_data) as { course_id?: number })
              : ((data.result_data || {}) as { course_id?: number });

          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem("learn8_pending_questionnaire");
          }
          router.push(`/courses/${result.course_id}`);
        }

        if (data.status === "FAILED" || data.status === "CANCELLED") {
          eventSource.close();
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem("learn8_pending_questionnaire");
          }
          setStep("answering");
          setError(data.message || "Failed to forge syllabus.");
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("learn8_pending_questionnaire");
        }
        setStep("answering");
        setError("Lost connection while forging syllabus.");
      };
    },
    [router]
  );

  useEffect(() => {
    if (startedRef.current || typeof window === "undefined") return;
    startedRef.current = true;

    const raw = window.sessionStorage.getItem("learn8_pending_questionnaire");
    if (!raw) {
      router.replace("/home");
      return;
    }

    const pending = JSON.parse(raw) as { projectId: number; topic: string };
    setProjectId(pending.projectId);
    setTopic(pending.topic);

    const start = async () => {
      try {
        const draftResponse = await apiFetch<{ draft?: DraftData }>(
          `/projects/${pending.projectId}/draft`
        );
        const draft = draftResponse.draft;

        if (draft?.topic) {
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
          connectQuestionnaireJob(
            activeJob.job_id,
            pending.projectId,
            pending.topic
          );
          return;
        }

        if (activeJob.job_id && activeJob.job_type === "SYLLABUS_GEN") {
          connectSyllabusJob(activeJob.job_id);
          return;
        }

        if (draft?.questions?.length) {
          setQuestions(draft.questions);
          setStep("answering");
          return;
        }

        const ticket = await apiFetch<{ job_id: string; status: "PENDING" }>(
          `/projects/${pending.projectId}/questionnaire?topic=${encodeURIComponent(
            pending.topic
          )}`,
          { method: "POST" }
        );
        connectQuestionnaireJob(ticket.job_id, pending.projectId, pending.topic);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.detail
            : "Failed to generate questionnaire."
        );
      }
    };

    void start();
  }, [connectQuestionnaireJob, connectSyllabusJob, router]);

  const canSubmit = useMemo(() => {
    if (questions.length === 0) return false;
    return questions.every((question) => {
      const value = answers[question.id];
      if (!value?.trim()) return false;
      if (value === "OTHER:") return false;
      return true;
    });
  }, [answers, questions]);

  const handleSubmit = async () => {
    if (!projectId) return;

    setStep("forging");
    setError("");

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
      await apiFetch<LearnerProfile>(
        `/projects/${projectId}/questionnaire/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            submission,
            topic,
            questions: augmentedQuestions,
          }),
        }
      );

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
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("learn8_pending_questionnaire");
        }
        router.push(`/courses/${syllabusResult.id}`);
        return;
      }

      if (!("job_id" in syllabusResult)) {
        throw new Error("Syllabus response did not include a job id.");
      }

      connectSyllabusJob(syllabusResult.job_id);
    } catch (err) {
      setStep("answering");
      setError(
        err instanceof ApiError ? err.detail : "Failed to submit questionnaire."
      );
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]">
      <TopStatsBar backHref="/home" pageTitle="Questionnaire" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 py-8">
        <DeepGlassCard className="px-6 py-6 md:px-8 md:py-8">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-teal mb-2">
                Tailoring Phase
              </p>
              <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-brand-gray-700 mb-2">
                {topic || "Questionnaire"}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-brand-gray-500">
                Answer a few quick questions so the syllabus can adapt to your background, pace, and practical goals before the course is forged.
              </p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/60 px-4 py-3 text-sm text-brand-gray-600 shadow-sm">
              <span className="font-semibold text-brand-gray-700">{questions.length}</span>{" "}
              prompts in this set
            </div>
          </div>

          {step === "loading" && (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-5 rounded-[28px] border border-white/60 bg-white/45">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-teal/20 border-t-brand-teal" />
              <p className="font-heading text-lg font-bold text-brand-gray-700">
                Generating your personalized questionnaire...
              </p>
              <p className="max-w-md text-center text-sm text-brand-gray-500">
                We are analyzing your topic and preparing a short set of questions to shape the course path.
              </p>
            </div>
          )}

          {step === "forging" && (
            <ForgeStatus
              error={error}
              subtitle="Questionnaire received. Forging your personalised syllabus..."
            />
          )}

          {step === "answering" && questions.length > 0 && (
            <div className="space-y-6">
              {questions.map((question, index) => (
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[24px] border border-white/70 bg-white/75 p-5 shadow-[0_12px_30px_rgba(122,199,196,0.08)]"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-teal to-[#5fb3af] text-sm font-heading font-extrabold text-white shadow-md">
                      {index + 1}
                    </div>
                    <p className="pt-1 font-heading text-lg font-bold leading-snug text-brand-gray-700">
                      {question.text}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {(question.options || []).map((option) => (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                          answers[question.id] === option
                            ? "border-brand-teal/60 bg-brand-teal/10 text-brand-teal"
                            : "border-brand-gray-200 bg-white text-brand-gray-700 hover:border-brand-teal/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          checked={answers[question.id] === option}
                          onChange={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [question.id]: option,
                            }))
                          }
                        />
                        <span>{option}</span>
                      </label>
                    ))}

                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 transition hover:border-brand-teal/50">
                      <input
                        type="radio"
                        name={question.id}
                        checked={answers[question.id]?.startsWith("OTHER:") || false}
                        onChange={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [question.id]: prev[question.id]?.startsWith("OTHER:")
                              ? prev[question.id]
                              : "OTHER:",
                          }))
                        }
                      />
                      <span>Other</span>
                    </label>

                    {answers[question.id]?.startsWith("OTHER:") && (
                      <input
                        value={answers[question.id].slice(6)}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [question.id]: `OTHER:${e.target.value}`,
                          }))
                        }
                        placeholder="Please specify..."
                        className="w-full rounded-2xl border border-brand-teal/30 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
                      />
                    )}

                    <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                      answers[question.id] === "SKIP"
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-brand-gray-200 bg-white text-brand-gray-500 hover:border-brand-teal/50"
                    }`}>
                      <input
                        type="radio"
                        name={question.id}
                        checked={answers[question.id] === "SKIP"}
                        onChange={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [question.id]: "SKIP",
                          }))
                        }
                      />
                      <span>Skip this question</span>
                    </label>
                  </div>
                </motion.div>
              ))}

              <div className="rounded-2xl border border-white/60 bg-white/70 p-5">
                <p className="mb-2 font-heading text-lg font-bold text-brand-gray-700">
                  Additional Notes
                </p>
                <p className="mb-4 text-sm text-brand-gray-500">
                  Optional. Tell us anything that would help shape the course.
                </p>
                <textarea
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  rows={5}
                  placeholder="I prefer practical examples, I already know the basics, I need this for work..."
                  className="w-full rounded-[24px] border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
                />
              </div>

              <div className="flex flex-col gap-4 rounded-[24px] border border-white/70 bg-white/65 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-heading text-lg font-bold text-brand-gray-700">
                    Ready to forge the syllabus
                  </p>
                  <p className="mt-1 text-sm text-brand-gray-500">
                    Your answers will be summarized into a learner profile before course generation starts.
                  </p>
                </div>
                <GameButton
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit}
                  className="min-w-[240px]"
                >
                  Submit & Forge Syllabus
                </GameButton>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-6 text-sm text-rose-500">{error}</p>
          )}
        </DeepGlassCard>
      </div>
    </div>
  );
}
