"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ForgeStatus from "@/components/feedback/ForgeStatus";
import TopStatsBar from "@/components/layout/TopStatsBar";
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
    autoGenerateAll,
    setAutoGenerateAll,
  } = useQuestionnaireFlow();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const totalPages = questions.length > 0 ? questions.length + 1 : 0;

  const canSubmit = useMemo(() => {
    return questions.length > 0;
  }, [questions.length]);

  const isGenerationStep = step === "loading" || step === "forging";
  const currentQuestion = questions[currentQuestionIndex] ?? null;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] ?? "" : "";
  const isNotesPage = questions.length > 0 && currentQuestionIndex === questions.length;
  const questionProgress =
    totalPages > 0 ? ((currentQuestionIndex + 1) / totalPages) * 100 : 0;
  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastPage = totalPages > 0 && currentQuestionIndex === totalPages - 1;
  const currentQuestionAnswered =
    !!currentAnswer.trim() && currentAnswer !== "OTHER:";
  const canGoNext = isNotesPage || currentQuestionAnswered;

  useEffect(() => {
    setCurrentQuestionIndex(0);
  }, [questions.length]);

  useEffect(() => {
    if (questions.length === 0) {
      return;
    }
    setCurrentQuestionIndex((prev) => Math.min(prev, questions.length));
  }, [questions]);

  useEffect(() => {
    if (step !== "answering" || questions.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && currentQuestionIndex > 0) {
        event.preventDefault();
        setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0));
      }

      if (event.key === "ArrowRight" && canGoNext && currentQuestionIndex < totalPages - 1) {
        event.preventDefault();
        setCurrentQuestionIndex((prev) => Math.min(prev + 1, totalPages - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canGoNext, currentQuestionIndex, questions.length, step, totalPages]);

  const handlePrevious = () => {
    setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    if (!canGoNext) {
      return;
    }
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, totalPages - 1));
  };

  if (isGenerationStep) {
    return (
      <div className="relative min-h-dvh overflow-hidden app-shared-bg">
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
    <div className="relative flex min-h-screen flex-col app-shared-bg">
      <TopStatsBar
        backHref="/home"
        pageTitle="Questionnaire"
        mascotSrc="/icons/icon.ico"
        mascotAlt="Questionnaire mascot"
        mascotImageClassName="scale-110"
        quickLinks={[
          {
            href: "/multiplayer",
            label: "Multiplayer",
            iconSrc: "/svg/multiplayer-controller.svg",
            iconAlt: "Multiplayer",
          },
          {
            href: "/arena/leaderboard",
            label: "Leaderboard",
            iconSrc: "/svg/leaderboard-logo.svg",
            iconAlt: "Leaderboard",
          },
        ]}
      />

      <main className="relative z-10 flex flex-1 flex-col justify-center py-12">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8">
        {step === "answering" && questions.length > 0 && (
          <div className="space-y-6">

            <div className="relative mx-auto max-w-4xl px-12 md:px-24">
              <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 md:block">
                <ArrowNavButton
                  direction="left"
                  onClick={handlePrevious}
                  disabled={isFirstQuestion}
                  sideFloating
                />
              </div>

              <AnimatePresence mode="wait">
                {isNotesPage ? (
                  <motion.div
                    key="notes-page"
                    initial={{ opacity: 0, x: 36, scale: 0.98 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -36, scale: 0.98 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(238,250,250,0.86)_100%)] p-5 shadow-[0_20px_45px_rgba(122,199,196,0.12)] md:p-7"
                  >
                    <div className="mb-6 h-2.5 overflow-hidden rounded-full bg-brand-gray-200/45 shadow-inner">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-teal via-[#6dc8c4] to-brand-green transition-all duration-500 ease-out"
                        style={{ width: `${questionProgress}%` }}
                      />
                    </div>


                    <div className="mb-6 flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-teal to-[#5fb3af] text-base font-heading font-extrabold text-white shadow-md">
                        {currentQuestionIndex + 1}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-teal/80">
                          {`Final Notes ${currentQuestionIndex + 1} of ${totalPages}`} • Final Input
                        </p>
                        <p className="mt-2 font-heading text-2xl font-extrabold leading-snug text-brand-gray-700 md:text-[2rem]">
                          Additional Notes
                        </p>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-gray-500">
                          Optional. Tell us anything that would help shape the course, such as your preferred examples, goals, or current level.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/60 bg-white/70 p-5">
                      <textarea
                        value={freeText}
                        onChange={(e) => setFreeText(e.target.value)}
                        rows={7}
                        placeholder="I prefer practical examples, I already know the basics, I need this for work..."
                        className="w-full rounded-[24px] border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                      />
                    </div>

                    <div className="mt-6 rounded-[24px] border border-white/60 bg-white/70 p-5">
                      <label className="flex cursor-pointer items-start gap-4">
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 rounded border-brand-gray-200 text-brand-teal focus:ring-brand-teal accent-brand-teal cursor-pointer"
                          checked={autoGenerateAll}
                          onChange={(e) => setAutoGenerateAll(e.target.checked)}
                        />
                        <div className="min-w-0">
                          <p className="text-base font-bold text-brand-gray-700">
                            自動生成所有關卡課程內容 (Auto-generate All Levels)
                          </p>
                          <p className="mt-1 text-sm text-brand-gray-500 leading-relaxed">
                            勾選此選項後，大綱地圖生成完畢時，系統會在背景自動為您依序生成每一關的詳細講義與題庫（約需 2~3 分鐘）。若不勾選，則維持「點擊每關時即時生成」。
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="mt-6 flex flex-col gap-4 rounded-[24px] border border-white/70 bg-white/65 p-5 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-heading text-lg font-bold text-brand-gray-700">
                          Ready to forge the syllabus
                        </p>
                        <p className="mt-1 text-sm text-brand-gray-500">
                          Your answers across all {questions.length} prompts will be summarized into a learner profile before course generation starts.
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
                  </motion.div>
                ) : currentQuestion ? (
                  <motion.div
                    key={currentQuestion.id}
                    initial={{ opacity: 0, x: 36, scale: 0.98 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -36, scale: 0.98 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(238,250,250,0.86)_100%)] p-5 shadow-[0_20px_45px_rgba(122,199,196,0.12)] md:p-7"
                  >
                    <div className="mb-6 h-2.5 overflow-hidden rounded-full bg-brand-gray-200/45 shadow-inner">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-teal via-[#6dc8c4] to-brand-green transition-all duration-500 ease-out"
                        style={{ width: `${questionProgress}%` }}
                      />
                    </div>


                    <div className="mb-6 flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-teal to-[#5fb3af] text-base font-heading font-extrabold text-white shadow-md">
                        {currentQuestionIndex + 1}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-teal/80">
                          {`Question ${currentQuestionIndex + 1} of ${totalPages}`} • Learner Signal
                        </p>
                        <p className="mt-2 font-heading text-2xl font-extrabold leading-snug text-brand-gray-700 md:text-[2rem]">
                          {currentQuestion.text}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {(currentQuestion.options || []).map((option) => {
                        const selected = answers[currentQuestion.id] === option;
                        return (
                          <label
                            key={option}
                            className={`group flex cursor-pointer items-start gap-4 rounded-[24px] border px-4 py-4 transition md:px-5 ${
                              selected
                                ? "border-brand-teal/60 bg-brand-teal/10 text-brand-teal shadow-[0_14px_24px_rgba(122,199,196,0.16)]"
                                : "border-brand-gray-200/90 bg-white/92 text-brand-gray-700 hover:-translate-y-0.5 hover:border-brand-teal/40 hover:bg-white"
                            }`}
                          >
                            <input
                              type="radio"
                              name={currentQuestion.id}
                              className="mt-1"
                              checked={selected}
                              onChange={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [currentQuestion.id]: option,
                                }))
                              }
                            />
                            <div className="min-w-0">
                              <p className="text-base font-semibold leading-relaxed">
                                {option}
                              </p>
                            </div>
                          </label>
                        );
                      })}

                      <label
                        className={`flex cursor-pointer items-center gap-4 rounded-[24px] border px-4 py-4 transition md:px-5 ${
                          answers[currentQuestion.id]?.startsWith("OTHER:")
                            ? "border-brand-teal/60 bg-brand-teal/10 text-brand-teal"
                            : "border-brand-gray-200/90 bg-white/92 text-brand-gray-700 hover:border-brand-teal/40 hover:bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name={currentQuestion.id}
                          checked={answers[currentQuestion.id]?.startsWith("OTHER:") || false}
                          onChange={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [currentQuestion.id]: prev[currentQuestion.id]?.startsWith("OTHER:")
                                ? prev[currentQuestion.id]
                                : "OTHER:",
                            }))
                          }
                        />
                        <div>
                          <p className="text-base font-semibold">Other</p>
                          <p className="mt-1 text-sm text-brand-gray-500">
                            Write your own answer if none of the options fit.
                          </p>
                        </div>
                      </label>

                      {answers[currentQuestion.id]?.startsWith("OTHER:") && (
                        <input
                          value={answers[currentQuestion.id].slice(6)}
                          onChange={(e) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [currentQuestion.id]: `OTHER:${e.target.value}`,
                            }))
                          }
                          placeholder="Type your answer..."
                          className="w-full rounded-[22px] border border-brand-teal/30 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                        />
                      )}

                      <label
                        className={`flex cursor-pointer items-center gap-4 rounded-[24px] border px-4 py-4 transition md:px-5 ${
                          answers[currentQuestion.id] === "SKIP"
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-brand-gray-200/90 bg-white/92 text-brand-gray-500 hover:border-amber-200 hover:bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name={currentQuestion.id}
                          checked={answers[currentQuestion.id] === "SKIP"}
                          onChange={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [currentQuestion.id]: "SKIP",
                            }))
                          }
                        />
                        <div>
                          <p className="text-base font-semibold">Skip this question</p>
                          <p className="mt-1 text-sm opacity-80">
                            You can leave this signal out and keep moving.
                          </p>
                        </div>
                      </label>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="absolute right-0 top-1/2 hidden -translate-y-1/2 md:block">
                <ArrowNavButton
                  direction="right"
                  onClick={handleNext}
                  disabled={isLastPage || !canGoNext}
                  sideFloating
                />
              </div>
            </div>
          </div>
        )}
        {error && <p className="mt-6 text-sm text-rose-500 text-center">{error}</p>}
      </div>
      </main>
    </div>
  );
}

function ArrowNavButton({
  direction,
  onClick,
  disabled,
  sideFloating = false,
}: {
  direction: "left" | "right";
  onClick: () => void;
  disabled?: boolean;
  sideFloating?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Previous question" : "Next question"}
      className={`flex items-center justify-center border text-brand-gray-700 transition disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${
        sideFloating
          ? "h-20 w-14 rounded-[28px] border-white/75 bg-white/70 shadow-[0_18px_32px_rgba(97,163,184,0.18)] backdrop-blur hover:-translate-y-0.5 hover:bg-white/88"
          : "h-12 w-12 rounded-2xl border-white/80 bg-white/88 shadow-[0_12px_24px_rgba(97,163,184,0.12)] hover:-translate-y-0.5 hover:bg-white"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`${sideFloating ? "h-6 w-6" : "h-5 w-5"} ${direction === "right" ? "" : "rotate-180"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 5l8 7-8 7" />
      </svg>
    </button>
  );
}
