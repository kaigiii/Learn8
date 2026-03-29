"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import ForgeStatus from "@/components/feedback/ForgeStatus";
import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import { useQuestionnaireFlow } from "@/features/questionnaire/hooks/useQuestionnaireFlow";
import { JOB_TYPE } from "@/lib/domain/statuses";
import { getJobCancelLabel, getJobRetryLabel } from "@/lib/jobs/policy";

export default function QuestionnairePageClient() {
  const {
    step,
    topic,
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
    retryGeneration,
    submitQuestionnaire,
    cancelGeneration,
  } = useQuestionnaireFlow();

  const canSubmit = useMemo(() => {
    if (questions.length === 0) return false;
    return questions.every((question) => {
      const value = answers[question.id];
      if (!value?.trim()) return false;
      if (value === "OTHER:") return false;
      return true;
    });
  }, [answers, questions]);

  const isGenerationStep =
    (step === "loading" || step === "forging") && !!jobType;

  if (isGenerationStep) {
    return (
      <div className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]">
        <main className="relative z-10 flex min-h-dvh flex-1 flex-col">
          <div className="flex flex-1 flex-col">
            <ForgeStatus
              error={error}
              title={
                step === "loading"
                  ? "Generating your personalised questionnaire..."
                  : jobType === JOB_TYPE.QUESTIONNAIRE_GENERATION
                    ? "Generating your personalised questionnaire..."
                    : "Forging your personalised syllabus..."
              }
              subtitle={
                step === "loading"
                  ? "We are analysing your topic and preparing a short set of questions to shape the course path."
                  : "Questionnaire received. Forging your personalised syllabus..."
              }
              statusMessage={jobMessage}
              progress={jobProgress}
              actions={
                <>
                  {canRetryGeneration && (
                    <GameButton
                      variant="secondary"
                      onClick={() => void retryGeneration()}
                    >
                      {getJobRetryLabel()}
                    </GameButton>
                  )}
                  <GameButton
                    variant="secondary"
                    onClick={() => void cancelGeneration()}
                  >
                    {getJobCancelLabel()}
                  </GameButton>
                </>
              }
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]">
      <TopStatsBar backHref="/home" pageTitle="Questionnaire" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 md:px-8">
        <DeepGlassCard className="px-6 py-6 md:px-8 md:py-8">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-brand-teal">
                Tailoring Phase
              </p>
              <h1 className="mb-2 font-heading text-2xl font-extrabold text-brand-gray-700 md:text-3xl">
                {topic || "Questionnaire"}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-brand-gray-500">
                Answer a few quick questions so the syllabus can adapt to your
                background, pace, and practical goals before the course is forged.
              </p>
            </div>
          </div>

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

                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                        answers[question.id] === "SKIP"
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-brand-gray-200 bg-white text-brand-gray-500 hover:border-brand-teal/50"
                      }`}
                    >
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
                    Your answers will be summarized into a learner profile before
                    course generation starts.
                  </p>
                </div>
                <GameButton
                  onClick={() => void submitQuestionnaire()}
                  disabled={!canSubmit}
                  className="min-w-[240px]"
                >
                  Submit & Forge Syllabus
                </GameButton>
              </div>
            </div>
          )}

          {error && <p className="mt-6 text-sm text-rose-500">{error}</p>}
        </DeepGlassCard>
      </div>
    </div>
  );
}
