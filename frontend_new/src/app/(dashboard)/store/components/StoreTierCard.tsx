"use client";

import { motion } from "framer-motion";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import type { CreditStoreTier } from "../types";

export function StoreTierCard({
  tier,
  onSelect,
}: {
  tier: CreditStoreTier;
  onSelect: () => void;
}) {
  if (tier.variant === "pro") {
    return <StoreProTierCard tier={tier} onSelect={onSelect} />;
  }

  return (
    <motion.div whileHover={{ y: -6 }} className="relative h-full">
      {tier.badge && (
        <div className="absolute -top-0 -right-0 z-20">
          <div className="relative">
            <div className="origin-top-right rotate-0 rounded-bl-xl rounded-tr-2xl bg-gradient-to-r from-brand-green to-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
              {tier.badge}
            </div>
          </div>
        </div>
      )}

      <DeepGlassCard
        className={`flex h-full cursor-pointer flex-col items-center px-6 py-8 text-center transition-all hover:shadow-2xl ${
          tier.variant === "popular"
            ? "ring-2 ring-brand-teal/50 shadow-[0_0_30px_rgba(122,199,196,0.15)]"
            : ""
        }`}
        onClick={onSelect}
      >
        <h3 className="mb-1 font-heading text-lg font-bold text-brand-gray-700">
          {tier.label} ({tier.gems} 💎)
        </h3>

        <div className="my-6 flex h-28 items-center justify-center">
          {tier.variant === "starter" ? <GemsIllustration /> : <ChestIllustration />}
        </div>

        <p className="mb-2 font-heading text-2xl font-extrabold text-brand-gray-700">
          +{tier.credits.toLocaleString()} credits
        </p>
        <p className="mb-5 text-sm text-brand-gray-500">{tier.note}</p>

        <div className="flex-1" />

        <button className="w-full rounded-xl border-b-4 border-[#4a9e9a] bg-gradient-to-b from-brand-teal to-[#5fb3af] py-3 font-heading font-bold text-white shadow-md transition-all hover:shadow-lg active:translate-y-0.5 active:shadow-sm">
          Add Credits
        </button>
      </DeepGlassCard>
    </motion.div>
  );
}

