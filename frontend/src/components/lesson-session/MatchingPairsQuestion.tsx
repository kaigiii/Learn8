"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import type { MatchPair } from "@/features/lesson-session/hooks/useMatchingPairsStage";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import type {
  QuestionCommonActions,
  QuestionStageMeta,
} from "./questionSharedTypes";

export interface MatchingPairsQuestionProps
  extends QuestionStageMeta,
    QuestionCommonActions {
  question: string;
  pairs: MatchPair[];
  shuffledRightIds: string[];
  matched: string[];
  matchedPairs: Record<string, string>;
  selectedLeftId: string | null;
  selectedRightId: string | null;
  wrongPair: [string, string] | null;
  hintPairId: string | null;
  hintUsed: boolean;
  allMatched: boolean;
  feedback: "correct" | "incorrect" | null;
  onPickLeft: (pairId: string) => void;
  onPickRight: (pairId: string) => void;
  onHint: () => void;
  onSubmit: () => void;
  onSkip: () => void;
  hideChrome?: boolean;
}

export default function MatchingPairsQuestion({
  stageIndex,
  totalStages,
  stageLabel,
  topic,
  difficulty,
  recommendedDurationMinutes,
  question,
  pairs,
  shuffledRightIds,
  matched,
  matchedPairs,
  selectedLeftId,
  selectedRightId,
  wrongPair,
  hintPairId,
  hintUsed,
  allMatched,
  feedback,
  onPickLeft,
  onPickRight,
  onHint,
  onSubmit,
  onSkip,
  hideChrome = false,
}: MatchingPairsQuestionProps) {
  return (
    <>
      <div className={`flex-1 min-h-0 overflow-y-auto pr-1 ${!hideChrome ? "lesson-session-scroll" : ""}`}>
        {!hideChrome && (
          <QuestionStageHeader
            stageIndex={stageIndex}
            totalStages={totalStages}
            stageLabel={stageLabel}
            topic={question || topic}
            difficulty={difficulty}
            recommendedDurationMinutes={recommendedDurationMinutes}
            accentClassName="bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-teal-300/30"
            accentTextClassName="text-brand-teal"
          />
        )}

        <div className="flex">
          <MatchGrid
            pairs={pairs}
            shuffledRightIds={shuffledRightIds}
            matched={matched}
            matchedPairs={matchedPairs}
            selectedLeftId={selectedLeftId}
            selectedRightId={selectedRightId}
            wrongPair={wrongPair}
            hintPairId={hintPairId}
            feedback={feedback}
            onPickLeft={onPickLeft}
            onPickRight={onPickRight}
          />
        </div>
      </div>
      {!hideChrome && (
        <QuestionActionBar
          leftSlot={
            <>
              <OwlMascot />
              <button
                onClick={onHint}
                disabled={hintUsed || allMatched}
                className={`mb-1 flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  hintUsed
                    ? "cursor-not-allowed border-brand-gray-200 bg-brand-gray-100 text-brand-gray-400"
                    : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                }`}
              >
                💡 Hint
                <span className="text-[10px] opacity-60">(10 💎)</span>
              </button>
            </>
          }
          rightSlot={
            <>
              <GameButton variant="secondary" onClick={onSkip} className="min-w-[120px]">
                SKIP
              </GameButton>
              <GameButton
                variant="primary"
                onClick={onSubmit}
                disabled={!allMatched}
                className="min-w-[140px]"
              >
                SUBMIT
              </GameButton>
            </>
          }
        />
      )}
    </>
  );
}

