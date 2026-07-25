"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import { HintButton } from "./HintButton";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import { QuestionVoiceReader } from "@/features/lesson-session/components/QuestionVoiceReader";
import { useI18n } from "@/lib/i18n/useI18n";
import { AlertCircle } from "lucide-react";
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
  onSelect?: (id: string) => void;
  onHintUse: () => Promise<boolean>;
  hideChrome?: boolean;
  forceCorrectId?: string;
  userSelectedId?: string;
  isLocked?: boolean;
}

/* ═══════════════════ Owl ═══════════════════ */

function OwlMascotSmall() {
  return (
    <Image
      src="/icons/full_icon.ico"
      alt="Lesson mascot"
      width={56}
      height={56}
      className="h-14 w-12 flex-shrink-0 object-contain"
      priority
    />
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
  onSelect,
  onSkip,
  onHintUse,
  hideChrome = false,
  forceCorrectId,
  userSelectedId,
  isLocked = false,
}: MultipleChoiceQuestionProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [hintUsed, setHintUsed] = useState(false);

  const handleCheck = useCallback(() => {
    if (!selected || result === "correct" || isLocked) return;
    if (selected === correctId) {
      setResult("correct");
      onComplete(selected);
    } else {
      setResult("wrong");
      onError?.(selected);
    }
  }, [selected, correctId, onComplete, onError, result, onWrongAdvance, isLocked]);

  const handleHint = useCallback(async () => {
    if (hintUsed || isLocked) return;
    const canAfford = await onHintUse();
    if (!canAfford) return;
    setHintUsed(true);
    // Eliminate two wrong options
    const wrongOptions = options.filter((o) => o.id !== correctId && !eliminated.includes(o.id));
    const toEliminate = wrongOptions.slice(0, 2).map((o) => o.id);
    setEliminated(toEliminate);
  }, [hintUsed, onHintUse, options, correctId, eliminated, isLocked]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className={`flex-1 overflow-y-auto min-h-0 pr-1 ${!hideChrome ? "lesson-session-scroll" : ""}`}>
        {!hideChrome && (
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
        )}

        {/* Question */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="mb-6 rounded-2xl bg-white/70 backdrop-blur border border-white/60 shadow-sm px-6 py-5 flex items-start justify-between gap-4"
        >
          <p className="text-base font-semibold text-brand-gray-700 leading-relaxed">{question}</p>
          <QuestionVoiceReader text={question} />
        </motion.div>

        {/* Options */}
        <div className="grid w-full grid-cols-1 gap-3">
          {options.map((opt, i) => {
            const isEliminated = eliminated.includes(opt.id);
            const isSelected = selected === opt.id;
            const isCorrectAnswer = opt.id === correctId;
            const isCorrectAnswerForReveal = forceCorrectId && opt.id === forceCorrectId;
            const isUserSelection = userSelectedId ? (userSelectedId === opt.id) : isSelected;
            const isUnansweredTimeout = isCorrectAnswerForReveal && userSelectedId === undefined;
            const showCorrect = (result === "correct" && isCorrectAnswer) || (result === "wrong" && isCorrectAnswer) || (forceCorrectId === opt.id && !isUnansweredTimeout);
            const showWrong = (result === "wrong" && isSelected && !isCorrectAnswer) || (forceCorrectId && isUserSelection && forceCorrectId !== opt.id) || isUnansweredTimeout;

            return (
              <motion.button
                key={opt.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: isEliminated ? 0.35 : 1 }}
                transition={{ duration: 0.12 }}
                onClick={() => {
                  if (isEliminated || result || isLocked) return;
                  setSelected(opt.id);
                  onSelect?.(opt.id);
                }}
                disabled={isEliminated || !!result || isLocked}
                className={`relative text-left rounded-2xl px-5 py-4 border-2 border-b-4 font-heading font-bold text-base transition-all flex items-center justify-between gap-2 ${
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
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className={`mr-3 inline-flex items-center justify-center w-7 h-7 rounded-full border-2 text-sm font-extrabold flex-shrink-0 ${isUserSelection ? 'border-brand-teal bg-brand-teal/10' : 'border-brand-gray-300'}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1 break-words">{opt.text}</span>
                </div>
                <QuestionVoiceReader text={opt.text} mini />
                {showCorrect && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-brand-green rounded-full flex items-center justify-center shadow-md">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>
                  </motion.span>
                )}
                {!showCorrect && showWrong && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -top-1.5 -right-1.5 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center shadow-md">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="4"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Feedback message */}
        {result === "wrong" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-[2rem] p-5 flex items-start gap-3 border border-brand-coral/20 bg-brand-coral/5 text-brand-coral shadow-sm animate-shake"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-brand-coral" />
            <div>
              <p className="text-sm font-bold">{feedbackMsg.error}</p>
            </div>
          </motion.div>
        )}
      </div>

      {!hideChrome && (
        <QuestionActionBar
          onSkip={onSkip}
          leftSlot={
            <HintButton
              onClick={() => void handleHint()}
              disabled={hintUsed || !!result || isLocked}
            />
          }
          onContinue={
            result === "correct" 
              ? onCorrectAdvance 
              : result === "wrong" 
              ? onWrongAdvance 
              : handleCheck
          }
          continueLabel={
            result === "correct" 
              ? t("lesson.action.continue") 
              : result === "wrong" 
              ? t("lesson.action.gotIt") 
              : t("lesson.action.check")
          }
          isContinueDisabled={(!selected && !result) || isLocked}
        />
      )}
    </div>
  );
}
