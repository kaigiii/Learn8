"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { clampJobProgress, formatJobProgressLabel } from "@/lib/jobs/presentation";

const STEPS = [
  "Scanning document...",
  "Extracting key concepts...",
  "Building knowledge graph...",
  "Forging interactive stages...",
  "Polishing your universe...",
];

const STEP_DURATION = 2000;

export default function ForgeStatus({
  error,
  subtitle,
  title,
  statusMessage,
  progress,
}: {
  error?: string;
  subtitle?: string;
  title?: string;
  statusMessage?: string;
  progress?: number;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const hasLiveStatus = typeof progress === "number" || !!statusMessage;
  const safeProgress = typeof progress === "number" ? clampJobProgress(progress) : null;
  const displayedTitle = error
    ? "Generation interrupted"
    : title || "Forging your learning universe...";
  const displayedMessage = error
    ? error
    : statusMessage || subtitle || "Forging your personalised learning universe...";

  useEffect(() => {
    if (hasLiveStatus) return;
    if (charIdx < STEPS[stepIdx].length) {
      const t = setTimeout(() => setCharIdx((c) => c + 1), 38);
      return () => clearTimeout(t);
    }
  }, [charIdx, hasLiveStatus, stepIdx]);

  useEffect(() => {
    if (hasLiveStatus) return;
    if (error || stepIdx >= STEPS.length) return;
    const t = setTimeout(() => {
      if (stepIdx < STEPS.length - 1) {
        setStepIdx((s) => s + 1);
        setCharIdx(0);
      }
    }, STEP_DURATION);
    return () => clearTimeout(t);
  }, [error, hasLiveStatus, stepIdx]);

  const fallbackProgress = ((stepIdx + 1) / STEPS.length) * 100;
  const displayedProgress = safeProgress ?? fallbackProgress;
  const activeStepCount = Math.max(
    1,
    Math.min(
      STEPS.length,
      safeProgress !== null
        ? Math.ceil((safeProgress / 100) * STEPS.length)
        : stepIdx + 1
    )
  );

  return (
    <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-[28px] bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8] px-6 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-48 w-48 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute bottom-[-12%] right-[-8%] h-56 w-56 rounded-full bg-brand-teal/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="relative"
        >
          <div className="absolute inset-0 rounded-full bg-white/35 blur-3xl" />
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-white/40 bg-white/25 backdrop-blur-md">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
              className="absolute h-32 w-32 rounded-full border border-dashed border-brand-teal/50"
            />
            <svg viewBox="0 0 120 120" className="h-24 w-24" fill="none">
              <rect x="38" y="68" width="44" height="16" rx="3" fill="#C4A882" />
              <rect x="46" y="58" width="28" height="12" rx="2" fill="#D4B896" />
              <path d="M28 66Q34 48 46 46H74Q86 48 92 66H28Z" fill="#F0E0CC" />
              <path d="M28 66Q20 62 16 58Q14 56 18 54Q24 52 30 54Z" fill="#D4B896" />
              <circle cx="60" cy="40" r="10" fill="#7AC7C4" opacity="0.25" />
              <path d="M60 24L62.8 35.2L74 38L62.8 40.8L60 52L57.2 40.8L46 38L57.2 35.2L60 24Z" fill="#D4A96A" />
            </svg>
          </div>
        </motion.div>

        <div className="h-10 flex items-center">
          <motion.p
            key={hasLiveStatus ? displayedTitle : stepIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-center text-xl font-bold tracking-wide text-brand-gray-700 md:text-2xl"
          >
            {hasLiveStatus ? (
              displayedTitle
            ) : (
              <>
                {STEPS[stepIdx].slice(0, charIdx)}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                  className="ml-0.5 inline-block h-5 w-0.5 align-middle bg-brand-teal"
                />
              </>
            )}
          </motion.p>
        </div>

        <div className="flex gap-2.5">
          {STEPS.map((_, i) => (
            <motion.div
              key={i}
              className={`h-2.5 rounded-full transition-all duration-500 ${
                i < activeStepCount ? "w-8 bg-brand-teal" : "w-2.5 bg-brand-gray-200"
              }`}
              layout
            />
          ))}
        </div>

        <p className="text-center text-sm text-brand-gray-500">
          {displayedMessage}
        </p>

        <div className="h-2 w-64 overflow-hidden rounded-full bg-white/50">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand-teal to-[#5fb3af]"
            animate={{ width: `${displayedProgress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {safeProgress !== null && !error && (
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-teal/80">
            {formatJobProgressLabel(safeProgress)}
          </p>
        )}
      </div>
    </div>
  );
}
