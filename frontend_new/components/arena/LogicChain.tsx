"use client";

import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import GameButton from "@/components/ui/GameButton";

/* ═══════════════════ Types ═══════════════════ */

export interface LogicChainProps {
  stageIndex: number;
  totalStages: number;
  topic: string;
  description: string;
  nodes: string[];          // correct order
  feedbackMsg: { success: string; error: string; hint: string };
  onComplete: () => void;
  onError?: () => void;
  onWrongAdvance?: () => void;
  onHintUse: () => boolean;
}

/* ═══════════════════ Helpers ═══════════════════ */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Owl mascot (inline SVG) */
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

/* ═══════════════════ Accent colours per step ═══════════════════ */

const STEP_COLORS = [
  "from-sky-400 to-sky-500",
  "from-brand-teal to-[#5fb3af]",
  "from-amber-400 to-amber-500",
  "from-brand-coral to-red-400",
  "from-violet-400 to-purple-500",
  "from-brand-green to-emerald-500",
];

const STEP_BORDER = [
  "border-sky-300",
  "border-brand-teal",
  "border-amber-300",
  "border-brand-coral",
  "border-violet-300",
  "border-brand-green",
];

/* ═══════════════════ Component ═══════════════════ */

export default function LogicChain({
  stageIndex,
  totalStages,
  topic,
  description,
  nodes,
  feedbackMsg,
  onComplete,
  onError,
  onWrongAdvance,
  onHintUse,
}: LogicChainProps) {
  // Shuffle on first render (useRef so it only shuffles once)
  const initialOrder = useRef(shuffle(nodes));
  const [order, setOrder] = useState<string[]>(initialOrder.current);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [wrongIndices, setWrongIndices] = useState<number[]>([]);
  const [hintUsed, setHintUsed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [lockedCount, setLockedCount] = useState(0); // how many from the top are locked (via hints)

  /* CHECK */
  const handleCheck = useCallback(() => {
    if (completed) return;

    // Compare with correct order
    const isCorrect = order.every((n, i) => n === nodes[i]);

    if (isCorrect) {
      setResult("correct");
      setCompleted(true);
      setWrongIndices([]);
      setTimeout(() => onComplete(), 600);
    } else {
      // Find wrong positions
      const wrong: number[] = [];
      order.forEach((n, i) => {
        if (n !== nodes[i]) wrong.push(i);
      });
      setWrongIndices(wrong);
      setResult("wrong");
      onError?.();
      // After shake, show correct order
      setTimeout(() => {
        setOrder([...nodes]);
        setWrongIndices([]);
      }, 800);
    }
  }, [order, nodes, completed, onComplete]);

  /* Hint: lock the next correct item in place */
  const handleHint = useCallback(() => {
    if (hintUsed || completed) return;
    const canAfford = onHintUse();
    if (!canAfford) return;
    setHintUsed(true);

    // Place the next correct node at the right position
    const nextCorrect = nodes[lockedCount];
    const newOrder = [...order];
    const currentIdx = newOrder.indexOf(nextCorrect);
    if (currentIdx !== lockedCount) {
      // Swap
      [newOrder[lockedCount], newOrder[currentIdx]] = [newOrder[currentIdx], newOrder[lockedCount]];
      setOrder(newOrder);
    }
    setLockedCount((c) => c + 1);
  }, [hintUsed, completed, onHintUse, nodes, lockedCount, order]);

  /* Arrow connector between items */
  const Arrow = ({ idx }: { idx: number }) => {
    const isWrong = wrongIndices.includes(idx) || wrongIndices.includes(idx + 1);
    return (
      <div className="flex justify-center py-1">
        <motion.div
          animate={isWrong && result === "wrong" ? { opacity: [1, 0.3, 1] } : {}}
          transition={{ duration: 0.4, repeat: 2 }}
        >
          <svg viewBox="0 0 24 28" className="w-5 h-7" fill="none">
            <path
              d="M12 4 L12 20 M6 16 L12 22 L18 16"
              stroke={isWrong && result === "wrong" ? "#EF4444" : "#7AC7C4"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Scrollable content area ── */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 arena-scroll">
      {/* ── Stage header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 mb-5 flex items-center gap-4"
      >
        <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-md shadow-sky-300/30">
          <span className="font-heading font-extrabold text-white text-base">
            {stageIndex + 1}
          </span>
        </div>
        <div>
          <p className="text-[11px] font-bold text-sky-500 uppercase tracking-wider mb-0.5">
            Stage {stageIndex + 1} of {totalStages}
          </p>
          <h2 className="font-heading font-bold text-xl text-brand-gray-700 leading-snug">
            {topic}
          </h2>
          <p className="text-xs text-brand-gray-400 mt-0.5">{description}</p>
        </div>
      </motion.div>

      {/* ── Instruction ── */}
      <div className="mb-4 flex items-center gap-2 px-1">
        <span className="text-lg">🔗</span>
        <p className="text-sm text-brand-gray-500 font-medium">
          Drag to reorder the steps into the correct sequence
        </p>
      </div>

      {/* ── Chain list (Reorder) ── */}
      <div className="mx-auto w-full max-w-[500px]">
        <Reorder.Group
          axis="y"
          values={order}
          onReorder={(newOrder) => {
            if (completed || result) return;
            // Don't allow reordering locked items
            const locked = order.slice(0, lockedCount);
            const reorderUnlocked = newOrder.filter((n) => !locked.includes(n));
            setOrder([...locked, ...reorderUnlocked]);
          }}
          className="flex flex-col"
        >
          {order.map((node, idx) => {
            const isLocked = idx < lockedCount;
            const isWrong = wrongIndices.includes(idx) && result === "wrong";
            const isCorrectResult = result === "correct";
            const colorIdx = idx % STEP_COLORS.length;

            return (
              <React.Fragment key={node}>
                <Reorder.Item
                  value={node}
                  dragListener={!isLocked && !completed && !result}
                  className="select-none"
                >
                  <motion.div
                    layout
                    animate={
                      isWrong
                        ? { x: [0, -8, 8, -5, 5, 0] }
                        : isCorrectResult
                        ? { scale: [1, 1.02, 1] }
                        : {}
                    }
                    transition={isWrong ? { duration: 0.5 } : { duration: 0.3, delay: idx * 0.05 }}
                    className={`relative flex items-center gap-3 rounded-2xl border-2 px-5 py-4 transition-all duration-200
                      ${
                        isCorrectResult
                          ? "border-brand-green/60 bg-green-50/60 shadow-md shadow-green-200/30"
                          : isWrong
                          ? "border-red-400 bg-red-50/50 shadow-md"
                          : isLocked
                          ? `${STEP_BORDER[colorIdx]} bg-white/80 shadow-sm opacity-80`
                          : "border-white/60 bg-white/70 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-brand-teal/40 cursor-grab active:cursor-grabbing"
                      }`}
                  >
                    {/* Step number badge */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br ${STEP_COLORS[colorIdx]} flex items-center justify-center shadow-sm`}
                    >
                      <span className="font-heading font-extrabold text-white text-sm">
                        {idx + 1}
                      </span>
                    </div>

                    {/* Label */}
                    <span
                      className={`font-heading font-bold text-[15px] flex-1 ${
                        isCorrectResult
                          ? "text-brand-green"
                          : isWrong
                          ? "text-red-500"
                          : "text-brand-gray-700"
                      }`}
                    >
                      {node}
                    </span>

                    {/* Drag handle / lock icon */}
                    {isLocked ? (
                      <svg viewBox="0 0 20 20" className="w-4 h-4 text-brand-gray-300 flex-shrink-0" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    ) : !completed ? (
                      <svg viewBox="0 0 20 20" className="w-5 h-5 text-brand-gray-300 flex-shrink-0" fill="currentColor">
                        <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                      </svg>
                    ) : (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-brand-green flex items-center justify-center"
                      >
                        <span className="text-white text-[10px] font-bold">✓</span>
                      </motion.div>
                    )}
                  </motion.div>
                </Reorder.Item>

                {/* Arrow between items */}
                {idx < order.length - 1 && <Arrow idx={idx} />}
              </React.Fragment>
            );
          })}
        </Reorder.Group>
      </div>

      {/* ── Feedback text ── */}
      <AnimatePresence mode="wait">
        {result === "correct" && (
          <motion.div
            key="chain-ok"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 mx-auto max-w-md text-center"
          >
            <p className="text-sm font-bold text-brand-green">{feedbackMsg.success}</p>
          </motion.div>
        )}
        {result === "wrong" && (
          <motion.div
            key="chain-err"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 mx-auto max-w-md text-center"
          >
            <p className="text-sm font-bold text-red-500">{feedbackMsg.error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      </div>{/* end scrollable area */}

      {/* ── Bottom bar ── */}
      <div className="relative pt-4 pb-6 flex items-end justify-between flex-shrink-0">
        <div className="flex items-end gap-2">
          <OwlMascotSmall />
          <button
            onClick={handleHint}
            disabled={hintUsed || completed || !!result}
            className={`mb-1 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition ${
              hintUsed
                ? "bg-brand-gray-100 text-brand-gray-400 border-brand-gray-200 cursor-not-allowed"
                : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
            }`}
          >
            💡 Hint
            <span className="text-[10px] opacity-60">(10 💎)</span>
          </button>
        </div>

        {result === "wrong" ? (
          <GameButton
            variant="primary"
            onClick={() => onWrongAdvance?.()}
            className="min-w-[140px]"
          >
            GOT IT
          </GameButton>
        ) : (
          <GameButton
            variant="primary"
            onClick={handleCheck}
            disabled={completed}
            className="min-w-[140px]"
          >
            {completed ? "CORRECT ✓" : "CHECK"}
          </GameButton>
        )}
      </div>
    </div>
  );
}
