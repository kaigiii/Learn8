"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { clampJobProgress, formatJobProgressLabel } from "@/lib/jobs/presentation";

/**
 * Smoothly animates a "simulated" progress value toward a real target using
 * an asymptotic crawl with a buffer past the real target — so when the backend
 * gets stuck at e.g. 30%, the bar still creeps forward visibly (up to ~30+BUFFER)
 * but never overshoots wildly. When the backend reports 100, the bar can finish.
 */
function useSimulatedProgress(realProgress: number | null): number {
  const TICK_MS = 60;
  const DECAY = 0.018;       // fraction of remaining gap per tick — smooth slowdown
  const FLOOR_SPEED = 0.04;  // % per tick — guarantees visible motion even near ceiling
  const MAX_STEP = 0.7;      // % per tick cap — keeps motion smooth on big jumps
  const BUFFER = 18;         // how many % past the real target the bar may creep
  const HARD_CAP = 99;       // never finish unless backend explicitly says 100

  const simRef = useRef<number>(0);
  const targetRef = useRef<number>(0);
  const [sim, setSim] = useState<number>(0);

  useEffect(() => {
    targetRef.current = realProgress ?? 0;
  }, [realProgress]);

  useEffect(() => {
    const id = setInterval(() => {
      const target = targetRef.current;
      // If backend says 100, finish naturally — no buffer cap
      const ceiling = target >= 100
        ? 100
        : Math.min(HARD_CAP, target + BUFFER);
      if (simRef.current >= ceiling) return;
      const gap = ceiling - simRef.current;
      const speed = Math.min(MAX_STEP, Math.max(FLOOR_SPEED, gap * DECAY));
      simRef.current = Math.min(simRef.current + speed, ceiling);
      setSim(simRef.current);
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  return sim;
}

const STEPS = [
  "Scanning document...",
  "Extracting key concepts...",
  "Building knowledge graph...",
  "Forging interactive stages...",
  "Polishing your universe...",
];

const STEP_DURATION = 2000;
const NOISE_TEXTURE =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27 viewBox=%270 0 160 160%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%271.05%27 numOctaves=%272%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27160%27 height=%27160%27 filter=%27url(%2523n)%27 opacity=%270.9%27/%3E%3C/svg%3E")';

const FORGE_PARTICLES = [
  { left: "8%", bottom: "10%", size: 4, color: "#7AC7C4", duration: "8s", delay: "0.2s", floatX: "18px", floatY: "-72px", opacity: 0.3 },
  { left: "16%", bottom: "4%", size: 3, color: "#D4A96A", duration: "11s", delay: "1.4s", floatX: "-10px", floatY: "-88px", opacity: 0.22 },
  { left: "24%", bottom: "12%", size: 5, color: "#7AC7C4", duration: "9s", delay: "2.1s", floatX: "26px", floatY: "-96px", opacity: 0.24 },
  { left: "35%", bottom: "6%", size: 3, color: "#D4A96A", duration: "10s", delay: "0.8s", floatX: "12px", floatY: "-76px", opacity: 0.2 },
  { left: "47%", bottom: "8%", size: 4, color: "#7AC7C4", duration: "12s", delay: "1.9s", floatX: "-18px", floatY: "-102px", opacity: 0.26 },
  { left: "59%", bottom: "5%", size: 5, color: "#D4A96A", duration: "8.5s", delay: "0.6s", floatX: "22px", floatY: "-82px", opacity: 0.23 },
  { left: "68%", bottom: "11%", size: 3, color: "#7AC7C4", duration: "10.5s", delay: "2.7s", floatX: "-14px", floatY: "-92px", opacity: 0.28 },
  { left: "79%", bottom: "7%", size: 4, color: "#D4A96A", duration: "9.5s", delay: "1.1s", floatX: "16px", floatY: "-86px", opacity: 0.22 },
  { left: "88%", bottom: "9%", size: 3, color: "#7AC7C4", duration: "11.5s", delay: "2.3s", floatX: "-8px", floatY: "-78px", opacity: 0.2 },
];

const FORGE_SPARKLES = [
  { left: "14%", top: "18%", size: 5, color: "#D4A96A", duration: "3.2s", delay: "0.4s", opacity: 0.18 },
  { left: "28%", top: "32%", size: 4, color: "#7AC7C4", duration: "2.8s", delay: "1.1s", opacity: 0.16 },
  { left: "42%", top: "14%", size: 6, color: "#D4A96A", duration: "3.6s", delay: "1.8s", opacity: 0.18 },
  { left: "58%", top: "27%", size: 4, color: "#7AC7C4", duration: "3s", delay: "0.9s", opacity: 0.17 },
  { left: "71%", top: "20%", size: 5, color: "#D4A96A", duration: "3.4s", delay: "2.2s", opacity: 0.15 },
  { left: "84%", top: "30%", size: 4, color: "#7AC7C4", duration: "2.9s", delay: "0.6s", opacity: 0.16 },
];

export default function ForgeStatus({
  error,
  subtitle,
  title,
  statusMessage,
  progress,
  actions,
}: {
  error?: string;
  subtitle?: string;
  title?: string;
  statusMessage?: string;
  progress?: number;
  actions?: React.ReactNode;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const hasLiveStatus = typeof progress === "number" || !!statusMessage;
  const safeProgress = typeof progress === "number" ? clampJobProgress(progress) : null;
  const simulatedProgress = useSimulatedProgress(safeProgress);
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
  const displayedProgress = safeProgress !== null ? simulatedProgress : fallbackProgress;
  const activeStepCount = Math.max(
    1,
    Math.min(
      STEPS.length,
      safeProgress !== null
        ? Math.ceil((simulatedProgress / 100) * STEPS.length)
        : stepIdx + 1
      )
  );
  const progressLabel =
    safeProgress !== null
      ? formatJobProgressLabel(Math.round(simulatedProgress))
      : `${Math.round(displayedProgress)}%`;

  return (
    <div
      className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden px-6 py-12 md:px-10"
      style={{
        backgroundColor: "#d9ecf6",
        backgroundImage:
          'linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.1)), url("/backgrounds/ForgingBg.png")',
        backgroundPosition: "center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      }}
    >
      <ForgeAtmosphere />

      <div className="relative z-10 flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-9 px-8 py-12 md:px-14 md:py-16">
        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          className="relative h-80 w-80 md:h-[24rem] md:w-[24rem]"
        >
          <ForgeCore progress={displayedProgress} />
        </motion.div>

        <div className="flex min-h-10 items-center">
          <motion.p
            key={hasLiveStatus ? displayedTitle : stepIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-center text-2xl font-bold tracking-wide text-brand-gray-700 md:text-4xl"
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

        <div className="w-full max-w-2xl">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="truncate text-sm text-brand-gray-500 md:text-base">
              {displayedMessage}
            </p>
            <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.22em] text-brand-teal/80">
              {progressLabel}
            </p>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-white/50">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand-teal to-[#5fb3af]"
              animate={{ width: `${displayedProgress}%` }}
              transition={{ duration: 0.12 }}
            />
          </div>
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ForgeAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute left-[-10%] top-[-10%] h-48 w-48 rounded-full bg-white/30 blur-3xl" />
      <div className="absolute bottom-[-12%] right-[-8%] h-56 w-56 rounded-full bg-brand-teal/20 blur-3xl" />
      <div className="absolute left-[18%] top-[22%] h-72 w-72 rounded-full bg-brand-teal/10 blur-3xl" />
      <div className="absolute bottom-[16%] right-[18%] h-80 w-80 rounded-full bg-[#D4A96A]/10 blur-3xl" />

      <div
        className="absolute inset-0 opacity-[0.08] mix-blend-soft-light"
        style={{
          backgroundImage: NOISE_TEXTURE,
          backgroundSize: "180px 180px",
        }}
      />

      {FORGE_PARTICLES.map((particle, index) => (
        <div
          key={`forge-particle-${index}`}
          className="particle absolute rounded-full"
          style={
            {
              left: particle.left,
              bottom: particle.bottom,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              background: particle.color,
              opacity: particle.opacity,
              "--duration": particle.duration,
              "--delay": particle.delay,
              "--drift": particle.floatX,
            } as React.CSSProperties
          }
        />
      ))}

      {FORGE_SPARKLES.map((sparkle, index) => (
        <div
          key={`forge-sparkle-${index}`}
          className="sparkle absolute rounded-full"
          style={
            {
              left: sparkle.left,
              top: sparkle.top,
              width: `${sparkle.size}px`,
              height: `${sparkle.size}px`,
              background: sparkle.color,
              opacity: sparkle.opacity,
              "--duration": sparkle.duration,
              "--delay": sparkle.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

function ForgeCore({ progress }: { progress: number }) {
  const glowStrength = 0.18 + progress * 0.0025;
  const orbitNodes = [
    { angle: 0, color: "#7AC7C4", radius: 110, dur: "2.2s" },
    { angle: 60, color: "#D4A96A", radius: 110, dur: "2.6s" },
    { angle: 120, color: "#7AC7C4", radius: 110, dur: "2.4s" },
    { angle: 180, color: "#D4A96A", radius: 110, dur: "2.8s" },
    { angle: 240, color: "#7AC7C4", radius: 110, dur: "2.3s" },
    { angle: 300, color: "#D4A96A", radius: 110, dur: "2.5s" },
  ];

  return (
    <div className="relative h-full w-full">
      <div
        className="absolute inset-0 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, rgba(122,199,196,${glowStrength}) 0%, rgba(212,169,106,${0.1 + progress * 0.002}) 45%, transparent 72%)`,
        }}
      />

      <svg viewBox="0 0 400 400" className="h-full w-full" fill="none">
        <defs>
          <path
            id="forge-rune-ring"
            d="M 200,200 m -160,0 a 160,160 0 1,1 320,0 a 160,160 0 1,1 -320,0"
          />
          <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="35%" stopColor="#A8DDDB" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#5fb3af" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="crystal-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#9BD6D3" />
            <stop offset="100%" stopColor="#4a9e9b" />
          </linearGradient>
          <linearGradient id="crystal-shine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="forge-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7AC7C4" />
            <stop offset="100%" stopColor="#D4A96A" />
          </linearGradient>
        </defs>

        {/* outer subtle ring */}
        <circle cx="200" cy="200" r="175" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.45" />
        <circle cx="200" cy="200" r="158" fill="none" stroke="#7AC7C4" strokeWidth="1" strokeDasharray="3 6" opacity="0.5" />

        {/* slow rotating runic ring */}
        <g opacity="0.32">
          <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="50s" repeatCount="indefinite" />
          <text fill="#7AC7C4" fontSize="11" fontWeight="500" letterSpacing="6">
            <textPath href="#forge-rune-ring">
              ✦ KNOWLEDGE ✦ WISDOM ✦ INSIGHT ✦ DISCOVERY ✦ MASTERY ✦ INSIGHT ✦
            </textPath>
          </text>
        </g>

        {/* orbital paths */}
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="22s" repeatCount="indefinite" />
          <ellipse cx="200" cy="200" rx="110" ry="42" fill="none" stroke="url(#forge-ring-grad)" strokeWidth="1.2" opacity="0.45" />
        </g>
        <g>
          <animateTransform attributeName="transform" type="rotate" from="60 200 200" to="-300 200 200" dur="26s" repeatCount="indefinite" />
          <ellipse cx="200" cy="200" rx="110" ry="42" fill="none" stroke="#D4A96A" strokeWidth="1" opacity="0.35" />
        </g>
        <g>
          <animateTransform attributeName="transform" type="rotate" from="-30 200 200" to="330 200 200" dur="30s" repeatCount="indefinite" />
          <ellipse cx="200" cy="200" rx="110" ry="42" fill="none" stroke="#7AC7C4" strokeWidth="1" opacity="0.3" />
        </g>

        {/* orbiting concept nodes - spinning around center */}
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="14s" repeatCount="indefinite" />
          {orbitNodes.map((n, i) => {
            const rad = (n.angle * Math.PI) / 180;
            const x = 200 + n.radius * Math.cos(rad);
            const y = 200 + n.radius * Math.sin(rad);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="6" fill={n.color} opacity="0.25" />
                <circle cx={x} cy={y} r="3.5" fill={n.color}>
                  <animate attributeName="opacity" values="0.7;1;0.7" dur={n.dur} repeatCount="indefinite" />
                </circle>
                <circle cx={x} cy={y} r="1.6" fill="white" opacity="0.95" />
              </g>
            );
          })}
        </g>

        {/* central glow */}
        <circle cx="200" cy="200" r="70" fill="url(#core-glow)">
          <animate attributeName="r" values="64;72;64" dur="3.2s" repeatCount="indefinite" />
        </circle>

        {/* central crystal (diamond) */}
        <g>
          <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="18s" repeatCount="indefinite" />
          <polygon
            points="200,158 226,200 200,250 174,200"
            fill="url(#crystal-grad)"
            stroke="#4a9e9b"
            strokeWidth="1.2"
            opacity="0.92"
          />
          <polygon points="200,158 226,200 200,200" fill="#FFFFFF" opacity="0.35" />
          <polygon points="200,158 174,200 200,200" fill="url(#crystal-shine)" opacity="0.6" />
          <polygon points="174,200 200,200 200,250" fill="#FFFFFF" opacity="0.12" />
        </g>

        {/* central pulse highlight */}
        <circle cx="200" cy="200" r="6" fill="#FFFFFF" opacity="0.85">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="r" values="5;8;5" dur="1.8s" repeatCount="indefinite" />
        </circle>

        {/* floating sparkles */}
        {[
          [128, 130, "#D4A96A", "3s", "0s"],
          [275, 142, "#7AC7C4", "2.5s", "0.6s"],
          [120, 270, "#7AC7C4", "3.2s", "1.1s"],
          [290, 270, "#D4A96A", "2.8s", "0.4s"],
          [200, 100, "#7AC7C4", "3.5s", "1.4s"],
          [200, 308, "#D4A96A", "3s", "0.9s"],
        ].map(([cx, cy, color, duration, delay], i) => (
          <g key={i}>
            <circle cx={Number(cx)} cy={Number(cy)} r="2.4" fill={String(color)} opacity="0">
              <animate attributeName="opacity" values="0;0.9;0" dur={String(duration)} begin={String(delay)} repeatCount="indefinite" />
            </circle>
            <circle cx={Number(cx)} cy={Number(cy)} r="5" fill={String(color)} opacity="0">
              <animate attributeName="opacity" values="0;0.3;0" dur={String(duration)} begin={String(delay)} repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
}
