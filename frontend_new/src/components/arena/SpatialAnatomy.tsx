"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton from "@/components/ui/GameButton";

/* ═══════════════════ Types ═══════════════════ */

export interface AnatomyLabel {
  id: string;
  label: string;
}

export interface SpatialAnatomyProps {
  stageIndex: number;
  totalStages: number;
  topic: string;
  description: string;
  model: string;            // e.g. "heart-cross-section"
  labels: AnatomyLabel[];
  targetId: string;         // correct answer id
  feedbackMsg: { success: string; error: string; hint: string };
  onComplete: () => void;
  onError?: () => void;
  onHintUse: () => boolean;
}

/* ═══════════════════ Heart region positions (relative %) ═══════════════════ */

const HEART_REGIONS: Record<string, { x: number; y: number; w: number; h: number; color: string }> = {
  ra: { x: 14, y: 18, w: 30, h: 28, color: "#60B5FF" },    // Right Atrium – top-left
  la: { x: 56, y: 18, w: 30, h: 28, color: "#A78BFA" },    // Left Atrium  – top-right
  rv: { x: 14, y: 52, w: 30, h: 30, color: "#F59E0B" },    // Right Ventricle – bottom-left
  lv: { x: 56, y: 52, w: 30, h: 30, color: "#58CC02" },    // Left Ventricle – bottom-right
};

/* ═══════════════════ Owl mascot (inline SVG) ═══════════════════ */

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

