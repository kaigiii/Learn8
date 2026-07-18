"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import type { SubmissionResponse } from "@/lib/apiTypes";
import type { LessonStage } from "@/lib/apiTypes";
import { useI18n } from "@/lib/i18n/useI18n";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import { QuestionVoiceReader } from "@/features/lesson-session/components/QuestionVoiceReader";
import type { QuestionStageMeta } from "./questionSharedTypes";
import { Layers, HelpCircle, CheckCircle2, AlertCircle } from "lucide-react";

export interface Category {
  id: string;
  label: string;
  description?: string;
}

export interface Card {
  id: string;
  text: string;
  correctCategoryId: string;
}

export interface DynamicCategorySorterProps extends QuestionStageMeta {
  stage: LessonStage;
  title: string;
  categories: Category[];
  cards: Card[];
  instruction?: string;
  hints?: string[];
  onSubmit: (input: { completed: boolean; errorCount: number; wrongMatches: any[] }) => Promise<SubmissionResponse | void>;
  onContinue: () => void;
  onSkip: () => void;
}

export default function DynamicCategorySorter({
  stage,
  stageIndex,
  totalStages,
  stageLabel,
  topic,
  difficulty,
  recommendedDurationMinutes,
  title,
  categories,
  cards,
  instruction = "請將字卡分配到正確的箱子中。",
  hints = [],
  onSubmit,
  onContinue,
  onSkip,
}: DynamicCategorySorterProps) {
  const { t } = useI18n();

  // Initial random order
  const shuffledCards = useMemo(() => {
    return [...cards].sort(() => Math.random() - 0.5);
  }, [cards]);

  const [placedCards, setPlacedCards] = useState<Record<string, string>>({}); // cardId -> categoryId
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"editing" | "submitting" | "feedback">("editing");
  const [result, setResult] = useState<SubmissionResponse["result"] | null>(null);
  const [message, setMessage] = useState("");
  const [errorCount, setErrorCount] = useState(0);

  // Auto-select first card
  useEffect(() => {
    const unplaced = shuffledCards.find((c) => !placedCards[c.id]);
    if (unplaced) {
      setSelectedCardId(unplaced.id);
    } else {
      setSelectedCardId(null);
    }
  }, [placedCards, shuffledCards]);

  const handlePlaceCard = (categoryId: string) => {
    if (phase !== "editing" || !selectedCardId) return;
    setPlacedCards((prev) => ({
      ...prev,
      [selectedCardId]: categoryId,
    }));
  };

  const handleRemoveCard = (cardId: string) => {
    if (phase !== "editing") return;
    setPlacedCards((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
    setSelectedCardId(cardId);
  };

  const handleReset = () => {
    setPlacedCards({});
    setPhase("editing");
    setResult(null);
    setMessage("");
    setErrorCount(0);
    if (shuffledCards.length > 0) {
      setSelectedCardId(shuffledCards[0].id);
    }
  };

  const handleCheck = async () => {
    if (phase !== "editing") return;
    setPhase("submitting");

    let tempErrors = 0;
    const wrongMatches: any[] = [];

    cards.forEach((card) => {
      const placedCat = placedCards[card.id];
      if (placedCat !== card.correctCategoryId) {
        tempErrors++;
        wrongMatches.push({
          cardId: card.id,
          text: card.text,
          placedCategoryId: placedCat,
          correctCategoryId: card.correctCategoryId,
        });
      }
    });

    const isCorrect = tempErrors === 0;
    const response = await onSubmit({
      completed: true,
      errorCount: tempErrors,
      wrongMatches,
    });

    setResult(isCorrect ? "correct" : "incorrect");
    setErrorCount(tempErrors);
    setMessage(
      isCorrect
        ? "恭喜！所有卡片分類完全正確！"
        : `檢查完成！有 ${tempErrors} 張卡片分類錯誤。請重新調整。`
    );
    setPhase("feedback");
  };

  const allPlaced = shuffledCards.every((c) => placedCards[c.id]);
  const activeCard = shuffledCards.find((c) => c.id === selectedCardId);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 lesson-session-scroll">
        <QuestionStageHeader
          stageIndex={stageIndex}
          totalStages={totalStages}
          stageLabel={stageLabel}
          topic={topic}
          difficulty={difficulty}
          recommendedDurationMinutes={recommendedDurationMinutes}
          accentClassName="bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-teal-300/30"
          accentTextClassName="text-brand-teal"
          rightSlot={<QuestionVoiceReader text={topic} />}
        />

        <div className="mb-4 bg-slate-900/5 px-4 py-3 rounded-2xl border border-slate-100 flex items-start gap-2.5">
          <HelpCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-700">{title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{instruction}</p>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {categories.map((cat) => {
            const cardsInCat = shuffledCards.filter((c) => placedCards[c.id] === cat.id);
            const isTarget = phase === "editing" && selectedCardId;

            return (
              <div
                key={cat.id}
                onClick={() => handlePlaceCard(cat.id)}
                className={`rounded-[2rem] border-2 p-5 min-h-[160px] flex flex-col justify-between transition-all cursor-pointer ${
                  isTarget
                    ? "border-dashed border-brand-teal/40 bg-brand-teal/5 hover:bg-brand-teal/10 hover:border-brand-teal"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                    <span className="text-sm font-black text-slate-800">{cat.label}</span>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-500">
                      {cardsInCat.length} 張卡
                    </span>
                  </div>
                  {cat.description && (
                    <p className="text-xs text-slate-400 mb-3">{cat.description}</p>
                  )}

                  {/* Placed Cards list */}
                  <div className="flex flex-wrap gap-2">
                    {cardsInCat.map((card) => (
                      <motion.div
                        key={card.id}
                        layoutId={`card-${card.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCard(card.id);
                        }}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer flex items-center gap-1.5 shadow-sm transition-colors ${
                          phase === "feedback"
                            ? card.correctCategoryId === cat.id
                              ? "bg-brand-green/10 border-brand-green/30 text-brand-green"
                              : "bg-red-50 border-red-200 text-red-500"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span>{card.text}</span>
                        {phase === "editing" && (
                          <span className="text-[10px] text-slate-400 font-bold hover:text-red-500">×</span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Card Pile / Action Panel */}
        {phase === "editing" && (
          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 flex flex-col items-center justify-center min-h-[140px]">
            <AnimatePresence mode="wait">
              {activeCard ? (
                <motion.div
                  key={activeCard.id}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-5 shadow-md flex flex-col items-center gap-4 text-center"
                >
                  <span className="text-xs font-black text-brand-teal tracking-widest uppercase bg-brand-teal/10 px-2.5 py-1 rounded-md">
                    待分類字卡
                  </span>
                  <p className="text-base font-bold text-slate-800 px-2">{activeCard.text}</p>
                  <p className="text-[10px] text-slate-400">
                    請點選上方合適的分類箱，將此字卡拖入。
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <CheckCircle2 className="w-8 h-8 text-brand-green" />
                  <p className="text-sm font-bold text-slate-700">所有字卡已分配完畢！</p>
                  <p className="text-xs text-slate-400">可以點擊下方的「檢查答案」按鈕進行確認。</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Feedback Messages */}
        {phase === "feedback" && (
          <div
            className={`rounded-[2rem] p-5 flex items-start gap-3 border ${
              result === "correct"
                ? "bg-brand-green/5 border-brand-green/20 text-brand-green"
                : "bg-red-50 border-red-200 text-red-500"
            }`}
          >
            {result === "correct" ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-brand-green" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
            )}
            <div>
              <p className="text-sm font-bold">{message}</p>
              {result === "incorrect" && (
                <div className="mt-4 flex gap-3">
                  <GameButton variant="primary" onClick={handleReset} className="h-10 text-xs px-4">
                    重新挑戰
                  </GameButton>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <QuestionActionBar
        onSkip={onSkip}
        onContinue={
          phase === "feedback" && result === "correct"
            ? onContinue
            : phase === "editing" && allPlaced
            ? handleCheck
            : undefined
        }
        continueLabel={
          phase === "feedback" && result === "correct"
            ? t("lesson.action.continue")
            : "檢查答案"
        }
        isContinueDisabled={phase === "submitting" || (phase === "editing" && !allPlaced)}
      />
    </div>
  );
}
