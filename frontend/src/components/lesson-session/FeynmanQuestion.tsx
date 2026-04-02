"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import type {
  QuestionCommonActions,
  QuestionFeedbackMessages,
  QuestionStageMeta,
  QuestionSubmitResponse,
} from "./questionSharedTypes";

/* ═══════════════════ Types ═══════════════════ */

export interface FeynmanQuestionProps
  extends QuestionStageMeta,
    QuestionCommonActions {
  prompt: string;                     // the teacher's question
  sampleAnswer: string;              // expected key idea (shown after)
  feedbackMsg: QuestionFeedbackMessages;
  onSubmit: (answer: string) => Promise<QuestionSubmitResponse | void>;
  onContinue: () => void;
  onError?: () => void;
  onHintUse: () => Promise<boolean>;
}

/* ═══════════════════ Owl Teacher ═══════════════════ */

function OwlTeacher() {
  return (
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-lg flex-shrink-0">
      <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
        <ellipse cx="20" cy="24" rx="12" ry="10" fill="#C47F17" />
        <circle cx="15" cy="20" r="5" fill="white" />
        <circle cx="25" cy="20" r="5" fill="white" />
        <circle cx="15" cy="20" r="2.5" fill="#2D2D2D" />
        <circle cx="25" cy="20" r="2.5" fill="#2D2D2D" />
        <circle cx="16" cy="19" r="1" fill="white" />
        <circle cx="26" cy="19" r="1" fill="white" />
        <polygon points="20,22 18,25 22,25" fill="#FF9500" />
        <polygon points="10,16 8,8 15,14" fill="#C47F17" />
        <polygon points="30,16 32,8 25,14" fill="#C47F17" />
      </svg>
    </div>
  );
}

/* ═══════════════════ Component ═══════════════════ */

export default function FeynmanQuestion({
  stageIndex,
  totalStages,
  stageLabel,
  topic,
  prompt,
  sampleAnswer,
  feedbackMsg,
  onSubmit,
  onSkip,
  onContinue,
  onHintUse,
}: FeynmanQuestionProps) {
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<"writing" | "processing" | "feedback">("writing");
  const [hintUsed, setHintUsed] = useState(false);
  const [serverFeedback, setServerFeedback] = useState("");
  const [submissionResult, setSubmissionResult] = useState<"correct" | "incorrect" | "skipped" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (answer.trim().length < 5 || phase !== "writing") return;
    setPhase("processing");
    try {
      const result = await onSubmit(answer.trim());
      setServerFeedback(result?.feedback || "");
      setSubmissionResult(result?.result || null);
      setPhase("feedback");
    } catch {
      setPhase("writing");
    }
  }, [answer, onSubmit, phase]);

  const handleComplete = useCallback(() => {
    onContinue();
  }, [onContinue]);

  const handleHint = useCallback(async () => {
    if (hintUsed) return;
    const canAfford = await onHintUse();
    if (!canAfford) return;
    setHintUsed(true);
  }, [hintUsed, onHintUse]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 lesson-session-scroll">
        <QuestionStageHeader
          stageIndex={stageIndex}
          totalStages={totalStages}
          stageLabel={stageLabel}
          topic={topic}
          accentClassName="bg-gradient-to-br from-purple-500 to-purple-600 shadow-purple-300/30"
          accentTextClassName="text-purple-500"
          subtitle="— Teach Back"
        />

        {/* Teacher asks */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-5 flex items-start gap-4"
        >
          <OwlTeacher />
          <div className="flex-1 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 shadow-sm px-5 py-4">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">🦉 Professor Owl asks:</p>
            <p className="text-base font-semibold text-brand-gray-700 leading-relaxed">{prompt}</p>
          </div>
        </motion.div>

        {/* Hint area */}
        {hintUsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-4 rounded-xl bg-amber-50/80 border border-amber-200/50 px-4 py-3"
          >
            <p className="text-xs font-bold text-amber-500 mb-1">💡 Key idea to mention:</p>
            <p className="text-sm text-amber-700">{feedbackMsg.hint}</p>
          </motion.div>
        )}

        {/* Student answer area */}
        <AnimatePresence mode="wait">
          {phase === "writing" && (
            <motion.div
              key="writing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4"
            >
              <label className="block text-sm font-bold text-brand-gray-500 mb-2">
                ✏️ Your explanation:
              </label>
              <textarea
                ref={textareaRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Explain in your own words..."
                rows={5}
                className="w-full rounded-2xl bg-white/80 border-2 border-brand-gray-200 px-5 py-4 text-sm text-brand-gray-700 placeholder-brand-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-300/40 focus:border-purple-400/60 resize-none"
              />
              <p className="mt-1 text-xs text-brand-gray-400">
                {answer.trim().length < 5 ? `Write at least 5 characters (${answer.trim().length}/5)` : "Ready to submit!"}
              </p>
            </motion.div>
          )}

          {phase === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-4 rounded-2xl bg-white/70 backdrop-blur border border-purple-200/50 shadow-sm px-6 py-8 flex flex-col items-center gap-4"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 rounded-full border-3 border-purple-200 border-t-purple-500"
                  style={{ borderWidth: 3 }}
                />
                <p className="text-sm font-bold text-purple-600">Professor Owl is reviewing your answer...</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                    className="w-2 h-2 rounded-full bg-purple-400"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {phase === "feedback" && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 mb-4"
            >
              {/* Student answer (collapsed) */}
              <div className="rounded-2xl bg-brand-teal/5 border border-brand-teal/20 px-5 py-3">
                <p className="text-xs font-bold text-brand-teal uppercase tracking-wider mb-1">Your answer:</p>
                <p className="text-sm text-brand-gray-600 leading-relaxed">{answer}</p>
              </div>

              {/* Teacher feedback */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-start gap-4"
              >
                <OwlTeacher />
                <div className="flex-1 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200/60 shadow-sm px-5 py-4">
                  <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">🦉 Professor Owl&apos;s feedback:</p>
                  <p className="text-sm text-brand-gray-700 leading-relaxed">
                    {serverFeedback || (submissionResult === "correct" ? feedbackMsg.success : feedbackMsg.error)}
                  </p>
                </div>
              </motion.div>

              {/* Sample answer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="rounded-2xl bg-purple-50/60 border border-purple-200/40 px-5 py-3"
              >
                <p className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-1">📖 Model answer:</p>
                <p className="text-sm text-brand-gray-600 leading-relaxed">{sampleAnswer}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <QuestionActionBar
        leftSlot={
          phase === "writing" ? (
            <button
              onClick={() => void handleHint()}
              disabled={hintUsed}
              className={`mb-1 flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                hintUsed
                  ? "cursor-not-allowed border-brand-gray-200 bg-brand-gray-100 text-brand-gray-400"
                  : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
              }`}
            >
              💡 Hint <span className="text-[10px] opacity-60">(10 💎)</span>
            </button>
          ) : null
        }
        rightSlot={
          phase === "writing" ? (
            <>
              <GameButton
                variant="secondary"
                onClick={() => onSkip?.()}
                className="min-w-[120px]"
              >
                SKIP
              </GameButton>
              <GameButton
                variant="primary"
                onClick={handleSubmit}
                disabled={answer.trim().length < 5}
                className="min-w-[140px]"
              >
                SUBMIT
              </GameButton>
            </>
          ) : phase === "feedback" ? (
            <GameButton
              variant="primary"
              onClick={handleComplete}
              className="min-w-[140px]"
            >
              CONTINUE
            </GameButton>
          ) : null
        }
      />
    </div>
  );
}