function StoreProTierCard({
  tier,
  onSelect,
}: {
  tier: CreditStoreTier;
  onSelect: () => void;
}) {
  return (
    <motion.div whileHover={{ y: -6 }} className="relative h-full">
      <motion.div
        className="relative h-full cursor-pointer overflow-hidden rounded-3xl shadow-2xl"
        onClick={onSelect}
      >
        <div className="absolute inset-0 animate-gradient-shift bg-gradient-to-br from-[#1a0533] via-[#2d1b69] to-[#0f0520]" />

        <div className="absolute inset-0 overflow-hidden">
          <StoreProTierEffects />
        </div>

        <div className="relative z-10 flex h-full flex-col items-center px-6 py-8 text-center">
          <h3 className="mb-1 font-heading text-lg font-bold text-white">
            {tier.label}
          </h3>

          <div className="my-6 flex h-28 items-center justify-center">
            <InfiniteEnergyIcon />
          </div>

          <p className="mb-2 font-heading text-2xl font-extrabold text-white">
            +{tier.credits.toLocaleString()} credits
          </p>
          <p className="mb-5 text-sm text-white/75">{tier.note}</p>

          <div className="flex-1" />

          <button className="w-full rounded-xl border-b-4 border-yellow-600 bg-gradient-to-b from-amber-300 to-yellow-400 py-3 font-heading font-bold text-[#1a0533] shadow-md transition-all hover:shadow-lg active:translate-y-0.5 active:shadow-sm">
            Add Credits
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GemsIllustration() {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-auto" fill="none">
      <polygon points="60,10 80,35 70,80 50,80 40,35" fill="#E8B4C8" opacity="0.4" />
      <polygon points="60,10 80,35 60,40 40,35" fill="#F0C8D8" opacity="0.6" />
      <polygon points="60,40 80,35 70,80" fill="#D8A0B8" opacity="0.5" />
      <polygon points="60,40 40,35 50,80" fill="#E0B0C0" opacity="0.5" />
      <polygon points="25,55 35,45 40,60 30,68 20,62" fill="#F0C8D8" opacity="0.5" />
      <polygon points="85,50 95,42 98,55 90,62 82,58" fill="#F0C8D8" opacity="0.5" />
      <circle cx="50" cy="20" r="2" fill="#FFD700" opacity="0.6" />
      <circle cx="75" cy="45" r="1.5" fill="#FFD700" opacity="0.5" />
      <circle cx="30" cy="40" r="1.5" fill="#FFD700" opacity="0.5" />
    </svg>
  );
}

function ChestIllustration() {
  return (
    <svg viewBox="0 0 140 110" className="h-full w-auto" fill="none">
      <rect x="25" y="50" width="90" height="45" rx="6" fill="#C4956A" />
      <rect x="25" y="50" width="90" height="45" rx="6" fill="url(#chestGrad)" />
      <path d="M25 50 Q70 20 115 50" fill="#D4A87A" />
      <path d="M25 50 Q70 25 115 50" fill="none" stroke="#B8875A" strokeWidth="1.5" />
      <rect x="60" y="44" width="20" height="12" rx="2" fill="#DAA520" />
      <circle cx="70" cy="56" r="4" fill="#B8860B" />
      <circle cx="70" cy="56" r="2" fill="#DAA520" />
      <polygon points="50,45 55,35 60,45" fill="#E8B4C8" opacity="0.8" />
      <polygon points="70,38 76,26 82,38" fill="#A0D8E8" opacity="0.8" />
      <polygon points="88,42 92,32 96,42" fill="#C8E8A0" opacity="0.8" />
      <polygon points="55,40 58,32 62,42" fill="#FFD700" opacity="0.6" />
      <circle cx="55" cy="30" r="2" fill="#FFD700" opacity="0.7" />
      <circle cx="80" cy="22" r="2" fill="#FFD700" opacity="0.6" />
      <circle cx="95" cy="28" r="1.5" fill="#FFD700" opacity="0.5" />
      <circle cx="42" cy="38" r="1.5" fill="#FFD700" opacity="0.5" />
      <defs>
        <linearGradient id="chestGrad" x1="25" y1="50" x2="25" y2="95" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D4A87A" />
          <stop offset="100%" stopColor="#A67A4A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function InfiniteEnergyIcon() {
  return (
    <svg viewBox="0 0 160 120" className="h-full w-auto" fill="none">
      <ellipse cx="80" cy="60" rx="60" ry="45" fill="#8B5CF6" opacity="0.1" />
      <path
        d="M50 60 C50 40 20 30 20 55 C20 80 50 80 55 60 C60 40 70 35 80 35 C90 35 100 40 105 60 C110 80 140 80 140 55 C140 30 110 40 110 60"
        fill="none"
        stroke="#C084FC"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M50 60 C50 40 20 30 20 55 C20 80 50 80 55 60 C60 40 70 35 80 35 C90 35 100 40 105 60 C110 80 140 80 140 55 C140 30 110 40 110 60"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path d="M62 35 L55 55 L65 52 L58 75" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M102 35 L95 55 L105 52 L98 75" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="40" cy="45" r="2" fill="#FBBF24" opacity="0.7" />
      <circle cx="120" cy="45" r="2" fill="#FBBF24" opacity="0.7" />
      <circle cx="80" cy="25" r="2.5" fill="#C084FC" opacity="0.6" />
      <circle cx="80" cy="95" r="2" fill="#C084FC" opacity="0.5" />
    </svg>
  );
}

function StoreProTierEffects() {
  return (
    <>
      <div className="absolute top-0 left-1/4 h-full w-px rotate-12 bg-gradient-to-b from-transparent via-purple-400/20 to-transparent" />
      <div className="absolute top-0 right-1/3 h-full w-px -rotate-12 bg-gradient-to-b from-transparent via-blue-400/15 to-transparent" />
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-blue-600/15 blur-3xl" />
      {[...Array(6)].map((_, index) => (
        <div
          key={index}
          className="particle absolute rounded-full bg-purple-300"
          style={{
            width: `${2 + Math.random() * 3}px`,
            height: `${2 + Math.random() * 3}px`,
            left: `${10 + Math.random() * 80}%`,
            bottom: `${Math.random() * 20}%`,
            opacity: 0.4 + Math.random() * 0.3,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${4 + Math.random() * 4}s`,
          }}
        />
      ))}
    </>
  );
}
