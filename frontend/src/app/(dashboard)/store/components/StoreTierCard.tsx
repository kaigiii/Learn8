"use client";

import { motion } from "framer-motion";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import type { CreditStoreTier } from "../types";
import { useI18n } from "@/lib/i18n/useI18n";
import type { TranslationKey } from "@/lib/i18n/translations";

const TIER_LABEL_KEYS: Record<string, TranslationKey> = {
  starter: "store.tier.quickRefill.label",
  popular: "store.tier.builderPack.label",
  pro: "store.tier.studioBoost.label",
};

const TIER_NOTE_KEYS: Record<string, TranslationKey> = {
  starter: "store.tier.quickRefill.note",
  popular: "store.tier.builderPack.note",
  pro: "store.tier.studioBoost.note",
};

const TIER_BADGE_KEYS: Record<string, TranslationKey> = {
  popular: "store.tier.builderPack.badge",
};

export function StoreTierCard({
  tier,
  onSelect,
}: {
  tier: CreditStoreTier;
  onSelect: () => void;
}) {
  const { t } = useI18n();

  if (tier.variant === "pro") {
    return <StoreProTierCard tier={tier} onSelect={onSelect} />;
  }

  return (
    <motion.div whileHover={{ y: -6 }} className="relative h-full">
      {tier.badge && (
        <div className="absolute -top-0 -right-0 z-20">
          <div className="relative">
            <div className="origin-top-right rotate-0 rounded-bl-xl rounded-tr-2xl bg-gradient-to-r from-brand-green to-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
              {TIER_BADGE_KEYS[tier.id] ? t(TIER_BADGE_KEYS[tier.id]!) : tier.badge}
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
          {TIER_LABEL_KEYS[tier.id] ? t(TIER_LABEL_KEYS[tier.id]!) : tier.label}
        </h3>

        <div className="my-6 flex h-28 items-center justify-center">
          {tier.variant === "starter" ? <GemsIllustration /> : <ChestIllustration />}
        </div>

        <p className="mb-2 font-heading text-2xl font-extrabold text-brand-gray-700">
          {t("store.creditsAmount", { amount: tier.credits.toLocaleString() })}
        </p>
        <p className="mb-5 text-sm text-brand-gray-500">
          {TIER_NOTE_KEYS[tier.id] ? t(TIER_NOTE_KEYS[tier.id]!) : tier.note}
        </p>

        <div className="flex-1" />

        <button className="w-full rounded-xl border-b-4 border-[#4a9e9a] bg-gradient-to-b from-brand-teal to-[#5fb3af] py-3 font-heading font-bold text-white shadow-md transition-all hover:shadow-lg active:translate-y-0.5 active:shadow-sm">
          {t("store.addCredits")}
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
  const { t } = useI18n();
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
            {TIER_LABEL_KEYS[tier.id] ? t(TIER_LABEL_KEYS[tier.id]!) : tier.label}
          </h3>

          <div className="my-6 flex h-28 items-center justify-center">
            <InfiniteEnergyIcon />
          </div>

          <p className="mb-2 font-heading text-2xl font-extrabold text-white">
            {t("store.creditsAmount", { amount: tier.credits.toLocaleString() })}
          </p>
          <p className="mb-5 text-sm text-white/75">
            {TIER_NOTE_KEYS[tier.id] ? t(TIER_NOTE_KEYS[tier.id]!) : tier.note}
          </p>

          <div className="flex-1" />

          <button className="w-full rounded-xl border-b-4 border-yellow-600 bg-gradient-to-b from-amber-300 to-yellow-400 py-3 font-heading font-bold text-[#1a0533] shadow-md transition-all hover:shadow-lg active:translate-y-0.5 active:shadow-sm">
            {t("store.addCredits")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GemsIllustration() {
  return (
    <svg viewBox="0 0 120 110" className="h-full w-auto" fill="none">
      <defs>
        <linearGradient id="sdTop" x1="0.5" y1="0" x2="0.5" y2="0.45">
          <stop offset="0%" stopColor="#E0F7FF" />
          <stop offset="100%" stopColor="#67E8F9" />
        </linearGradient>
        <linearGradient id="sdLeft" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id="sdRight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="sdBottom" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#075985" />
        </linearGradient>
        <radialGradient id="sdGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Glow */}
      <ellipse cx="60" cy="58" rx="40" ry="38" fill="url(#sdGlow)" />
      {/* Top facet */}
      <polygon points="60,12 82,40 60,48 38,40" fill="url(#sdTop)" />
      {/* Left facet */}
      <polygon points="38,40 60,48 60,96 24,58" fill="url(#sdLeft)" />
      {/* Right facet */}
      <polygon points="82,40 60,48 60,96 96,58" fill="url(#sdRight)" />
      {/* Bottom-left inner */}
      <polygon points="60,48 60,96 24,58 38,40" fill="#0EA5E9" opacity="0.18" />
      {/* Highlight on top facet */}
      <polygon points="60,14 75,38 60,44 45,38" fill="white" opacity="0.32" />
      <polygon points="48,42 60,47 54,60" fill="white" opacity="0.16" />
      {/* Shadow */}
      <ellipse cx="60" cy="100" rx="22" ry="5" fill="#0EA5E9" opacity="0.13" />
      {/* Sparkles */}
      <path d="M101 18 L103 24 L109 26 L103 28 L101 34 L99 28 L93 26 L99 24 Z" fill="#FDE68A" opacity="0.9" />
      <circle cx="18" cy="46" r="2" fill="#BAE6FD" opacity="0.8" />
      <circle cx="104" cy="60" r="1.5" fill="#FDE68A" opacity="0.65" />
      <path d="M16 60 L17.5 64 L22 65.5 L17.5 67 L16 71 L14.5 67 L10 65.5 L14.5 64 Z" fill="#BAE6FD" opacity="0.75" />
    </svg>
  );
}

function ChestIllustration() {
  return (
    <svg viewBox="0 0 140 115" className="h-full w-auto" fill="none">
      <defs>
        <linearGradient id="pdTop" x1="0.5" y1="0" x2="0.5" y2="0.45">
          <stop offset="0%" stopColor="#E0F7FF" />
          <stop offset="100%" stopColor="#67E8F9" />
        </linearGradient>
        <linearGradient id="pdLeft" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id="pdRight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="pdTop2" x1="0.5" y1="0" x2="0.5" y2="0.45">
          <stop offset="0%" stopColor="#C7F2FF" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="pdLeft2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#075985" />
        </linearGradient>
        <linearGradient id="pdRight2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <radialGradient id="pdGlow" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Glow */}
      <ellipse cx="70" cy="68" rx="52" ry="36" fill="url(#pdGlow)" />

      {/* Back-left small diamond */}
      <polygon points="30,36 42,52 30,60 18,52" fill="url(#pdTop2)" opacity="0.85" />
      <polygon points="18,52 30,60 30,80 14,68" fill="url(#pdLeft2)" opacity="0.8" />
      <polygon points="42,52 30,60 30,80 46,68" fill="url(#pdRight2)" opacity="0.7" />
      <polygon points="30,38 39,50 30,55 21,50" fill="white" opacity="0.22" />

      {/* Back-right small diamond */}
      <polygon points="110,30 122,46 110,54 98,46" fill="url(#pdTop2)" opacity="0.85" />
      <polygon points="98,46 110,54 110,74 94,62" fill="url(#pdLeft2)" opacity="0.8" />
      <polygon points="122,46 110,54 110,74 126,62" fill="url(#pdRight2)" opacity="0.7" />
      <polygon points="110,32 119,44 110,49 101,44" fill="white" opacity="0.22" />

      {/* Main center diamond */}
      <polygon points="70,10 94,42 70,52 46,42" fill="url(#pdTop)" />
      <polygon points="46,42 70,52 70,98 26,68" fill="url(#pdLeft)" />
      <polygon points="94,42 70,52 70,98 114,68" fill="url(#pdRight)" />
      <polygon points="70,13 88,40 70,47 52,40" fill="white" opacity="0.3" />
      <polygon points="56,45 70,50 62,64" fill="white" opacity="0.16" />

      {/* Shadow */}
      <ellipse cx="70" cy="104" rx="30" ry="6" fill="#0EA5E9" opacity="0.12" />
      {/* Sparkles */}
      <path d="M120 12 L122 17 L127 19 L122 21 L120 26 L118 21 L113 19 L118 17 Z" fill="#FDE68A" opacity="0.9" />
      <path d="M14 36 L15.5 40 L20 41.5 L15.5 43 L14 47 L12.5 43 L8 41.5 L12.5 40 Z" fill="#BAE6FD" opacity="0.8" />
      <circle cx="124" cy="72" r="2" fill="#FDE68A" opacity="0.65" />
      <circle cx="16" cy="70" r="1.5" fill="#BAE6FD" opacity="0.7" />
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
