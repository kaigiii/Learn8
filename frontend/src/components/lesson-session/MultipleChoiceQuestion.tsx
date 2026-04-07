"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import type {
  QuestionCommonActions,
  QuestionFeedbackMessages,
  QuestionStageMeta,
} from "./questionSharedTypes";

/* ═══════════════════ Types ═══════════════════ */

export interface MultipleChoiceQuestionProps
  extends QuestionStageMeta,
    QuestionCommonActions {
  question: string;
  options: { id: string; text: string }[];
  correctId: string;
  feedbackMsg: QuestionFeedbackMessages;
  onComplete: (selectedOptionId: string) => void;
  onError?: (selectedOptionId: string) => void;
  onCorrectAdvance?: () => void;
  onWrongAdvance?: () => void;
  onHintUse: () => Promise<boolean>;
}

/* ═══════════════════ Owl ═══════════════════ */

function OwlMascotSmall() {
  return (
    <svg viewBox="0 0 40 44" className="w-12 h-14 flex-shrink-0">
      <ellipse cx="20" cy="32" rx="14" ry="12" fill="#C47F17" />
      <ellipse cx="20" cy="30" rx="14" ry="12" fill="#E8A817" />
      <circle cx="14" cy="26" r="6" fill="white" />
      <circle cx="26" cy="26" r="6" fill="white" />
      <circle cx="14" cy="26" r="3" fill="#2D2D2D" />
      <circle cx="26" cy="26" r="3" fill="#2D2D2D" />
      <circle cx="15" cy="25" r="1.2" fill="white" />
      <circle cx="27" cy="25" r="1.2" fill="white" />
      <polygon points="20,28 18,31 22,31" fill="#FF9500" />
      <path d="M6,20 Q4,8 14,16" fill="#C47F17" />
      <path d="M34,20 Q36,8 26,16" fill="#C47F17" />
    </svg>
  );
}

/* ═══════════════════ Component ═══════════════════ */

export default function MultipleChoiceQuestion({
  stageIndex,
  totalStages,
  stageLabel,
  topic,
  difficulty,
  recommendedDurationMinutes,
  question,
  options,
  correctId,
  feedbackMsg,
  onComplete,
  onError,
  onCorrectAdvance,
  onWrongAdvance,
  onSkip,
  onHintUse,
}: MultipleChoiceQuestionProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [hintUsed, setHintUsed] = useState(false);

  const handleCheck = useCallback(() => {
    if (!selected || result === "correct") return;
    if (selected === correctId) {
      setResult("correct");
      onComplete(selected);
    } else {
      setResult("wrong");
      onError?.(selected);
    }
  }, [selected, correctId, onComplete, onError, result, onWrongAdvance]);

  const handleHint = useCallback(async () => {
    if (hintUsed) return;
    const canAfford = await onHintUse();
    if (!canAfford) return;
    setHintUsed(true);
    // Eliminate two wrong options
    const wrongOptions = options.filter((o) => o.id !== correctId && !eliminated.includes(o.id));
    const toEliminate = wrongOptions.slice(0, 2).map((o) => o.id);
    setEliminated(toEliminate);
  }, [hintUsed, onHintUse, options, correctId, eliminated]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 lesson-session-scroll">
        <QuestionStageHeader
          stageIndex={stageIndex}
          totalStages={totalStages}
          stageLabel={stageLabel}
          topic={topic}
          difficulty={difficulty}
          recommendedDurationMinutes={recommendedDurationMinutes}
          accentClassName="bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-teal-300/30"
          accentTextClassName="text-brand-teal"
        />

        {/* Question */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm px-6 py-5"
        >
          <p className="text-base font-semibold text-brand-gray-700 leading-relaxed">{question}</p>
        </motion.div>

        {/* Options */}
        <div className="grid grid-cols-1 gap-3 max-w-lg">
          {options.map((opt, i) => {
            const isEliminated = eliminated.includes(opt.id);
            const isSelected = selected === opt.id;
            const isCorrectAnswer = opt.id === correctId;
            const showCorrect = (result === "correct" && isCorrectAnswer) || (result === "wrong" && isCorrectAnswer);
            const showWrong = result === "wrong" && isSelected && !isCorrectAnswer;

            return (
              <motion.button
                key={opt.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: isEliminated ? 0.35 : 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => {
                  if (isEliminated || result) return;
                  setSelected(opt.id);
                }}
                disabled={isEliminated || !!result}
                className={`relative text-left rounded-2xl px-5 py-4 border-2 border-b-4 font-heading font-bold text-base transition-all ${
                  showCorrect
                    ? "bg-brand-green/10 border-brand-green text-green-700"
                    : showWrong
                    ? "bg-red-50 border-red-400 text-red-500 animate-shake"
                    : isSelected
                    ? "bg-brand-teal/10 border-brand-teal text-brand-teal shadow-md"
                    : isEliminated
                    ? "bg-brand-gray-100 border-brand-gray-200 text-brand-gray-300 cursor-not-allowed line-through"
                    : "bg-white border-brand-gray-200 text-brand-gray-700 hover:border-brand-teal/40"
                }`}
              >
                <span className="mr-3 inline-flex items-center justify-center w-7 h-7 rounded-full border-2 text-sm font-extrabold flex-shrink-0 {isSelected ? 'border-brand-teal bg-brand-teal/10' : 'border-brand-gray-300'}">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt.text}
                {showCorrect && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-brand-green rounded-full flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Feedback message */}
        {result === "wrong" && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-red-500 font-medium">
            {feedbackMsg.error}
          </motion.p>
        )}
      </div>

      {/* Bottom bar */}
      <QuestionActionBar
        leftSlot={
          <>
            <OwlMascotSmall />
            <button
              onClick={() => void handleHint()}
              disabled={hintUsed || !!result}
              className={`mb-1 flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                hintUsed
                  ? "cursor-not-allowed border-brand-gray-200 bg-brand-gray-100 text-brand-gray-400"
                  : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
              }`}
            >
              💡 Hint <span className="text-[10px] opacity-60">(10 💎)</span>
            </button>
          </>
        }
        rightSlot={
          result === "correct" ? (
            <GameButton
              variant="primary"
              onClick={() => onCorrectAdvance?.()}
              className="min-w-[140px]"
            >
              CONTINUE
            </GameButton>
          ) : result === "wrong" ? (
            <GameButton
              variant="primary"
              onClick={() => onWrongAdvance?.()}
              className="min-w-[140px]"
            >
              GOT IT
            </GameButton>
          ) : (
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
                onClick={handleCheck}
                disabled={!selected || result === "correct"}
                className="min-w-[140px]"
              >
                CHECK
              </GameButton>
            </>
          )
        }
      />
    </div>
  );
}
