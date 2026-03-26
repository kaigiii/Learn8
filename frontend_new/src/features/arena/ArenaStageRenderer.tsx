"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, Reorder } from "framer-motion";
import dynamic from "next/dynamic";
import GameButton from "@/components/ui/GameButton";
import type { LessonStage } from "@/lib/apiTypes";
import type { MatchPair } from "./useMatchingPairsStage";

const MultipleChoice = dynamic(
  () => import("@/components/arena/MultipleChoice"),
  {
    loading: () => <StageComponentLoading />,
  }
);
const FeynmanPrompt = dynamic(() => import("@/components/arena/FeynmanPrompt"), {
  loading: () => <StageComponentLoading />,
});

interface MatchingStageViewModel {
  shuffledRight: string[];
  matched: string[];
  selectedLeft: string | null;
  selectedRight: string | null;
  wrongPair: [string, string] | null;
  hintPair: string | null;
  hintUsed: boolean;
  allMatched: boolean;
  pickLeft: (word: string) => void;
  pickRight: (word: string) => void;
  handleCheck: () => void;
  handleHint: () => void;
}

interface ArenaStageRendererProps {
  stage: LessonStage;
  stageIdx: number;
  totalStages: number;
  nodeDescription: string;
  matchPairs: MatchPair[];
  matchQuestion: string;
  matchingStage: MatchingStageViewModel;
  onSubmitStage: (stage: LessonStage, input: unknown, isCorrect: boolean) => void;
  onContinue: () => void;
  onHintUse: () => boolean;
}

export function ArenaStageRenderer({
  stage,
  stageIdx,
  totalStages,
  nodeDescription,
  matchPairs,
  matchQuestion,
  matchingStage,
  onSubmitStage,
  onContinue,
  onHintUse,
}: ArenaStageRendererProps) {
  if (stage.component === "MultipleChoice") {
    return (
      <MultipleChoice
        key={`backend-mcq-${stageIdx}`}
        stageIndex={stageIdx}
        totalStages={totalStages}
        topic={stage.topic}
        description={nodeDescription}
        question={String((stage.config.data as { question?: string }).question || stage.topic)}
        options={normalizeChoiceOptions(stage)}
        correctId={getCorrectOptionId(stage)}
        feedbackMsg={{
          success: stage.feedback.success,
          error: stage.feedback.error,
          hint: "Eliminate the least likely options first.",
        }}
        onComplete={() => void onSubmitStage(stage, getCorrectOptionId(stage), true)}
        onError={() => void onSubmitStage(stage, "incorrect", false)}
        onWrongAdvance={onContinue}
        onHintUse={onHintUse}
      />
    );
  }

  if (stage.component === "Ordering") {
    return (
      <BackendOrderingStage
        key={`backend-order-${stageIdx}`}
        stage={stage}
        stageIndex={stageIdx}
        totalStages={totalStages}
        onSubmit={(input, isCorrect) => void onSubmitStage(stage, input, isCorrect)}
      />
    );
  }

  if (stage.component === "FeynmanMirror") {
    return (
      <BackendFeynmanStage
        key={`backend-feynman-${stageIdx}`}
        stage={stage}
        stageIndex={stageIdx}
        totalStages={totalStages}
        onSubmit={(input) => void onSubmitStage(stage, input, false)}
        onHintUse={onHintUse}
      />
    );
  }

  if (stage.component === "MatchingPairs") {
    return (
      <>
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 arena-scroll">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 mb-6 flex items-center gap-4"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-md shadow-teal-300/30">
              <span className="font-heading text-base font-extrabold text-white">
                {stageIdx + 1}
              </span>
            </div>
            <div>
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-teal">
                Stage {stageIdx + 1} of {totalStages}
              </p>
              <h2 className="font-heading text-xl font-bold leading-snug text-brand-gray-700">
                {matchQuestion || stage.topic}
              </h2>
            </div>
          </motion.div>

          <div className="flex">
            <MatchGrid
              pairs={matchPairs}
              shuffledRight={matchingStage.shuffledRight}
              matched={matchingStage.matched}
              selectedLeft={matchingStage.selectedLeft}
              selectedRight={matchingStage.selectedRight}
              wrongPair={matchingStage.wrongPair}
              hintPair={matchingStage.hintPair}
              onPickLeft={matchingStage.pickLeft}
              onPickRight={matchingStage.pickRight}
            />
          </div>
        </div>

        <div className="relative flex flex-shrink-0 items-end justify-between pt-4 pb-6">
          <div className="flex items-end gap-2">
            <OwlMascot />
            <button
              onClick={matchingStage.handleHint}
              disabled={matchingStage.hintUsed || matchingStage.allMatched}
              className={`mb-1 flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                matchingStage.hintUsed
                  ? "cursor-not-allowed border-brand-gray-200 bg-brand-gray-100 text-brand-gray-400"
                  : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
              }`}
            >
              💡 Hint
              <span className="text-[10px] opacity-60">(10 💎)</span>
            </button>
          </div>

          <GameButton
            variant="primary"
            onClick={matchingStage.handleCheck}
            disabled={
              (!matchingStage.selectedLeft || !matchingStage.selectedRight) &&
              !matchingStage.allMatched
            }
            className="min-w-[140px]"
          >
            {matchingStage.allMatched ? "SUBMIT" : "CHECK"}
          </GameButton>
        </div>
      </>
    );
  }

  return (
    <FeynmanPrompt
      key={`backend-stage-${stageIdx}`}
      stageIndex={stageIdx}
      totalStages={totalStages}
      topic={stage.topic}
      description={nodeDescription}
      prompt={String((stage.config.data as { prompt?: string }).prompt || stage.topic)}
      sampleAnswer={String((stage.config.data as { sampleAnswer?: string }).sampleAnswer || "")}
      fixedFeedback={stage.feedback.success}
      feedbackMsg={{
        success: stage.feedback.success,
        error: stage.feedback.error,
        hint: "Explain the concept as if the listener knows none of the jargon.",
      }}
      onComplete={() =>
        void onSubmitStage(
          stage,
          String((stage.config.data as { prompt?: string }).prompt || stage.topic),
          false
        )
      }
      onHintUse={onHintUse}
    />
  );
}

