"use client";

import { useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import type { LessonSessionSummary } from "@/lib/apiTypes";
import { useI18n } from "@/lib/i18n/useI18n";

interface LessonResultViewProps {
  resultSummary: LessonSessionSummary | null;
  accuracy: number;
  xpGained: number;
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
  displayLevel,
  currentXp,
  currentXpToNext,
  xpBarWidth,
  barDuration,
  onBackToMap,
}: LessonResultViewProps) {
  const { t } = useI18n();
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
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundColor: "#d9ecf6",
        backgroundImage: 'url("/backgrounds/SettlementBg.png")',
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      }}
    >
      <VictoryConfetti />
      <DecorativeStars />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center px-6 -mt-16">
        <div className="w-full rounded-3xl border border-white/50 bg-white/50 px-8 pt-10 pb-8 shadow-2xl backdrop-blur-xl">
        <motion.h1
          initial={{ opacity: 0, scale: 0.5, y: -30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 10, stiffness: 120, delay: 0.1 }}
          className="mb-4 bg-gradient-to-b from-[#7AC7C4] via-[#5fb3af] to-[#8dd4d1] bg-clip-text text-center font-heading text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl"
          style={{
            textShadow: "0 4px 18px rgba(122,199,196,0.25)",
          }}
        >
          {isRewardEligible ? t("lesson.cleared") : t("lesson.practiceCleared")}
        </motion.h1>

        {!isRewardEligible && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mb-5 rounded-full border border-[#9ecbd4]/30 bg-white/70 px-4 py-2 text-center text-sm font-semibold text-brand-gray-600 shadow-sm backdrop-blur"
          >
            {t("lesson.replayNote")}
          </motion.p>
        )}

        <motion.div
          initial={{ y: -160, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 11, stiffness: 140, delay: 0.3 }}
          className="relative mb-6"
        >
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
              <div className="mb-1 text-xs font-medium text-brand-gray-500">{t("lesson.accuracy")}</div>
              <div className="font-heading text-2xl font-extrabold tabular-nums text-brand-gray-700 sm:text-3xl">
                {accuracy}%
              </div>
            </div>
            <div className="mx-2 h-12 w-px self-center bg-[#9ecbd4]/30" />
            <div className="flex-1 text-center">
              <div className="mb-1 text-xs font-medium text-brand-gray-500">{t("lesson.time")}</div>
              <div className="font-heading text-2xl font-extrabold tabular-nums text-brand-gray-700 sm:text-3xl">
                {safeSummary.elapsedLabel ?? "0m 00s"}
              </div>
            </div>
            <div className="mx-2 h-12 w-px self-center bg-[#9ecbd4]/30" />
            <div className="flex-1 text-center">
              <div className="mb-1 text-xs font-medium text-brand-gray-500">
                {isRewardEligible ? t("lesson.xpGained") : t("lesson.reward")}
              </div>
              <div
                className={`font-heading text-2xl font-extrabold tabular-nums sm:text-3xl ${
                  isRewardEligible ? "text-[#D4A96A]" : "text-brand-gray-400"
                }`}
              >
                {isRewardEligible ? `+${xpGained} XP` : t("lesson.noXp")}
              </div>
            </div>
          </div>


          <div className="mb-1 flex items-center justify-between px-0.5 text-[10px] font-bold text-brand-gray-500">
            <span>{t("lesson.lv")}{displayLevel}</span>
            <span className="tabular-nums">
              {Math.round(currentXp)} / {currentXpToNext} XP
            </span>
            <span>{t("lesson.lv")}{displayLevel + 1}</span>
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded-full border border-[#4a9e9b]/60 bg-white/60">
            <motion.div
              className={`relative h-full rounded-full ${
                isRewardEligible
                  ? "bg-gradient-to-r from-[#86c46b] via-[#5fb3af] to-[#F4B860] shadow-[0_0_12px_rgba(134,196,107,0.45)]"
                  : "bg-gradient-to-r from-[#bfe1e0]/70 via-[#a8d5d3]/70 to-[#bfe1e0]/70"
              }`}
              animate={{ width: `${Math.max(xpBarWidth, 0)}%` }}
              transition={{ duration: barDuration, ease: "easeOut" }}
            >
              {isRewardEligible && (
                <div className="absolute inset-0 animate-shimmer-bar bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              )}
            </motion.div>
            {isRewardEligible && (
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  boxShadow: [
                    "inset 0 0 6px rgba(134,196,107,0.35)",
                    "inset 0 0 14px rgba(244,184,96,0.55)",
                    "inset 0 0 6px rgba(134,196,107,0.35)",
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
            <span className="relative z-10">{t("lesson.backToMap")}</span>
          </button>
        </motion.div>
        </div>
      </div>
    </div>
  );
}

function VictoryTrophy() {
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut" }}
    >
      <Image
        src="/pattern/Trophy.png"
        alt="trophy"
        width={176}
        height={176}
        className="h-44 w-44 object-contain drop-shadow-[0_8px_24px_rgba(212,169,106,0.45)]"
        priority
        onError={(e) => {
          // fallback to SVG emoji if trophy.png is not yet present
          const img = e.currentTarget;
          img.style.display = "none";
          const svg = img.nextElementSibling as HTMLElement | null;
          if (svg) svg.style.display = "block";
        }}
      />
      <span
        style={{ display: "none", fontSize: "9rem", lineHeight: 1 }}
        role="img"
        aria-label="trophy"
      >
        🏆
      </span>
    </motion.div>
  );
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

const CONFETTI_COLORS = [
  "#7AC7C4", "#D4A96A", "#F4D88B", "#5fb3af",
  "#9ecbd4", "#E8B978", "#8AD0CC", "#F0C893", "#4a9e9b",
];

function VictoryConfetti() {
  const particles = useMemo(
    () =>
      Array.from({ length: 120 }, (_, i) => {
        const duration = 3 + Math.random() * 3;
        return {
          id: i,
          x: Math.random() * 100,
          duration,
          // negative delay pre-offsets each particle into its cycle so the
          // screen is already filled with confetti on first render
          delay: -(Math.random() * duration),
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          width: 4 + Math.random() * 4,
          height: 14 + Math.random() * 16,
          driftX: (Math.random() - 0.5) * 60,
          rotationEnd: 360 + Math.random() * 720,
        };
      }),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: 0,
            width: p.width,
            height: p.height,
            borderRadius: "2px",
            backgroundColor: p.color,
          }}
          animate={{
            // start just above viewport, fall to well below it
            y: ["-5vh", "110vh"],
            x: [0, p.driftX],
            rotate: [0, p.rotationEnd],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatType: "loop",
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}