export default function SpatialAnatomy({
  stageIndex,
  totalStages,
  topic,
  description,
  model,
  labels,
  targetId,
  feedbackMsg,
  onComplete,
  onError,
  onHintUse,
}: SpatialAnatomyProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintTarget, setHintTarget] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  /* Pick a region */
  const handleSelect = useCallback(
    (id: string) => {
      if (completed) return;
      setSelected(id);
      setResult(null);
    },
    [completed],
  );

  /* CHECK */
  const handleCheck = useCallback(() => {
    if (!selected || completed) return;
    if (selected === targetId) {
      setResult("correct");
      setCompleted(true);
      setTimeout(() => onComplete(), 600);
    } else {
      setResult("wrong");
      onError?.();
      // shake then reset
      setTimeout(() => {
        setResult(null);
        setSelected(null);
      }, 1000);
    }
  }, [selected, targetId, completed, onComplete]);

  /* Hint */
  const handleHint = useCallback(() => {
    if (hintUsed || completed) return;
    const canAfford = onHintUse();
    if (!canAfford) return;
    setHintUsed(true);
    setHintTarget(targetId);
    // highlight the answer briefly
    setTimeout(() => {
      setSelected(targetId);
    }, 800);
  }, [hintUsed, completed, onHintUse, targetId]);

  /* Label for selected */
  const selectedLabel = labels.find((l) => l.id === selected)?.label ?? "";

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
        <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center shadow-md shadow-rose-300/30">
          <span className="font-heading font-extrabold text-white text-base">
            {stageIndex + 1}
          </span>
        </div>
        <div>
          <p className="text-[11px] font-bold text-rose-500 uppercase tracking-wider mb-0.5">
            Stage {stageIndex + 1} of {totalStages}
          </p>
          <h2 className="font-heading font-bold text-xl text-brand-gray-700 leading-snug">
            {topic}
          </h2>
          <p className="text-xs text-brand-gray-400 mt-0.5">{description}</p>
        </div>
      </motion.div>

      {/* ── Interactive heart diagram ── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="relative mx-auto w-full max-w-[480px] aspect-square rounded-3xl bg-white/70 backdrop-blur-md border border-white/50 shadow-lg shadow-rose-100/30 overflow-hidden"
      >
        {/* Background heart shape SVG */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full opacity-[0.08]">
          <path
            d="M100,180 C60,140 10,110 10,70 A45,45,0,0,1,100,50 A45,45,0,0,1,190,70 C190,110 140,140 100,180Z"
            fill="#E8734A"
          />
        </svg>

        {/* Divider lines */}
        <div className="absolute left-1/2 top-[15%] bottom-[15%] w-px bg-brand-gray-200/50" />
        <div className="absolute top-1/2 left-[12%] right-[12%] h-px bg-brand-gray-200/50" />

        {/* Clickable regions */}
        {labels.map((label) => {
          const pos = HEART_REGIONS[label.id];
          if (!pos) return null;
          const isSelected = selected === label.id;
          const isCorrectResult = result === "correct" && isSelected;
          const isWrongResult = result === "wrong" && isSelected;
          const isHinted = hintTarget === label.id;

          return (
            <motion.button
              key={label.id}
              onClick={() => handleSelect(label.id)}
              animate={
                isWrongResult
                  ? { x: [0, -6, 6, -4, 4, 0] }
                  : isCorrectResult
                  ? { scale: [1, 1.05, 1] }
                  : {}
              }
              transition={isWrongResult ? { duration: 0.5 } : { duration: 0.4 }}
              className={`absolute rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-1 cursor-pointer
                ${
                  isCorrectResult
                    ? "border-brand-green bg-brand-green/15 shadow-lg shadow-green-300/30 ring-2 ring-brand-green/40"
                    : isWrongResult
                    ? "border-red-400 bg-red-50/60 shadow-md"
                    : isSelected
                    ? "border-brand-teal bg-brand-teal/10 shadow-md shadow-teal-200/30 ring-2 ring-brand-teal/30"
                    : isHinted
                    ? "border-amber-400 bg-amber-50/50 shadow-md animate-pulse"
                    : "border-white/60 bg-white/40 hover:bg-white/60 hover:border-brand-teal/40 hover:shadow-sm"
                }`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${pos.w}%`,
                height: `${pos.h}%`,
              }}
            >
              {/* Colour dot */}
              <div
                className="w-3 h-3 rounded-full opacity-70"
                style={{ backgroundColor: pos.color }}
              />
              <span
                className={`font-heading font-bold text-sm leading-tight text-center px-1 ${
                  isCorrectResult
                    ? "text-brand-green"
                    : isWrongResult
                    ? "text-red-500"
                    : isSelected
                    ? "text-teal-700"
                    : "text-brand-gray-600"
                }`}
              >
                {label.label}
              </span>

              {/* Selected indicator */}
              {isSelected && !result && (
                <motion.div
                  layoutId="anatomy-sel"
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-brand-teal flex items-center justify-center shadow"
                >
                  <span className="text-white text-[10px] font-bold">✓</span>
                </motion.div>
              )}

              {/* Correct icon */}
              {isCorrectResult && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-green flex items-center justify-center shadow-md"
                >
                  <span className="text-white text-xs font-bold">✓</span>
                </motion.div>
              )}
            </motion.button>
          );
        })}

        {/* Model label */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/70 backdrop-blur rounded-full px-4 py-1">
          <span className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">
            {model.replace(/-/g, " ")}
          </span>
        </div>
      </motion.div>

      {/* ── Selection feedback text ── */}
      <AnimatePresence mode="wait">
        {result === "correct" && (
          <motion.div
            key="fb-ok"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 mx-auto max-w-md text-center"
          >
            <p className="text-sm font-bold text-brand-green">{feedbackMsg.success}</p>
          </motion.div>
        )}
        {result === "wrong" && (
          <motion.div
            key="fb-err"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 mx-auto max-w-md text-center"
          >
            <p className="text-sm font-bold text-red-500">{feedbackMsg.error}</p>
          </motion.div>
        )}
        {!result && selected && (
          <motion.div
            key="fb-sel"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 mx-auto text-center"
          >
            <p className="text-sm text-brand-gray-500">
              Selected: <span className="font-bold text-teal-700">{selectedLabel}</span>
            </p>
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
            disabled={hintUsed || completed}
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

        <GameButton
          variant="primary"
          onClick={handleCheck}
          disabled={!selected || completed}
          className="min-w-[140px]"
        >
          {completed ? "CORRECT ✓" : "CHECK"}
        </GameButton>
      </div>
    </div>
  );
}
