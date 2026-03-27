"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import type { MatchPair } from "@/features/arena/hooks/useMatchingPairsStage";
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
  shuffledRight: string[];
  matched: string[];
  selectedLeft: string | null;
  selectedRight: string | null;
  wrongPair: [string, string] | null;
  hintPair: string | null;
  hintUsed: boolean;
  allMatched: boolean;
  onPickLeft: (word: string) => void;
  onPickRight: (word: string) => void;
  onHint: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}

export default function MatchingPairsQuestion({
  stageIndex,
  totalStages,
  topic,
  question,
  pairs,
  shuffledRight,
  matched,
  selectedLeft,
  selectedRight,
  wrongPair,
  hintPair,
  hintUsed,
  allMatched,
  onPickLeft,
  onPickRight,
  onHint,
  onSubmit,
  onSkip,
}: MatchingPairsQuestionProps) {
  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 arena-scroll">
        <QuestionStageHeader
          stageIndex={stageIndex}
          totalStages={totalStages}
          topic={question || topic}
          accentClassName="bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-teal-300/30"
          accentTextClassName="text-brand-teal"
        />

        <div className="flex">
          <MatchGrid
            pairs={pairs}
            shuffledRight={shuffledRight}
            matched={matched}
            selectedLeft={selectedLeft}
            selectedRight={selectedRight}
            wrongPair={wrongPair}
            hintPair={hintPair}
            onPickLeft={onPickLeft}
            onPickRight={onPickRight}
          />
        </div>
      </div>

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
    </>
  );
}

function MatchGrid({
  pairs,
  shuffledRight,
  matched,
  selectedLeft,
  selectedRight,
  wrongPair,
  hintPair,
  onPickLeft,
  onPickRight,
}: {
  pairs: MatchPair[];
  shuffledRight: string[];
  matched: string[];
  selectedLeft: string | null;
  selectedRight: string | null;
  wrongPair: [string, string] | null;
  hintPair: string | null;
  onPickLeft: (word: string) => void;
  onPickRight: (word: string) => void;
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

    for (const pair of pairs) {
      if (!matched.includes(pair.left)) continue;
      const leftElement = leftRefs.current.get(pair.left);
      const rightElement = rightRefs.current.get(pair.right);
      if (!leftElement || !rightElement) continue;

      const leftBox = leftElement.getBoundingClientRect();
      const rightBox = rightElement.getBoundingClientRect();
      nextLines.push({
        x1: leftBox.right - box.left,
        y1: leftBox.top + leftBox.height / 2 - box.top,
        x2: rightBox.left - box.left,
        y2: rightBox.top + rightBox.height / 2 - box.top,
        color: "#58CC02",
      });
    }

    if (selectedLeft && selectedRight) {
      const leftElement = leftRefs.current.get(selectedLeft);
      const rightElement = rightRefs.current.get(selectedRight);
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
  }, [matched, pairs, selectedLeft, selectedRight]);

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
          const isMatched = matched.includes(pair.left);
          const isSelected = selectedLeft === pair.left;
          const isWrong = wrongPair?.[0] === pair.left;
          const isHint = hintPair === pair.left;

          return (
            <motion.button
              key={pair.left}
              ref={(element) => {
                if (element) leftRefs.current.set(pair.left, element);
              }}
              onClick={() => onPickLeft(pair.left)}
              className={`relative rounded-2xl border-2 border-b-4 px-8 py-6 text-center font-heading text-xl font-bold transition-all ${
                isMatched
                  ? "border-brand-green bg-brand-green/10 text-brand-green"
                  : isWrong
                    ? "animate-shake border-red-400 bg-red-50 text-red-500"
                    : isHint
                      ? "border-amber-400 bg-amber-50 text-amber-600"
                      : isSelected
                        ? "border-brand-teal bg-brand-teal/10 text-brand-teal shadow-md"
                        : "border-brand-gray-200 bg-white text-brand-gray-700 hover:border-brand-teal/40"
              }`}
              whileTap={isMatched ? {} : { scale: 0.95 }}
            >
              {pair.left}
              {isMatched && (
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
        {shuffledRight.map((word) => {
          const pair = pairs.find((item) => item.right === word);
          const isMatched = pair ? matched.includes(pair.left) : false;
          const isSelected = selectedRight === word;
          const isWrong = wrongPair?.[1] === word;

          return (
            <motion.button
              key={word}
              ref={(element) => {
                if (element) rightRefs.current.set(word, element);
              }}
              onClick={() => onPickRight(word)}
              className={`relative rounded-2xl border-2 border-b-4 px-8 py-6 text-center font-heading text-xl font-bold transition-all ${
                isMatched
                  ? "border-brand-green bg-brand-green/10 text-brand-green"
                  : isWrong
                    ? "animate-shake border-red-400 bg-red-50 text-red-500"
                    : isSelected
                      ? "border-brand-teal bg-brand-teal/10 text-brand-teal shadow-md"
                      : "border-brand-gray-200 bg-white text-brand-gray-700 hover:border-brand-teal/40"
              }`}
              whileTap={isMatched ? {} : { scale: 0.95 }}
            >
              {word}
              {isMatched && (
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
    <svg viewBox="0 0 80 80" className="h-14 w-14 flex-shrink-0" fill="none">
      <ellipse cx="40" cy="52" rx="22" ry="20" fill="#E8A855" />
      <ellipse cx="40" cy="54" rx="16" ry="14" fill="#F5DEB3" />
      <circle cx="32" cy="40" r="9" fill="white" />
      <circle cx="48" cy="40" r="9" fill="white" />
      <circle cx="33" cy="40" r="5" fill="#2D2D2D" />
      <circle cx="47" cy="40" r="5" fill="#2D2D2D" />
      <circle cx="34.5" cy="38.5" r="1.8" fill="white" />
      <circle cx="48.5" cy="38.5" r="1.8" fill="white" />
      <polygon points="40,44 37,48 43,48" fill="#E8734A" />
      <polygon points="22,30 26,38 18,36" fill="#D4943D" />
      <polygon points="58,30 54,38 62,36" fill="#D4943D" />
      <ellipse cx="33" cy="72" rx="5" ry="3" fill="#E8734A" />
      <ellipse cx="47" cy="72" rx="5" ry="3" fill="#E8734A" />
    </svg>
  );
}
