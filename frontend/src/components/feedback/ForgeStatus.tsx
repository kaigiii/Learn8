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
  const progressLabel =
    safeProgress !== null
      ? formatJobProgressLabel(safeProgress)
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
              transition={{ duration: 0.4 }}
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
  const glowStrength = 0.12 + progress * 0.002;

  return (
    <div className="relative h-full w-full">
      <div
        className="absolute inset-0 rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, rgba(122,199,196,${glowStrength}) 0%, rgba(212,169,106,${0.08 + progress * 0.0018}) 50%, transparent 72%)`,
        }}
      />

      <svg viewBox="0 0 400 400" className="h-full w-full" fill="none">
        <defs>
          <path
            id="forge-rune-ring"
            d="M 200,200 m -155,0 a 155,155 0 1,1 310,0 a 155,155 0 1,1 -310,0"
          />
          <radialGradient id="forge-anvil-glow" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#FFD5B0" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#F5C8A0" stopOpacity="0.2" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="forge-anvil-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8D5B7" />
            <stop offset="100%" stopColor="#C4A882" />
          </linearGradient>
          <linearGradient id="forge-anvil-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F0E0CC" />
            <stop offset="100%" stopColor="#D4B896" />
          </linearGradient>
          <linearGradient id="forge-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7AC7C4" />
            <stop offset="100%" stopColor="#D4A96A" />
          </linearGradient>
        </defs>

        <circle cx="200" cy="200" r="170" fill="none" stroke="#FFFFFF" strokeWidth="1.1" opacity="0.5" />
        <circle cx="200" cy="200" r="152" fill="none" stroke="#7AC7C4" strokeWidth="1.2" strokeDasharray="5 5" opacity="0.5" />

        <g opacity="0.28">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 200 200"
            to="360 200 200"
            dur="40s"
            repeatCount="indefinite"
          />
          <text fill="#C4A87A" fontSize="13" fontWeight="500" letterSpacing="5">
            <textPath href="#forge-rune-ring">
              ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟ
            </textPath>
          </text>
        </g>

        <circle cx="200" cy="200" r="120" fill="url(#forge-anvil-glow)" />

        <rect x="155" y="280" width="90" height="35" rx="4" fill="url(#forge-anvil-body)" />
        <rect x="170" y="260" width="60" height="24" rx="3" fill="#D4B896" />
        <path
          d="M120 260 Q125 230 140 225 L155 220 L155 240 Q165 250 200 250 Q235 250 245 240 L245 220 L260 225 Q275 230 280 260 Z"
          fill="url(#forge-anvil-top)"
        />
        <path
          d="M120 260 Q105 255 90 248 Q85 246 88 244 Q95 240 120 245 Z"
          fill="#D4B896"
        />
        <path
          d="M140 225 L155 220 L155 240 Q165 250 200 250 Q235 250 245 240 L245 220 L260 225 Q255 228 245 230 Q220 238 200 238 Q180 238 155 230 Q145 228 140 225 Z"
          fill="white"
          opacity="0.16"
        />

        {[
          [170, 185], [200, 170], [230, 185],
          [155, 210], [200, 200], [245, 210],
          [175, 230], [225, 230],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="4" fill="#7AC7C4" opacity="0.5">
              <animate
                attributeName="opacity"
                values="0.3;0.7;0.3"
                dur={`${1.5 + i * 0.3}s`}
                repeatCount="indefinite"
              />
            </circle>
            <circle cx={cx} cy={cy} r="2" fill="white" opacity="0.6" />
          </g>
        ))}

        {[
          [170, 185, 200, 170], [200, 170, 230, 185],
          [155, 210, 200, 200], [200, 200, 245, 210],
          [170, 185, 155, 210], [230, 185, 245, 210],
          [170, 185, 200, 200], [200, 200, 230, 185],
          [155, 210, 175, 230], [245, 210, 225, 230],
          [175, 230, 200, 200], [225, 230, 200, 200],
        ].map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#7AC7C4"
            strokeWidth="1"
            opacity="0.24"
          />
        ))}

        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 200 210"
            to="360 200 210"
            dur="6s"
            repeatCount="indefinite"
          />
          <ellipse cx="200" cy="210" rx="90" ry="30" fill="none" stroke="url(#forge-ring-grad)" strokeWidth="1.5" opacity="0.32" />
          <circle cx="290" cy="210" r="3" fill="#7AC7C4" opacity="0.7">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>

        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 200 210"
            to="-360 200 210"
            dur="8s"
            repeatCount="indefinite"
          />
          <ellipse cx="200" cy="210" rx="105" ry="22" fill="none" stroke="#D4A96A" strokeWidth="1" opacity="0.22" />
          <circle cx="305" cy="210" r="2.5" fill="#D4A96A" opacity="0.6">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2.5s" repeatCount="indefinite" />
          </circle>
        </g>

        <circle cx="200" cy="210" r="8" fill="#FFD5B0" opacity="0.3">
          <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite" />
        </circle>

        {[
          [145, 175, "#D4A96A", "3s", "0s"],
          [260, 185, "#7AC7C4", "2.5s", "0.5s"],
          [200, 155, "#D4A96A", "3.5s", "1s"],
          [165, 245, "#7AC7C4", "2.8s", "0.3s"],
          [240, 250, "#D4A96A", "3.2s", "0.8s"],
        ].map(([cx, cy, color, duration, delay], index) => (
          <circle key={index} cx={Number(cx)} cy={Number(cy)} r="2" fill={String(color)}>
            <animate attributeName="opacity" values="0;0.8;0" dur={String(duration)} begin={String(delay)} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
    </div>
  );
}
