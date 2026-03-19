"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TopStatsBar from "@/components/shared/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import { ApiError, apiFetch } from "@/lib/api";
import type { UserProfile } from "@/lib/types";
import { useAuthStore } from "@/stores/useAuthStore";
import useUserStore from "@/stores/useUserStore";

/* ═══════════════════ Types & data ═══════════════════ */

interface Tier {
  id: string;
  label: string;
  gems: number;
  credits: number;
  note: string;
  badge?: string;
  variant: "starter" | "popular" | "pro";
}

const TIERS: Tier[] = [
  {
    id: "starter",
    label: "Quick Refill",
    gems: 500,
    credits: 500,
    note: "Good for a few course or hint actions",
    variant: "starter",
  },
  {
    id: "popular",
    label: "Builder Pack",
    gems: 2000,
    credits: 2000,
    note: "Best for regular syllabus and lesson generation",
    badge: "Best Value",
    variant: "popular",
  },
  {
    id: "pro",
    label: "Studio Boost",
    gems: 5000,
    credits: 5000,
    note: "High-credit sandbox refill for heavy testing",
    variant: "pro",
  },
];

/* ═══════════════════ Page ═══════════════════ */

export default function StorePage() {
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ── TopStatsBar with back arrow ── */}
      <TopStatsBar backHref="/home" pageTitle="Treasury / Top-Up Store" />

      {/* ── Background decoration ── */}
      <StoreBg />

      {/* ══════════════ Content ══════════════ */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-brand-gray-700 mb-3">
            Credits Sandbox
          </h1>
          <p className="text-brand-gray-500 text-base md:text-lg">
            This page tops up backend credits directly. It is a product sandbox, not a real payment checkout.
          </p>
        </div>

        {/* Pricing Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-stretch justify-center max-w-4xl mx-auto">
          {TIERS.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              onSelect={() => setSelectedTier(tier)}
            />
          ))}
        </div>
      </div>

      {/* ── Payment Modal ── */}
      <AnimatePresence>
        {selectedTier && (
          <PaymentModal
            tier={selectedTier}
            onClose={() => setSelectedTier(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════ Tier Card ═══════════════════ */

function TierCard({
  tier,
  onSelect,
}: {
  tier: Tier;
  onSelect: () => void;
}) {
  if (tier.variant === "pro") {
    return <ProTierCard tier={tier} onSelect={onSelect} />;
  }

  return (
    <motion.div whileHover={{ y: -6 }} className="relative h-full">
      {/* Best Value ribbon */}
      {tier.badge && (
        <div className="absolute -top-0 -right-0 z-20">
          <div className="relative">
            <div className="bg-gradient-to-r from-brand-green to-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl shadow-lg transform rotate-0 origin-top-right">
              {tier.badge}
            </div>
          </div>
        </div>
      )}

      <DeepGlassCard
        className={`h-full px-6 py-8 flex flex-col items-center text-center cursor-pointer transition-all hover:shadow-2xl ${
          tier.variant === "popular"
            ? "ring-2 ring-brand-teal/50 shadow-[0_0_30px_rgba(122,199,196,0.15)]"
            : ""
        }`}
        onClick={onSelect}
      >
        {/* Title */}
        <h3 className="font-heading font-bold text-brand-gray-700 text-lg mb-1">
          {tier.label} ({tier.gems} 💎)
        </h3>

        {/* Illustration */}
        <div className="my-6 h-28 flex items-center justify-center">
          {tier.variant === "starter" ? <GemsIllustration /> : <ChestIllustration />}
        </div>

        {/* Price */}
        <p className="font-heading text-2xl font-extrabold text-brand-gray-700 mb-2">
          +{tier.credits.toLocaleString()} credits
        </p>
        <p className="text-sm text-brand-gray-500 mb-5">{tier.note}</p>

        {/* Spacer to push button to bottom */}
        <div className="flex-1" />

        {/* Buy button */}
        <button className="w-full rounded-xl py-3 font-heading font-bold text-white bg-gradient-to-b from-brand-teal to-[#5fb3af] border-b-4 border-[#4a9e9a] shadow-md hover:shadow-lg active:translate-y-0.5 active:shadow-sm transition-all">
          Add Credits
        </button>
      </DeepGlassCard>
    </motion.div>
  );
}

/* ── Pro / Subscription Tier ── */

function ProTierCard({
  tier,
  onSelect,
}: {
  tier: Tier;
  onSelect: () => void;
}) {
  return (
    <motion.div whileHover={{ y: -6 }} className="relative h-full">
      <motion.div
        className="relative rounded-3xl overflow-hidden cursor-pointer shadow-2xl h-full"
        onClick={onSelect}
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0533] via-[#2d1b69] to-[#0f0520] animate-gradient-shift" />

        {/* Lightning / energy effects */}
        <div className="absolute inset-0 overflow-hidden">
          <ProEffects />
        </div>

        {/* Content */}
        <div className="relative z-10 px-6 py-8 flex flex-col items-center text-center h-full">
          <h3 className="font-heading font-bold text-white text-lg mb-1">
            {tier.label}
          </h3>

          {/* Energy icon */}
          <div className="my-6 h-28 flex items-center justify-center">
            <InfiniteEnergyIcon />
          </div>

          <p className="font-heading text-2xl font-extrabold text-white mb-2">
            +{tier.credits.toLocaleString()} credits
          </p>
          <p className="text-sm text-white/75 mb-5">{tier.note}</p>

          <div className="flex-1" />

          <button className="w-full rounded-xl py-3 font-heading font-bold text-[#1a0533] bg-gradient-to-b from-amber-300 to-yellow-400 border-b-4 border-yellow-600 shadow-md hover:shadow-lg active:translate-y-0.5 active:shadow-sm transition-all">
            Add Credits
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════ Payment Modal ═══════════════════ */

function PaymentModal({
  tier,
  onClose,
}: {
  tier: Tier;
  onClose: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const addGems = useUserStore((s) => s.addGems);
  const syncFromProfile = useUserStore((s) => s.syncFromProfile);
  const updateUser = useAuthStore((s) => s.updateUser);

  const handlePay = async () => {
    setProcessing(true);
    setError("");
    try {
      if (tier.gems > 0) {
        const profile = await apiFetch<UserProfile>(
          `/auth/credits/topup?amount=${tier.gems}`,
          { method: "POST" }
        );
        updateUser(profile);
        syncFromProfile(profile);
      } else {
        addGems(0);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Payment failed.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
        animate={{ opacity: 1, backdropFilter: "blur(6px)" }}
        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      {/* Modal sheet */}
      <motion.div
        className="relative z-10 w-full max-w-md mx-4 mb-0 md:mb-8"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
      >
        <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 h-8 w-8 rounded-full bg-brand-gray-100 flex items-center justify-center text-brand-gray-500 hover:bg-brand-gray-200 transition"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <h2 className="font-heading text-xl font-extrabold text-brand-gray-700 text-center">
              Confirm Credit Top-Up
            </h2>
            <p className="text-sm text-brand-gray-500 text-center mt-1">
              {tier.label}{" "}
              ({tier.credits.toLocaleString()} credits)
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-brand-gray-100 mx-6" />

          {done ? (
            /* ── Success state ── */
            <div className="px-6 py-10 flex flex-col items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12 }}
                className="h-16 w-16 rounded-full bg-brand-green/10 flex items-center justify-center"
              >
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-brand-green" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </motion.div>
              <p className="font-heading font-bold text-brand-gray-700 text-lg">
                Credits Added
              </p>
              <p className="text-sm text-brand-gray-500">
                {tier.credits.toLocaleString()} credits have been added to your account.
              </p>
              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl py-3.5 font-heading font-bold text-white bg-brand-green shadow-md hover:shadow-lg transition active:translate-y-0.5"
              >
                Done
              </button>
            </div>
          ) : (
            /* ── Sandbox confirm ── */
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-2xl border border-brand-gray-100 bg-brand-gray-50 px-4 py-4">
                <p className="text-sm font-semibold text-brand-gray-700">
                  Sandbox Action
                </p>
                <p className="mt-1 text-sm text-brand-gray-500 leading-relaxed">
                  This button calls the existing backend top-up endpoint directly and adds credits to your account immediately. No payment processor is involved in this UI.
                </p>
              </div>

              {/* Confirm Purchase button */}
              <button
                onClick={() => void handlePay()}
                disabled={processing}
                className="w-full rounded-xl py-3.5 font-heading font-bold text-white bg-gradient-to-b from-brand-teal to-[#5fb3af] border-b-4 border-[#4a9e9a] shadow-md hover:shadow-lg active:translate-y-0.5 active:shadow-sm transition-all disabled:opacity-70"
              >
                {processing ? "Applying..." : `Add ${tier.credits.toLocaleString()} Credits`}
              </button>
              {error && (
                <p className="text-center text-sm text-rose-500">{error}</p>
              )}
              <p className="text-center text-xs text-brand-gray-400">
                Safe to use for local testing and UI validation.
              </p>
            </div>
          )}

          {/* Bottom safe-area spacer (mobile) */}
          <div className="h-4 md:h-0" />
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════ Illustrations ═══════════════════ */

function GemsIllustration() {
  return (
    <svg viewBox="0 0 120 100" className="h-full w-auto" fill="none">
      {/* Main gem */}
      <polygon points="60,10 80,35 70,80 50,80 40,35" fill="#E8B4C8" opacity="0.4" />
      <polygon points="60,10 80,35 60,40 40,35" fill="#F0C8D8" opacity="0.6" />
      <polygon points="60,40 80,35 70,80" fill="#D8A0B8" opacity="0.5" />
      <polygon points="60,40 40,35 50,80" fill="#E0B0C0" opacity="0.5" />
      {/* Small gems */}
      <polygon points="25,55 35,45 40,60 30,68 20,62" fill="#F0C8D8" opacity="0.5" />
      <polygon points="85,50 95,42 98,55 90,62 82,58" fill="#F0C8D8" opacity="0.5" />
      {/* Sparkles */}
      <circle cx="50" cy="20" r="2" fill="#FFD700" opacity="0.6" />
      <circle cx="75" cy="45" r="1.5" fill="#FFD700" opacity="0.5" />
      <circle cx="30" cy="40" r="1.5" fill="#FFD700" opacity="0.5" />
    </svg>
  );
}

function ChestIllustration() {
  return (
    <svg viewBox="0 0 140 110" className="h-full w-auto" fill="none">
      {/* Chest body */}
      <rect x="25" y="50" width="90" height="45" rx="6" fill="#C4956A" />
      <rect x="25" y="50" width="90" height="45" rx="6" fill="url(#chestGrad)" />
      {/* Chest lid */}
      <path d="M25 50 Q70 20 115 50" fill="#D4A87A" />
      <path d="M25 50 Q70 25 115 50" fill="none" stroke="#B8875A" strokeWidth="1.5" />
      {/* Metal band */}
      <rect x="60" y="44" width="20" height="12" rx="2" fill="#DAA520" />
      <circle cx="70" cy="56" r="4" fill="#B8860B" />
      <circle cx="70" cy="56" r="2" fill="#DAA520" />
      {/* Gems spilling out */}
      <polygon points="50,45 55,35 60,45" fill="#E8B4C8" opacity="0.8" />
      <polygon points="70,38 76,26 82,38" fill="#A0D8E8" opacity="0.8" />
      <polygon points="88,42 92,32 96,42" fill="#C8E8A0" opacity="0.8" />
      <polygon points="55,40 58,32 62,42" fill="#FFD700" opacity="0.6" />
      {/* Sparkles */}
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
      {/* Glow backdrop */}
      <ellipse cx="80" cy="60" rx="60" ry="45" fill="#8B5CF6" opacity="0.1" />
      {/* Infinity symbol */}
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
      {/* Lightning bolt - left */}
      <path d="M62 35 L55 55 L65 52 L58 75" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Lightning bolt - right */}
      <path d="M102 35 L95 55 L105 52 L98 75" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Sparkles */}
      <circle cx="40" cy="45" r="2" fill="#FBBF24" opacity="0.7" />
      <circle cx="120" cy="45" r="2" fill="#FBBF24" opacity="0.7" />
      <circle cx="80" cy="25" r="2.5" fill="#C084FC" opacity="0.6" />
      <circle cx="80" cy="95" r="2" fill="#C084FC" opacity="0.5" />
    </svg>
  );
}

/* ── Pro card effects ── */

function ProEffects() {
  return (
    <>
      {/* Diagonal light streaks */}
      <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-purple-400/20 to-transparent rotate-12" />
      <div className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-blue-400/15 to-transparent -rotate-12" />
      {/* Corner glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-blue-600/15 blur-3xl" />
      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-purple-300 particle"
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

/* ═══════════════════ Background ═══════════════════ */

function StoreBg() {
  const runeText =
    "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟ";
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Rune circle – bottom right */}
      <svg
        viewBox="0 0 700 700"
        className="absolute -right-[140px] -bottom-[140px] w-[550px] h-[550px] opacity-20"
        fill="none"
      >
        <defs>
          <radialGradient id="storePeach" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#FFF5EC" />
            <stop offset="60%" stopColor="#F5DECA" />
            <stop offset="100%" stopColor="#EDD0B5" />
          </radialGradient>
          <path id="storeRune" d="M 350,350 m -260,0 a 260,260 0 1,1 520,0 a 260,260 0 1,1 -520,0" />
        </defs>
        <circle cx="350" cy="350" r="300" fill="url(#storePeach)" opacity="0.5" />
        <circle cx="350" cy="350" r="290" fill="none" stroke="#D4BC8B" strokeWidth="1" opacity="0.4" />
        <circle cx="350" cy="350" r="248" fill="none" stroke="#D4BC8B" strokeWidth="1" opacity="0.4" />
        <text fill="#C4A87A" fontSize="18" fontWeight="500" letterSpacing="4" opacity="0.35">
          <textPath href="#storeRune">{runeText}</textPath>
        </text>
      </svg>

      {/* Sparkle */}
      <svg viewBox="0 0 40 40" className="absolute bottom-10 right-10 w-7 h-7" fill="none">
        <path d="M20 0 L22 16 L40 20 L22 22 L20 40 L18 22 L0 20 L18 16 Z" fill="#D4A96A" opacity="0.5" />
      </svg>
    </div>
  );
}
