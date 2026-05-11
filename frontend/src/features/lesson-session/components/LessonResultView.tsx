"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LessonSessionSummary } from "@/lib/apiTypes";

interface LessonResultViewProps {
  resultSummary: LessonSessionSummary | null;
  accuracy: number;
  xpGained: number;
  showLevelUp: boolean;
  displayLevel: number;
  currentXp: number;
  currentXpToNext: number;
  xpBarWidth: number;
  barDuration: number;
  onBackToMap: () => void;
}

export function LessonResultView({
  resultSummary,
  accuracy,
  xpGained,
  showLevelUp,
  displayLevel,
  currentXp,
  currentXpToNext,
  xpBarWidth,
  barDuration,
  onBackToMap,
}: LessonResultViewProps) {
  const safeSummary: LessonSessionSummary = resultSummary ?? {
    sessionId: 0,
    courseId: null,
    nodeId: "",
    status: "completed",
    activePhase: "primary",
    rewardEligible: false,
    totalStages: 0,
    attemptedCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    skippedCount: 0,
    accuracy: 100,
    elapsedSeconds: 0,
    elapsedLabel: "0m 00s",
    xpGained: 0,
  };
  const isRewardEligible = safeSummary.rewardEligible;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden app-shared-bg">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 35%, rgba(122,199,196,0.18) 0%, rgba(212,169,106,0.08) 45%, transparent 75%)",
        }}
      />

      <VictoryConfetti />
      <DecorativeStars />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6">
        <motion.h1
          initial={{ opacity: 0, scale: 0.5, y: -30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 10, stiffness: 120, delay: 0.1 }}
          className="mb-4 bg-gradient-to-b from-[#7AC7C4] via-[#5fb3af] to-[#D4A96A] bg-clip-text text-center font-heading text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl"
          style={{
            textShadow: "0 4px 18px rgba(122,199,196,0.25)",
          }}
        >
          {isRewardEligible ? "LESSON CLEARED!" : "PRACTICE CLEARED!"}
        </motion.h1>

        {!isRewardEligible && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mb-5 rounded-full border border-[#9ecbd4]/30 bg-white/70 px-4 py-2 text-center text-sm font-semibold text-brand-gray-600 shadow-sm backdrop-blur"
          >
            Replay run: this node was already completed, so no XP reward is granted.
          </motion.p>
        )}

        <motion.div
          initial={{ y: -160, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 11, stiffness: 140, delay: 0.3 }}
          className="relative mb-6"
        >
          <motion.div
            className="absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(122,199,196,0.35) 0%, rgba(212,169,106,0.18) 50%, transparent 72%)",
            }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          />

          <div className="relative z-10 flex flex-col items-center">
            <VictoryTrophy />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 180, delay: 0.7 }}
          className="mb-5 w-full rounded-2xl border border-[#5fb3af]/60 bg-white/75 p-5 shadow-[0_10px_30px_-10px_rgba(74,158,155,0.45)] backdrop-blur-xl"
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="flex-1 text-center">
              <div className="mb-1 text-xs font-medium text-brand-gray-500">Accuracy:</div>
              <div className="font-heading text-2xl font-extrabold tabular-nums text-brand-gray-700 sm:text-3xl">
                {accuracy}%
              </div>
            </div>
            <div className="mx-2 h-12 w-px self-center bg-[#9ecbd4]/30" />
            <div className="flex-1 text-center">
              <div className="mb-1 text-xs font-medium text-brand-gray-500">Time:</div>
              <div className="font-heading text-2xl font-extrabold tabular-nums text-brand-gray-700 sm:text-3xl">
                {safeSummary.elapsedLabel ?? "0m 00s"}
              </div>
            </div>
            <div className="mx-2 h-12 w-px self-center bg-[#9ecbd4]/30" />
            <div className="flex-1 text-center">
              <div className="mb-1 text-xs font-medium text-brand-gray-500">
                {isRewardEligible ? "XP Gained:" : "Reward:"}
              </div>
              <div
                className={`font-heading text-2xl font-extrabold tabular-nums sm:text-3xl ${
                  isRewardEligible ? "text-[#D4A96A]" : "text-brand-gray-400"
                }`}
              >
                {isRewardEligible ? `+${xpGained} XP` : "No XP"}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isRewardEligible && showLevelUp && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="mb-2 text-right"
              >
                <span
                  className="bg-gradient-to-r from-[#7AC7C4] via-[#5fb3af] to-[#D4A96A] bg-clip-text font-heading text-lg font-extrabold italic text-transparent"
                  style={{ textShadow: "0 0 16px rgba(122,199,196,0.35)" }}
                >
                  Level Up!
                </span>
              </motion.div>
              )}
          </AnimatePresence>

          <div className="mb-1 flex items-center justify-between px-0.5 text-[10px] font-bold text-brand-gray-500">
            <span>Lv.{displayLevel}</span>
            <span className="tabular-nums">
              {Math.round(currentXp)} / {currentXpToNext} XP
            </span>
            <span>Lv.{displayLevel + 1}</span>
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded-full border border-[#9ecbd4]/30 bg-white/60">
            <motion.div
              className={`relative h-full rounded-full ${
                isRewardEligible
                  ? "bg-gradient-to-r from-[#7AC7C4] via-[#5fb3af] to-[#D4A96A]"
                  : "bg-gradient-to-r from-brand-gray-300/40 via-brand-gray-300/50 to-brand-gray-300/40"
              }`}
              animate={{ width: `${Math.max(xpBarWidth, 0)}%` }}
              transition={{ duration: barDuration, ease: "easeOut" }}
            >
              {isRewardEligible && (
                <div className="absolute inset-0 animate-shimmer-bar bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              )}
            </motion.div>
            {isRewardEligible && (
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  boxShadow: [
                    "inset 0 0 6px rgba(122,199,196,0.3)",
                    "inset 0 0 12px rgba(122,199,196,0.5)",
                    "inset 0 0 6px rgba(122,199,196,0.3)",
                  ],
                }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="w-full"
        >
          <button
            onClick={onBackToMap}
            className="relative w-full rounded-2xl border border-[#9ecbd4]/40 bg-gradient-to-r from-[#7AC7C4] to-[#5fb3af] py-4 font-heading text-lg font-extrabold text-white shadow-[0_8px_24px_-8px_rgba(122,199,196,0.55)] transition-all duration-200 hover:shadow-[0_10px_28px_-6px_rgba(122,199,196,0.7)] active:scale-[0.97]"
          >
            <motion.div
              className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/0 via-white/20 to-white/0"
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            />
            <span className="relative z-10">Back to Map</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function VictoryTrophy() {
  return (
    <motion.svg
      viewBox="0 0 160 170"
      className="h-44 w-44"
      fill="none"
      animate={{ y: [0, -4, 0] }}
      transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
    >
      <defs>
        <linearGradient id="trophyCup" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4D88B" />
          <stop offset="45%" stopColor="#D4A96A" />
          <stop offset="100%" stopColor="#A57C42" />
        </linearGradient>
        <linearGradient id="trophyHandle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E6BE7A" />
          <stop offset="100%" stopColor="#9D7438" />
        </linearGradient>
        <linearGradient id="trophyBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8AD0CC" />
          <stop offset="100%" stopColor="#5fb3af" />
        </linearGradient>
        <radialGradient id="trophyShine" cx="35%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="80" cy="160" rx="50" ry="5" fill="rgba(15,40,55,0.15)" />

      <path d="M40 24 Q22 32 22 58 Q22 84 48 92" stroke="url(#trophyHandle)" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M120 24 Q138 32 138 58 Q138 84 112 92" stroke="url(#trophyHandle)" strokeWidth="9" strokeLinecap="round" fill="none" />

      <path
        d="M38 18 L122 18 L116 78 Q113 102 80 102 Q47 102 44 78 Z"
        fill="url(#trophyCup)"
        stroke="#9D7438"
        strokeWidth="2"
      />
      <path
        d="M44 24 L116 24 L112 36 Q80 44 48 36 Z"
        fill="url(#trophyShine)"
      />

      <StarShape cx={80} cy={56} r={11} fill="#FFFFFF" opacity={0.95} />
      <StarShape cx={80} cy={56} r={7} fill="#D4A96A" opacity={0.9} />

      <rect x="68" y="100" width="24" height="18" rx="3" fill="url(#trophyHandle)" />
      <rect x="56" y="118" width="48" height="10" rx="3" fill="url(#trophyBase)" stroke="#4a9e9b" strokeWidth="1.5" />
      <rect x="44" y="128" width="72" height="18" rx="5" fill="url(#trophyBase)" stroke="#4a9e9b" strokeWidth="1.5" />
      <rect x="50" y="134" width="60" height="3" rx="1.5" fill="#FFFFFF" opacity="0.3" />

      <motion.g
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
      >
        <circle cx="28" cy="40" r="2.5" fill="#FFD89A" />
        <circle cx="132" cy="46" r="2" fill="#FFD89A" />
        <circle cx="20" cy="78" r="1.8" fill="#7AC7C4" />
        <circle cx="142" cy="76" r="2.2" fill="#7AC7C4" />
      </motion.g>
    </motion.svg>
  );
}

function StarShape({
  cx,
  cy,
  r,
  fill,
  opacity = 1,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  opacity?: number;
}) {
  const points = Array.from({ length: 5 }, (_, i) => {
    const outerAngle = (i * 72 - 90) * (Math.PI / 180);
    const innerAngle = (i * 72 + 36 - 90) * (Math.PI / 180);
    const ox = cx + r * Math.cos(outerAngle);
    const oy = cy + r * Math.sin(outerAngle);
    const ix = cx + r * 0.4 * Math.cos(innerAngle);
    const iy = cy + r * 0.4 * Math.sin(innerAngle);
    return `${ox},${oy} ${ix},${iy}`;
  }).join(" ");

  return <polygon points={points} fill={fill} opacity={opacity} />;
}

function DecorativeStars() {
  const stars = useMemo(
    () => [
      { x: "8%", y: "15%", size: 18, delay: 0.5, opacity: 0.5 },
      { x: "90%", y: "20%", size: 14, delay: 0.8, opacity: 0.4 },
      { x: "5%", y: "75%", size: 12, delay: 1.2, opacity: 0.3 },
      { x: "92%", y: "80%", size: 22, delay: 0.3, opacity: 0.5 },
      { x: "15%", y: "45%", size: 10, delay: 1.5, opacity: 0.25 },
      { x: "85%", y: "50%", size: 16, delay: 0.6, opacity: 0.35 },
      { x: "50%", y: "90%", size: 12, delay: 1.0, opacity: 0.3 },
    ],
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {stars.map((s, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: s.x, top: s.y }}
          initial={{ opacity: 0, scale: 0, rotate: 0 }}
          animate={{
            opacity: s.opacity,
            scale: [0, 1, 0.8, 1],
            rotate: [0, 15, -10, 0],
          }}
          transition={{ delay: s.delay, duration: 1.5, ease: "easeOut" }}
        >
          <motion.svg
            viewBox="0 0 24 24"
            style={{ width: s.size, height: s.size }}
            fill={i % 2 === 0 ? "#D4A96A" : "#7AC7C4"}
            animate={{ rotate: [0, 360] }}
            transition={{ repeat: Infinity, duration: 8 + i * 2, ease: "linear" }}
          >
            <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
          </motion.svg>
        </motion.div>
      ))}
    </div>
  );
}

function VictoryConfetti() {
  const particles = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => {
        const isStreak = i < 20;
        return {
          id: i,
          x: isStreak ? 40 + Math.random() * 20 : Math.random() * 100,
          startY: isStreak ? 45 : -5,
          endY: isStreak ? -10 + Math.random() * 30 : 110,
          delay: isStreak ? Math.random() * 0.3 : 0.2 + Math.random() * 1.5,
          duration: isStreak ? 0.6 + Math.random() * 0.5 : 2 + Math.random() * 2.5,
          color: [
            "#7AC7C4",
            "#D4A96A",
            "#F4D88B",
            "#5fb3af",
            "#9ecbd4",
            "#E8B978",
            "#8AD0CC",
            "#F0C893",
            "#4a9e9b",
          ][i % 9],
          size: isStreak ? 3 + Math.random() * 3 : 4 + Math.random() * 8,
          rotation: Math.random() * 360,
          spreadX: isStreak ? (Math.random() - 0.5) * 60 : 0,
        };
      }),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            top: `${p.startY}%`,
            left: `${p.x}%`,
            opacity: 1,
            rotate: 0,
            x: 0,
          }}
          animate={{
            top: `${p.endY}%`,
            rotate: p.rotation + 540,
            opacity: [1, 1, 0.6, 0],
            x: p.spreadX,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: p.startY > 0 ? "easeOut" : "easeIn",
          }}
          className="absolute"
          style={{
            width: p.size,
            height: p.size,
            borderRadius: p.size > 7 ? "2px" : "50%",
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  );
}
