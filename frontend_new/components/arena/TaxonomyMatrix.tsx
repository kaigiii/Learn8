"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GameButton from "@/components/ui/GameButton";

/* ═══════════════════ Types ═══════════════════ */

export interface TaxonomyItem {
  id: string;
  content: string;
}

export interface TaxonomyMatrixProps {
  stageIndex: number;
  totalStages: number;
  topic: string;
  description: string;
  buckets: string[];
  items: TaxonomyItem[];
  correctAssignments: Record<string, string>; // itemId → bucket name
  feedbackMsg: { success: string; error: string; hint: string };
  onComplete: () => void;
  onError?: () => void;
  onWrongAdvance?: () => void;
  onHintUse: () => boolean; // returns false if can't afford
}

/* ═══════════════════ Bucket accent colours ═══════════════════ */

const BUCKET_ACCENTS = [
  {
    border: "border-brand-teal",
    borderDash: "border-brand-teal/40",
    bg: "bg-brand-teal/5",
    bgHover: "hover:bg-brand-teal/10",
    text: "text-teal-700",
    tagBg: "bg-brand-teal/10",
    tagBorder: "border-brand-teal/40",
    icon: "✓",
  },
  {
    border: "border-brand-coral",
    borderDash: "border-brand-coral/40",
    bg: "bg-brand-coral/5",
    bgHover: "hover:bg-brand-coral/10",
    text: "text-red-700",
    tagBg: "bg-brand-coral/10",
    tagBorder: "border-brand-coral/40",
    icon: "✗",
  },
];

/* ═══════════════════ Component ═══════════════════ */

