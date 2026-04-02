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
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f0f23]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,215,0,0.15) 0%, rgba(255,180,50,0.06) 40%, transparent 70%)",
        }}
      />

      <VictoryConfetti />
      <DecorativeStars />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center px-6">
        <motion.h1
          initial={{ opacity: 0, scale: 0.5, y: -30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 10, stiffness: 120, delay: 0.1 }}
          className="mb-4 bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-500 bg-clip-text text-center font-heading text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl"
          style={{
            textShadow: "0 0 40px rgba(255,215,0,0.4), 0 2px 8px rgba(0,0,0,0.6)",
            WebkitTextStroke: "0.5px rgba(255,215,0,0.3)",
          }}
        >
          {isRewardEligible ? "LESSON CLEARED!" : "PRACTICE CLEARED!"}
        </motion.h1>

        {!isRewardEligible && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mb-5 rounded-full border border-amber-200/20 bg-white/10 px-4 py-2 text-center text-sm font-semibold text-amber-200 backdrop-blur"
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
                "radial-gradient(circle, rgba(255,215,0,0.25) 0%, rgba(255,180,50,0.08) 50%, transparent 70%)",
            }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          />

          <div className="relative z-10 flex flex-col items-center">
            <GraduationOwl />
            <div className="-mt-4">
              <TreasureChest />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 180, delay: 0.7 }}
          className="mb-5 w-full rounded-2xl border border-white/15 bg-white/10 p-5 shadow-lg shadow-black/20 backdrop-blur-xl"
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="flex-1 text-center">
              <div className="mb-1 text-xs font-medium text-white/50">Accuracy:</div>
              <div className="font-heading text-2xl font-extrabold tabular-nums text-white sm:text-3xl">
                {accuracy}%
              </div>
            </div>
            <div className="mx-2 h-12 w-px self-center bg-white/10" />
            <div className="flex-1 text-center">
              <div className="mb-1 text-xs font-medium text-white/50">Time:</div>
              <div className="font-heading text-2xl font-extrabold tabular-nums text-white sm:text-3xl">
                {safeSummary.elapsedLabel ?? "0m 00s"}
              </div>
            </div>
            <div className="mx-2 h-12 w-px self-center bg-white/10" />
            <div className="flex-1 text-center">
              <div className="mb-1 text-xs font-medium text-white/50">
                {isRewardEligible ? "XP Gained:" : "Reward:"}
              </div>
              <div
                className={`font-heading text-2xl font-extrabold tabular-nums sm:text-3xl ${
                  isRewardEligible ? "text-amber-300" : "text-white/75"
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
                  className="bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 bg-clip-text font-heading text-lg font-extrabold italic text-transparent"
                  style={{ textShadow: "0 0 20px rgba(255,215,0,0.5)" }}
                >
                  Level Up!
                </span>
              </motion.div>
              )}
          </AnimatePresence>

          <div className="mb-1 flex items-center justify-between px-0.5 text-[10px] font-bold text-white/40">
            <span>Lv.{displayLevel}</span>
            <span className="tabular-nums">
              {Math.round(currentXp)} / {currentXpToNext} XP
            </span>
            <span>Lv.{displayLevel + 1}</span>
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded-full border border-white/10 bg-black/30">
            <motion.div
              className={`relative h-full rounded-full ${
                isRewardEligible
                  ? "bg-gradient-to-r from-brand-green via-emerald-400 to-brand-green"
                  : "bg-gradient-to-r from-white/20 via-white/25 to-white/20"
              }`}
              animate={{ width: `${Math.max(xpBarWidth, 0)}%` }}
              transition={{ duration: barDuration, ease: "easeOut" }}
            >
              {isRewardEligible && (
                <div className="absolute inset-0 animate-shimmer-bar bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              )}
            </motion.div>
            {isRewardEligible && (
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  boxShadow: [
                    "inset 0 0 6px rgba(88,204,2,0.3)",
                    "inset 0 0 12px rgba(88,204,2,0.5)",
                    "inset 0 0 6px rgba(88,204,2,0.3)",
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
            className="relative w-full rounded-2xl border-b-4 border-green-700 bg-gradient-to-r from-brand-green to-emerald-500 py-4 font-heading text-lg font-extrabold text-white shadow-[0_0_30px_rgba(88,204,2,0.35)] transition-all duration-200 hover:shadow-[0_0_40px_rgba(88,204,2,0.5)] active:scale-[0.97] active:border-b-2"
          >
            <motion.div
              className="absolute inset-0 rounded-2xl bg-gradient-to-r from-brand-green/0 via-white/10 to-brand-green/0"
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

function GraduationOwl() {
  return (
    <motion.svg
      viewBox="0 0 100 90"
      className="h-24 w-24"
      fill="none"
      animate={{ y: [0, -3, 0] }}
      transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
    >
      <ellipse cx="14" cy="52" rx="11" ry="16" fill="#D4943D" transform="rotate(-20 14 52)" />
      <ellipse cx="86" cy="52" rx="11" ry="16" fill="#D4943D" transform="rotate(20 86 52)" />
      <ellipse cx="50" cy="58" rx="22" ry="20" fill="#E8E1D5" />
      <ellipse cx="50" cy="60" rx="16" ry="15" fill="#F5F0E8" />
      <circle cx="38" cy="48" r="10" fill="white" stroke="#888" strokeWidth="1.5" />
      <circle cx="62" cy="48" r="10" fill="white" stroke="#888" strokeWidth="1.5" />
      <line x1="48" y1="48" x2="52" y2="48" stroke="#888" strokeWidth="1.5" />
      <circle cx="39" cy="48" r="5" fill="#2D2D2D" />
      <circle cx="61" cy="48" r="5" fill="#2D2D2D" />
      <circle cx="40.5" cy="46.5" r="1.8" fill="white" />
      <circle cx="62.5" cy="46.5" r="1.8" fill="white" />
      <polygon points="50,52 47,57 53,57" fill="#E8734A" />
      <polygon points="28,32 33,44 22,38" fill="#C9B89E" />
      <polygon points="72,32 67,44 78,38" fill="#C9B89E" />
      <polygon points="50,18 30,28 50,34 70,28" fill="#2D2D2D" />
      <rect x="48" y="14" width="4" height="6" fill="#2D2D2D" />
      <line x1="70" y1="28" x2="72" y2="38" stroke="#FFD700" strokeWidth="1.5" />
      <circle cx="72" cy="39" r="2.5" fill="#FFD700" />
    </motion.svg>
  );
}

function TreasureChest() {
  return (
    <svg viewBox="0 0 160 110" className="h-28 w-40" fill="none">
      <ellipse cx="80" cy="105" rx="60" ry="6" fill="rgba(0,0,0,0.25)" />
      <rect x="20" y="50" width="120" height="50" rx="6" fill="url(#chestBody)" stroke="#8B6914" strokeWidth="2" />
      <path d="M18 52 Q80 10 142 52" fill="url(#chestLid)" stroke="#8B6914" strokeWidth="2" />
      <rect x="18" y="48" width="124" height="6" rx="2" fill="#DAA520" stroke="#8B6914" strokeWidth="1" />
      <rect x="20" y="72" width="120" height="4" rx="1" fill="#DAA520" opacity="0.6" />
      <rect x="72" y="46" width="16" height="14" rx="3" fill="#DAA520" stroke="#8B6914" strokeWidth="1.5" />
      <circle cx="80" cy="56" r="3" fill="#8B6914" />
      <StarShape cx={42} cy={68} r={5} fill="#58CC02" />
      <StarShape cx={80} cy={82} r={6} fill="#58CC02" />
      <StarShape cx={118} cy={68} r={5} fill="#58CC02" />
      <StarShape cx={55} cy={86} r={4} fill="#58CC02" opacity={0.7} />
      <StarShape cx={105} cy={86} r={4} fill="#58CC02" opacity={0.7} />
      <defs>
        <linearGradient id="chestBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4A9B3F" />
          <stop offset="50%" stopColor="#3D8535" />
          <stop offset="100%" stopColor="#2D6B28" />
        </linearGradient>
        <linearGradient id="chestLid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5BBF4E" />
          <stop offset="100%" stopColor="#3D8535" />
        </linearGradient>
      </defs>
    </svg>
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
            fill="#FFD700"
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
            "#FFD700",
            "#FFA500",
            "#FF6B6B",
            "#58CC02",
            "#7AC7C4",
            "#FF6BA8",
            "#4FC3F7",
            "#A855F7",
            "#F59E0B",
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