function normalizeChoiceOptions(stage: LessonStage) {
  const rawOptions = Array.isArray(stage.config.data?.options)
    ? stage.config.data.options
    : [];

  return rawOptions.map((option, index) => {
    if (typeof option === "string") {
      return { id: `option-${index}`, text: option };
    }
    if (option && typeof option === "object") {
      const item = option as { id?: string; text?: string; label?: string };
      return {
        id: item.id || `option-${index}`,
        text: item.text || item.label || `Option ${index + 1}`,
      };
    }
    return { id: `option-${index}`, text: `Option ${index + 1}` };
  });
}

function getCorrectOptionId(stage: LessonStage) {
  const data = stage.config.data as {
    correctId?: string;
    correctOptionId?: string;
  };
  const validation = stage.validation.condition as {
    correctId?: string;
    correctOptionId?: string;
  };

  return (
    data.correctId ||
    data.correctOptionId ||
    validation.correctId ||
    validation.correctOptionId ||
    ""
  );
}

function BackendOrderingStage({
  stage,
  stageIndex,
  totalStages,
  onSubmit,
}: {
  stage: LessonStage;
  stageIndex: number;
  totalStages: number;
  onSubmit: (input: string[], isCorrect: boolean) => void;
}) {
  const getLabel = (step: unknown) => {
    if (typeof step === "string") return step;
    if (step && typeof step === "object") {
      const item = step as { text?: string; label?: string; content?: string; id?: string };
      return item.text || item.label || item.content || item.id || "Step";
    }
    return String(step);
  };

  const initialItems = useMemo(() => {
    const rawSteps = Array.isArray(stage.config.data?.steps)
      ? stage.config.data.steps
      : [];
    const seeded = Array.isArray(stage.config.initialState?.order)
      ? stage.config.initialState.order
      : [...rawSteps].sort(() => Math.random() - 0.5);

    return seeded.map((step, index) => ({
      id: `step-${index}`,
      content: getLabel(step),
    }));
  }, [stage]);

  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const correctOrder = useMemo(() => {
    const rawSteps = Array.isArray(stage.config.data?.steps)
      ? stage.config.data.steps
      : [];
    return rawSteps.map(getLabel);
  }, [stage]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 arena-scroll">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 mb-6 flex items-center gap-4"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-md shadow-teal-300/30">
            <span className="font-heading text-base font-extrabold text-white">
              {stageIndex + 1}
            </span>
          </div>
          <div>
            <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-teal">
              Stage {stageIndex + 1} of {totalStages}
            </p>
            <h2 className="font-heading text-xl font-bold leading-snug text-brand-gray-700">
              {stage.topic}
            </h2>
          </div>
        </motion.div>

        <Reorder.Group axis="y" values={items} onReorder={setItems} className="flex flex-col gap-3">
          {items.map((item) => (
            <Reorder.Item key={item.id} value={item}>
              <div className="rounded-2xl border-2 border-b-4 border-brand-gray-200 bg-white px-5 py-4 font-heading font-bold text-brand-gray-700 shadow-sm">
                {item.content}
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>

      <div className="relative flex flex-shrink-0 items-end justify-end pt-4 pb-6">
        <GameButton
          variant="primary"
          onClick={() => {
            const currentOrder = items.map((item) => item.content);
            onSubmit(
              currentOrder,
              JSON.stringify(currentOrder) === JSON.stringify(correctOrder)
            );
          }}
          className="min-w-[160px]"
        >
          CHECK ORDER
        </GameButton>
      </div>
    </div>
  );
}

function BackendFeynmanStage({
  stage,
  stageIndex,
  totalStages,
  onSubmit,
  onHintUse,
}: {
  stage: LessonStage;
  stageIndex: number;
  totalStages: number;
  onSubmit: (input: string) => void;
  onHintUse: () => boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [hintUsed, setHintUsed] = useState(false);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 arena-scroll">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 mb-6 flex items-center gap-4"
        >
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-md shadow-purple-300/30">
            <span className="font-heading text-base font-extrabold text-white">
              {stageIndex + 1}
            </span>
          </div>
          <div>
            <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-purple-500">
              Stage {stageIndex + 1} of {totalStages}
            </p>
            <h2 className="font-heading text-xl font-bold leading-snug text-brand-gray-700">
              {stage.topic}
            </h2>
          </div>
        </motion.div>

        <div className="rounded-2xl border border-white/60 bg-white/80 p-5 shadow-sm">
          <p className="text-sm font-semibold leading-relaxed text-brand-gray-700">
            {String((stage.config.data as { prompt?: string }).prompt || stage.topic)}
          </p>
          {hintUsed && (
            <p className="mt-3 text-sm text-amber-600">Hint: {stage.feedback.error}</p>
          )}
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Explain it in your own words..."
            rows={7}
            className="mt-4 w-full rounded-2xl border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
          />
        </div>
      </div>

      <div className="relative flex flex-shrink-0 items-end justify-between pt-4 pb-6">
        <button
          onClick={() => {
            if (hintUsed) return;
            const canAfford = onHintUse();
            if (canAfford) setHintUsed(true);
          }}
          disabled={hintUsed}
          className={`mb-1 flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
            hintUsed
              ? "cursor-not-allowed border-brand-gray-200 bg-brand-gray-100 text-brand-gray-400"
              : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
          }`}
        >
          💡 Hint <span className="text-[10px] opacity-60">(10 💎)</span>
        </button>
        <GameButton
          variant="primary"
          onClick={() => onSubmit(answer)}
          disabled={answer.trim().length < 5}
          className="min-w-[160px]"
        >
          SUBMIT
        </GameButton>
      </div>
    </div>
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

function StageComponentLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="rounded-3xl bg-white/70 px-6 py-5 text-sm text-brand-gray-600 shadow-sm">
        Loading stage...
      </div>
    </div>
  );
}