export default function TaxonomyMatrix({
  stageIndex,
  totalStages,
  topic,
  description,
  buckets,
  items,
  correctAssignments,
  feedbackMsg,
  onComplete,
  onError,
  onWrongAdvance,
  onHintUse,
}: TaxonomyMatrixProps) {
  /* ── State ── */
  const [assignments, setAssignments] = useState<Record<string, string[]>>(
    () => {
      const init: Record<string, string[]> = {};
      buckets.forEach((b) => (init[b] = []));
      return init;
    }
  );
  const [unclassified, setUnclassified] = useState<string[]>(
    items.map((i) => i.id)
  );
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [wrongItems, setWrongItems] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintItem, setHintItem] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allPlaced = unclassified.length === 0;

  const getItem = useCallback(
    (id: string) => items.find((i) => i.id === id)!,
    [items]
  );

  /* ── Select item from pool ── */
  const selectItem = useCallback(
    (id: string) => {
      if (completed || result) return;
      setSelectedItem((prev) => (prev === id ? null : id));
      setWrongItems([]);
      setErrorMsg(null);
    },
    [completed, result]
  );

  /* ── Place selected item into a bucket ── */
  const placeInBucket = useCallback(
    (bucket: string) => {
      if (!selectedItem || completed || result) return;

      setUnclassified((prev) => prev.filter((id) => id !== selectedItem));
      setAssignments((prev) => {
        const next: Record<string, string[]> = {};
        for (const b of Object.keys(prev)) {
          next[b] = prev[b].filter((id) => id !== selectedItem);
        }
        next[bucket] = [...(next[bucket] || []), selectedItem];
        return next;
      });
      setSelectedItem(null);
    },
    [selectedItem, completed]
  );

  /* ── Remove item from bucket back to pool ── */
  const removeFromBucket = useCallback(
    (itemId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (completed || result) return;
      setAssignments((prev) => {
        const next: Record<string, string[]> = {};
        for (const b of Object.keys(prev)) {
          next[b] = prev[b].filter((id) => id !== itemId);
        }
        return next;
      });
      setUnclassified((prev) => [...prev, itemId]);
    },
    [completed, result]
  );

  /* ── Check all assignments ── */
  const handleCheck = useCallback(() => {
    if (!allPlaced || completed) return;

    const wrong: string[] = [];
    for (const [bucket, itemIds] of Object.entries(assignments)) {
      for (const id of itemIds) {
        if (correctAssignments[id] !== bucket) wrong.push(id);
      }
    }

    if (wrong.length === 0) {
      setCompleted(true);
      onComplete();
    } else {
      setWrongItems(wrong);
      setErrorMsg(feedbackMsg.error);
      setResult("wrong");
      onError?.();
      // After shake, move all items to correct buckets
      setTimeout(() => {
        const corrected: Record<string, string[]> = {};
        buckets.forEach((b) => (corrected[b] = []));
        items.forEach((item) => {
          const correctBucket = correctAssignments[item.id];
          corrected[correctBucket].push(item.id);
        });
        setAssignments(corrected);
        setUnclassified([]);
        setWrongItems([]);
        setSelectedItem(null);
      }, 900);
    }
  }, [allPlaced, completed, assignments, correctAssignments, onComplete, feedbackMsg]);

  /* ── Hint ── */
  const handleHint = useCallback(() => {
    if (hintUsed || completed || unclassified.length === 0) return;
    if (!onHintUse()) return;
    setHintUsed(true);

    const itemId = unclassified[0];
    const correctBucket = correctAssignments[itemId];
    setHintItem(itemId);
    setSelectedItem(itemId);

    setTimeout(() => {
      setUnclassified((prev) => prev.filter((id) => id !== itemId));
      setAssignments((prev) => {
        const next = { ...prev };
        next[correctBucket] = [...next[correctBucket], itemId];
        return next;
      });
      setSelectedItem(null);
      setHintItem(null);
    }, 800);
  }, [hintUsed, completed, onHintUse, unclassified, correctAssignments]);

  /* ═══════════════════ Render ═══════════════════ */
  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* ─── Scrollable content area ─── */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 arena-scroll">
      {/* ─── Question card ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 mb-6 flex items-center gap-4"
      >
        <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-purple-300/30">
          <span className="font-heading font-extrabold text-white text-base">
            {stageIndex + 1}
          </span>
        </div>
        <div>
          <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider mb-0.5">
            Stage {stageIndex + 1} of {totalStages} · {topic}
          </p>
          <h2 className="font-heading font-bold text-xl text-brand-gray-700 leading-snug">
            {description}
          </h2>
        </div>
      </motion.div>

      {/* ─── Instruction chip ─── */}
      <AnimatePresence>
        {!allPlaced && !completed && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 flex items-center gap-2"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-gray-500 bg-white/60 backdrop-blur border border-brand-gray-200 rounded-full px-3 py-1.5">
              <span className="text-brand-teal">①</span> Tap an item below
              <span className="text-brand-teal mx-0.5">→</span>
              <span className="text-brand-teal">②</span> Tap a bucket to classify
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Bucket zones ─── */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {buckets.map((bucket, bi) => {
          const accent = BUCKET_ACCENTS[bi % BUCKET_ACCENTS.length];
          const bucketItems = assignments[bucket] || [];
          const isTarget = !!selectedItem;

          return (
            <motion.div
              key={bucket}
              onClick={() => placeInBucket(bucket)}
              whileHover={isTarget ? { scale: 1.02 } : {}}
              whileTap={isTarget ? { scale: 0.98 } : {}}
              className={`relative rounded-2xl border-2 border-dashed p-4 min-h-[160px] transition-all cursor-pointer ${
                isTarget
                  ? `${accent.borderDash} ${accent.bg} ${accent.bgHover} shadow-md`
                  : "border-brand-gray-200 bg-white/40 backdrop-blur-sm"
              } ${completed ? "opacity-80" : ""}`}
            >
              {/* Bucket label */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`h-6 w-6 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
                    bi === 0
                      ? "bg-gradient-to-br from-brand-teal to-[#5fb3af]"
                      : "bg-gradient-to-br from-brand-coral to-[#d4654a]"
                  }`}
                >
                  {bi === 0 ? "✓" : "✗"}
                </div>
                <h4 className="font-heading font-bold text-brand-gray-700 text-sm">
                  {bucket}
                </h4>
              </div>

              {/* Items in this bucket */}
              <div className="flex flex-wrap gap-2">
                <AnimatePresence mode="popLayout">
                  {bucketItems.map((itemId) => {
                    const item = getItem(itemId);
                    const isWrong = wrongItems.includes(itemId);
                    const isHint = hintItem === itemId;
                    return (
                      <motion.button
                        key={itemId}
                        layout
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{
                          scale: 1,
                          opacity: 1,
                          x: isWrong ? [0, -6, 6, -6, 6, 0] : 0,
                        }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={
                          isWrong
                            ? { x: { duration: 0.5 } }
                            : { type: "spring", damping: 18 }
                        }
                        onClick={(e) => removeFromBucket(itemId, e)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition group ${
                          completed
                            ? "bg-brand-green/10 text-brand-green border-brand-green/40"
                            : isWrong
                            ? "bg-red-50 text-red-500 border-red-400"
                            : isHint
                            ? "bg-amber-50 text-amber-600 border-amber-300"
                            : `${accent.tagBg} ${accent.text} ${accent.tagBorder}`
                        }`}
                      >
                        {item.content}
                        {!completed && (
                          <span className="ml-1.5 text-[10px] opacity-0 group-hover:opacity-60 transition">
                            ×
                          </span>
                        )}
                        {completed && (
                          <span className="ml-1.5">✓</span>
                        )}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Empty state */}
              {bucketItems.length === 0 && (
                <div className="flex items-center justify-center h-16 text-xs text-brand-gray-300 italic">
                  {isTarget ? "← Tap to place here" : "No items yet"}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ─── Error message ─── */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-3 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium"
          >
            💡 {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Unclassified items pool ─── */}
      <AnimatePresence mode="popLayout">
        {unclassified.length > 0 && (
          <motion.div layout>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gray-400 mb-2">
              Classify these items ↑
            </p>
            <div className="flex flex-col gap-2.5">
              {unclassified.map((itemId) => {
                const item = getItem(itemId);
                const isSelected = selectedItem === itemId;
                const isHint = hintItem === itemId;
                return (
                  <motion.button
                    key={itemId}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ type: "spring", damping: 20 }}
                    onClick={() => selectItem(itemId)}
                    whileTap={{ scale: 0.97 }}
                    className={`w-full text-left rounded-2xl px-5 py-4 border-2 border-b-4 font-heading font-bold text-base transition-all ${
                      isHint
                        ? "border-amber-400 bg-amber-50 text-amber-700 shadow-md shadow-amber-200/40"
                        : isSelected
                        ? "border-brand-teal bg-brand-teal/10 text-brand-teal shadow-md shadow-teal-200/40"
                        : "border-brand-gray-200 bg-white text-brand-gray-700 hover:border-brand-teal/40 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold transition ${
                          isSelected
                            ? "bg-brand-teal text-white"
                            : "bg-brand-gray-100 text-brand-gray-400"
                        }`}
                      >
                        {isSelected ? "↑" : "?"}
                      </span>
                      <span className="text-sm">{item.content}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── All placed message ─── */}
      {allPlaced && !completed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-center text-sm text-brand-teal font-semibold"
        >
          All items classified! Tap CHECK to verify.
        </motion.div>
      )}

      </div>{/* end scrollable area */}

      {/* ─── Bottom Bar ─── */}
      <div className="relative pt-4 pb-6 flex items-end justify-between">
        {/* Mascot + hint */}
        <div className="flex items-end gap-2">
          <OwlMascotSmall />
          <button
            onClick={handleHint}
            disabled={hintUsed || completed || !!result || unclassified.length === 0}
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

        {/* CHECK / GOT IT button */}
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
            disabled={!allPlaced || completed}
            className="min-w-[140px]"
          >
            CHECK
          </GameButton>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════ Owl Mascot (compact) ═══════════════════ */

function OwlMascotSmall() {
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