function MatchGrid({
  pairs,
  shuffledRightIds,
  matched,
  matchedPairs,
  selectedLeftId,
  selectedRightId,
  wrongPair,
  hintPairId,
  feedback,
  onPickLeft,
  onPickRight,
}: {
  pairs: MatchPair[];
  shuffledRightIds: string[];
  matched: string[];
  matchedPairs: Record<string, string>;
  selectedLeftId: string | null;
  selectedRightId: string | null;
  wrongPair: [string, string] | null;
  hintPairId: string | null;
  feedback: "correct" | "incorrect" | null;
  onPickLeft: (pairId: string) => void;
  onPickRight: (pairId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const rightRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [lines, setLines] = useState<
    { x1: number; y1: number; x2: number; y2: number; color: string; dash?: boolean }[]
  >([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const box = container.getBoundingClientRect();
    const nextLines: typeof lines = [];

    for (const [leftId, rightId] of Object.entries(matchedPairs)) {
      if (selectedLeftId === leftId || selectedRightId === rightId) {
        continue;
      }
      const leftElement = leftRefs.current.get(leftId);
      const rightElement = rightRefs.current.get(rightId);
      if (!leftElement || !rightElement) continue;

      const leftBox = leftElement.getBoundingClientRect();
      const rightBox = rightElement.getBoundingClientRect();
      nextLines.push({
        x1: leftBox.right - box.left,
        y1: leftBox.top + leftBox.height / 2 - box.top,
        x2: rightBox.left - box.left,
        y2: rightBox.top + rightBox.height / 2 - box.top,
        color: feedback === "correct" ? "#58CC02" : "#7AC7C4",
      });
    }

    if (selectedLeftId && selectedRightId) {
      const leftElement = leftRefs.current.get(selectedLeftId);
      const rightElement = rightRefs.current.get(selectedRightId);
      if (leftElement && rightElement) {
        const leftBox = leftElement.getBoundingClientRect();
        const rightBox = rightElement.getBoundingClientRect();
        nextLines.push({
          x1: leftBox.right - box.left,
          y1: leftBox.top + leftBox.height / 2 - box.top,
          x2: rightBox.left - box.left,
          y2: rightBox.top + rightBox.height / 2 - box.top,
          color: "#7AC7C4",
          dash: true,
        });
      }
    }

    setLines(nextLines);
  }, [feedback, matchedPairs, selectedLeftId, selectedRightId]);

  const assignedRights = new Set(Object.values(matchedPairs));
  const pairById = new Map(pairs.map((pair) => [pair.id, pair]));

  return (
    <div ref={containerRef} className="relative mx-auto flex w-full gap-12">
      <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
        {lines.map((line, index) => (
          <line
            key={index}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={line.dash ? "6 4" : "none"}
          />
        ))}
      </svg>

      <div className="flex flex-1 flex-col gap-5">
        {pairs.map((pair) => {
          const isMatched = matched.includes(pair.id);
          const isAssigned = pair.id in matchedPairs;
          const isSelected = selectedLeftId === pair.id;
          const isWrong = wrongPair?.[0] === pair.id;
          const isHint = hintPairId === pair.id;

          return (
            <motion.button
              key={pair.id}
              ref={(element) => {
                if (element) leftRefs.current.set(pair.id, element);
              }}
              onClick={() => onPickLeft(pair.id)}
              className={`relative rounded-2xl border-2 border-b-4 px-8 py-6 text-center font-heading text-xl font-bold transition-all ${
                isMatched && feedback === "correct"
                  ? "border-brand-green bg-brand-green/10 text-brand-green"
                  : isWrong
                    ? "animate-shake border-red-400 bg-red-50 text-red-500"
                    : isSelected
                      ? "border-brand-teal bg-brand-teal/10 text-brand-teal shadow-md"
                    : isHint
                      ? "border-amber-400 bg-amber-50 text-amber-600"
                      : isAssigned
                        ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                        : "border-brand-gray-200 bg-white text-brand-gray-700 hover:border-brand-teal/40"
              }`}
              whileTap={isMatched && feedback === "correct" ? {} : { scale: 0.95 }}
            >
              {pair.left}
              {isMatched && feedback === "correct" && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-green"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col gap-5">
        {shuffledRightIds.map((pairId) => {
          const pair = pairById.get(pairId);
          if (!pair) {
            return null;
          }

          const isMatched = matched.includes(pairId);
          const isAssigned = assignedRights.has(pairId);
          const isSelected = selectedRightId === pairId;
          const isWrong = wrongPair?.[1] === pairId;

          return (
            <motion.button
              key={pair.id}
              ref={(element) => {
                if (element) rightRefs.current.set(pair.id, element);
              }}
              onClick={() => onPickRight(pair.id)}
              className={`relative rounded-2xl border-2 border-b-4 px-8 py-6 text-center font-heading text-xl font-bold transition-all ${
                isMatched && feedback === "correct"
                  ? "border-brand-green bg-brand-green/10 text-brand-green"
                  : isWrong
                    ? "animate-shake border-red-400 bg-red-50 text-red-500"
                    : isSelected
                      ? "border-brand-teal bg-brand-teal/10 text-brand-teal shadow-md"
                    : isAssigned
                      ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                      : "border-brand-gray-200 bg-white text-brand-gray-700 hover:border-brand-teal/40"
              }`}
              whileTap={isMatched && feedback === "correct" ? {} : { scale: 0.95 }}
            >
              {pair.right}
              {isMatched && feedback === "correct" && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-green"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function OwlMascot() {
  return (
    <Image
      src="/icons/full_icon.ico"
      alt="Lesson mascot"
      width={56}
      height={56}
      className="h-14 w-14 flex-shrink-0 object-contain"
      priority
    />
  );
}
