"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import GameButton from "@/components/ui/GameButton";
import { apiFetch } from "@/lib/api";
import useArenaStore, { getAccuracy, getElapsedTime, getXpGained } from "@/stores/useArenaStore";
import useUserStore from "@/stores/useUserStore";

/* ═══════════════════ Rolling Counter Hook ═══════════════════ */

function useRollingNumber(target: number, duration = 1200, delay = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return value;
}

/* ═══════════════════ Page ═══════════════════ */

export default function ResultClient({
  courseId: explicitCourseId,
  nodeId: explicitNodeId,
}: {
  courseId?: string;
  nodeId?: string;
} = {}) {
  const router = useRouter();
  const params = useParams();
  const nodeId = explicitNodeId ?? (params.nodeId as string);
  const routeCourseId = explicitCourseId ?? (params.courseId as string | undefined);
  const [backendCourseId, setBackendCourseId] = useState<string | null>(null);
  const isBackendCourse = !!backendCourseId && /^\d+$/.test(backendCourseId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const searchCourseId = new URLSearchParams(window.location.search).get("courseId");
    const resolvedCourseId =
      routeCourseId && /^\d+$/.test(routeCourseId)
        ? routeCourseId
        : searchCourseId;
    setBackendCourseId(
      resolvedCourseId && /^\d+$/.test(resolvedCourseId)
        ? resolvedCourseId
        : null
    );
  }, [routeCourseId]);

  // Stores
  const arenaState = useArenaStore();
  const addXp = useUserStore((s) => s.addXp);
  const endSession = useArenaStore((s) => s.endSession);

  // Derived values from arena
  const actualAccuracy = getAccuracy(arenaState);
  const actualTime = getElapsedTime(arenaState);
  const actualXp = getXpGained(arenaState);

  // Ref to capture user state RIGHT BEFORE addXp (set inside effect, not at render time)
  const prevUserRef = useRef<{ xp: number; level: number; xpToNext: number } | null>(null);

  // End session & reward on mount (once)
  const [rewarded, setRewarded] = useState(false);
  useEffect(() => {
    if (!rewarded) {
      // Snapshot BEFORE reward so animation knows the starting point
      const snap = useUserStore.getState();
      prevUserRef.current = { xp: snap.xp, level: snap.level, xpToNext: snap.xpToNextLevel };

      endSession();
      addXp(actualXp);

      setRewarded(true);
    }
  }, [rewarded, endSession, addXp, actualXp]);

  useEffect(() => {
    if (!rewarded || !isBackendCourse || !backendCourseId || !nodeId) return;

    void apiFetch(`/courses/${backendCourseId}/node/${nodeId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
  }, [rewarded, isBackendCourse, backendCourseId, nodeId]);

  // Read user state AFTER reward (reactive)
  const currentXp = useUserStore((s) => s.xp);
  const currentLevel = useUserStore((s) => s.level);
  const currentXpToNext = useUserStore((s) => s.xpToNextLevel);

  const courseId = backendCourseId!;

  // Bar state — starts at 0; will be set to correct start position when animation begins
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [xpBarWidth, setXpBarWidth] = useState(0);
  const [barDuration, setBarDuration] = useState(0);   // 0 = instant (no visible animation for initial placement)
  const [displayLevel, setDisplayLevel] = useState(1);

  const accuracy = useRollingNumber(actualAccuracy, 1000, 1200);
  const xpGained = useRollingNumber(actualXp, 1000, 1200);

  if (!isBackendCourse) {
    return (
      <div className="relative min-h-screen bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f0f23]">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
          <div className="rounded-3xl border border-amber-200 bg-white/10 px-6 py-5 text-sm text-white shadow-lg backdrop-blur">
            Invalid result route.
          </div>
        </div>
      </div>
    );
  }

  // Multi-phase XP bar animation — fires AFTER reward so store is up-to-date.
  const animStarted = useRef(false);
  useEffect(() => {
    if (!rewarded || animStarted.current || !prevUserRef.current) return;
    animStarted.current = true;

    const prev = prevUserRef.current;
    const post = useUserStore.getState();
    const leveled = post.level > prev.level;
    const startPct = prev.xpToNext > 0 ? (prev.xp / prev.xpToNext) * 100 : 0;
    const endPct = post.xpToNextLevel > 0 ? (post.xp / post.xpToNextLevel) * 100 : 0;

    // Phase 0 (instant): jump bar to pre-reward position & set level label
    setDisplayLevel(prev.level);
    setBarDuration(0);
    setXpBarWidth(startPct);

    if (leveled) {
      // Phase 1: fill current bar to 100%
      const t1 = setTimeout(() => {
        setBarDuration(1.0);
        setXpBarWidth(100);
      }, 1800);
      // Phase 2: show "Level Up!" text
      const t2 = setTimeout(() => setShowLevelUp(true), 3000);
      // Phase 3: instant reset to 0% & update level label
      const t3 = setTimeout(() => {
        setBarDuration(0);
        setXpBarWidth(0);
        setDisplayLevel(post.level);
      }, 3600);
      // Phase 4: animate to new XP position
      const t4 = setTimeout(() => {
        setBarDuration(0.8);
        setXpBarWidth(endPct);
      }, 3750);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    } else {
      // No level up: smoothly fill from prev to current
      const t = setTimeout(() => {
        setBarDuration(1.2);
        setXpBarWidth(endPct);
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [rewarded]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* ─── Dark background with spotlight ─── */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f0f23]" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,215,0,0.15) 0%, rgba(255,180,50,0.06) 40%, transparent 70%)",
        }}
      />

      {/* ─── Confetti ─── */}
      <VictoryConfetti />

      {/* ─── Decorative corner stars ─── */}
      <DecorativeStars />

      {/* ─── Content ─── */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-lg px-6">
        {/* LESSON CLEARED! */}
        <motion.h1
          initial={{ opacity: 0, scale: 0.5, y: -30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", damping: 10, stiffness: 120, delay: 0.1 }}
          className="font-heading font-extrabold text-4xl sm:text-5xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-500 mb-4 text-center tracking-tight"
          style={{
            textShadow: "0 0 40px rgba(255,215,0,0.4), 0 2px 8px rgba(0,0,0,0.6)",
            WebkitTextStroke: "0.5px rgba(255,215,0,0.3)",
          }}
        >
          LESSON CLEARED!
        </motion.h1>

        {/* ─── Owl + Chest assembly ─── */}
        <motion.div
          initial={{ y: -160, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 11, stiffness: 140, delay: 0.3 }}
          className="relative mb-6"
        >
          {/* Glow behind chest */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-52 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,215,0,0.25) 0%, rgba(255,180,50,0.08) 50%, transparent 70%)",
            }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          />

          {/* Owl with graduation cap */}
          <div className="relative z-10 flex flex-col items-center">
            <GraduationOwl />
            <div className="-mt-4">
              <TreasureChest />
            </div>
          </div>
        </motion.div>

        {/* ─── Stats Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 180, delay: 0.7 }}
          className="w-full rounded-2xl bg-white/10 backdrop-blur-xl border border-white/15 p-5 mb-5 shadow-lg shadow-black/20"
        >
          {/* Stats row */}
          <div className="flex justify-between items-start mb-4">
            {/* Accuracy */}
            <div className="flex-1 text-center">
              <div className="text-xs text-white/50 font-medium mb-1">Accuracy:</div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl text-white tabular-nums">
                {accuracy}%
              </div>
            </div>
            {/* Divider */}
            <div className="w-px h-12 bg-white/10 mx-2 self-center" />
            {/* Time */}
            <div className="flex-1 text-center">
              <div className="text-xs text-white/50 font-medium mb-1">Time:</div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl text-white tabular-nums">
                {actualTime}
              </div>
            </div>
            {/* Divider */}
            <div className="w-px h-12 bg-white/10 mx-2 self-center" />
            {/* XP */}
            <div className="flex-1 text-center">
              <div className="text-xs text-white/50 font-medium mb-1">XP Gained:</div>
              <div className="font-heading font-extrabold text-2xl sm:text-3xl text-amber-300 tabular-nums">
                +{xpGained} XP
              </div>
            </div>
          </div>

          {/* Level Up! flash */}
          <AnimatePresence>
            {showLevelUp && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-right mb-2"
              >
                <span
                  className="font-heading font-extrabold text-lg italic bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400"
                  style={{ textShadow: "0 0 20px rgba(255,215,0,0.5)" }}
                >
                  Level Up!
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* XP progress bar */}
          <div className="flex items-center justify-between text-[10px] text-white/40 font-bold mb-1 px-0.5">
            <span>Lv.{displayLevel}</span>
            <span className="tabular-nums">
              {Math.round(currentXp)} / {currentXpToNext} XP
            </span>
            <span>Lv.{displayLevel + 1}</span>
          </div>
          <div className="w-full h-5 rounded-full bg-black/30 border border-white/10 overflow-hidden relative">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand-green via-emerald-400 to-brand-green relative"
              animate={{ width: `${Math.max(xpBarWidth, 0)}%` }}
              transition={{ duration: barDuration, ease: "easeOut" }}
            >
              {/* Shimmer effect on bar */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer-bar" />
            </motion.div>
            {/* Glow */}
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
          </div>
        </motion.div>

        {/* ─── Back to Map button ─── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="w-full"
        >
          <button
            onClick={() =>
              router.push(`/courses/${courseId}`)
            }
            className="relative w-full py-4 rounded-2xl font-heading font-extrabold text-lg text-white 
              bg-gradient-to-r from-brand-green to-emerald-500 
              border-b-4 border-green-700
              shadow-[0_0_30px_rgba(88,204,2,0.35)] 
              hover:shadow-[0_0_40px_rgba(88,204,2,0.5)] 
              active:scale-[0.97] active:border-b-2
              transition-all duration-200"
          >
            {/* Button glow pulse */}
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

/* ═══════════════════ Graduation Owl ═══════════════════ */

function GraduationOwl() {
  return (
    <motion.svg
      viewBox="0 0 100 90"
      className="h-24 w-24"
      fill="none"
      animate={{ y: [0, -3, 0] }}
      transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
    >
      {/* Wings spread */}
      <ellipse cx="14" cy="52" rx="11" ry="16" fill="#D4943D" transform="rotate(-20 14 52)" />
      <ellipse cx="86" cy="52" rx="11" ry="16" fill="#D4943D" transform="rotate(20 86 52)" />
      {/* Body */}
      <ellipse cx="50" cy="58" rx="22" ry="20" fill="#E8E1D5" />
      <ellipse cx="50" cy="60" rx="16" ry="15" fill="#F5F0E8" />
      {/* Eyes with glasses */}
      <circle cx="38" cy="48" r="10" fill="white" stroke="#888" strokeWidth="1.5" />
      <circle cx="62" cy="48" r="10" fill="white" stroke="#888" strokeWidth="1.5" />
      <line x1="48" y1="48" x2="52" y2="48" stroke="#888" strokeWidth="1.5" />
      <circle cx="39" cy="48" r="5" fill="#2D2D2D" />
      <circle cx="61" cy="48" r="5" fill="#2D2D2D" />
      <circle cx="40.5" cy="46.5" r="1.8" fill="white" />
      <circle cx="62.5" cy="46.5" r="1.8" fill="white" />
      {/* Beak */}
      <polygon points="50,52 47,57 53,57" fill="#E8734A" />
      {/* Ear tufts */}
      <polygon points="28,32 33,44 22,38" fill="#C9B89E" />
      <polygon points="72,32 67,44 78,38" fill="#C9B89E" />
      {/* Graduation cap */}
      <polygon points="50,18 30,28 50,34 70,28" fill="#2D2D2D" />
      <rect x="48" y="14" width="4" height="6" fill="#2D2D2D" />
      <line x1="70" y1="28" x2="72" y2="38" stroke="#FFD700" strokeWidth="1.5" />
      <circle cx="72" cy="39" r="2.5" fill="#FFD700" />
    </motion.svg>
  );
}

/* ═══════════════════ Treasure Chest ═══════════════════ */

function TreasureChest() {
  return (
    <svg viewBox="0 0 160 110" className="h-28 w-40" fill="none">
      {/* Shadow */}
      <ellipse cx="80" cy="105" rx="60" ry="6" fill="rgba(0,0,0,0.25)" />
      {/* Chest body */}
      <rect x="20" y="50" width="120" height="50" rx="6" fill="url(#chestBody)" stroke="#8B6914" strokeWidth="2" />
      {/* Chest lid */}
      <path d="M18 52 Q80 10 142 52" fill="url(#chestLid)" stroke="#8B6914" strokeWidth="2" />
      {/* Gold trim bands */}
      <rect x="18" y="48" width="124" height="6" rx="2" fill="#DAA520" stroke="#8B6914" strokeWidth="1" />
      <rect x="20" y="72" width="120" height="4" rx="1" fill="#DAA520" opacity="0.6" />
      {/* Lock clasp */}
      <rect x="72" y="46" width="16" height="14" rx="3" fill="#DAA520" stroke="#8B6914" strokeWidth="1.5" />
      <circle cx="80" cy="56" r="3" fill="#8B6914" />
      {/* Stars on chest */}
      <StarShape cx={42} cy={68} r={5} fill="#58CC02" />
      <StarShape cx={80} cy={82} r={6} fill="#58CC02" />
      <StarShape cx={118} cy={68} r={5} fill="#58CC02" />
      <StarShape cx={55} cy={86} r={4} fill="#58CC02" opacity={0.7} />
      <StarShape cx={105} cy={86} r={4} fill="#58CC02" opacity={0.7} />
      {/* Gradient defs */}
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

function StarShape({ cx, cy, r, fill, opacity = 1 }: { cx: number; cy: number; r: number; fill: string; opacity?: number }) {
  const points = Array.from({ length: 5 }, (_, i) => {
    const outerAngle = (i * 72 - 90) * (Math.PI / 180);
    const innerAngle = ((i * 72 + 36) - 90) * (Math.PI / 180);
    const ox = cx + r * Math.cos(outerAngle);
    const oy = cy + r * Math.sin(outerAngle);
    const ix = cx + r * 0.4 * Math.cos(innerAngle);
    const iy = cy + r * 0.4 * Math.sin(innerAngle);
    return `${ox},${oy} ${ix},${iy}`;
  }).join(" ");
  return <polygon points={points} fill={fill} opacity={opacity} />;
}

/* ═══════════════════ Decorative Stars ═══════════════════ */

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
          transition={{
            delay: s.delay,
            duration: 1.5,
            ease: "easeOut",
          }}
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

/* ═══════════════════ Victory Confetti ═══════════════════ */

function VictoryConfetti() {
  const particles = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => {
        const isStreak = i < 20; // first 20 are "firework streak" particles
        return {
          id: i,
          x: isStreak ? 40 + Math.random() * 20 : Math.random() * 100,
          startY: isStreak ? 45 : -5,
          endY: isStreak ? -10 + Math.random() * 30 : 110,
          delay: isStreak ? Math.random() * 0.3 : 0.2 + Math.random() * 1.5,
          duration: isStreak ? 0.6 + Math.random() * 0.5 : 2 + Math.random() * 2.5,
          color: [
            "#FFD700", "#FFA500", "#FF6B6B", "#58CC02", "#7AC7C4",
            "#FF6BA8", "#4FC3F7", "#A855F7", "#F59E0B",
          ][i % 9],
          size: isStreak ? 3 + Math.random() * 3 : 4 + Math.random() * 8,
          rotation: Math.random() * 360,
          spreadX: isStreak
            ? (Math.random() - 0.5) * 60
            : 0,
        };
      }),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-[2]">
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
