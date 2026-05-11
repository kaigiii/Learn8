"use client";

import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import TopStatsBar from "@/components/layout/TopStatsBar";
import { StoreBackground } from "./components/StoreBackground";
import { StorePaymentModal } from "./components/StorePaymentModal";
import { StoreTierCard } from "./components/StoreTierCard";
import { CREDIT_STORE_TIERS, type CreditStoreTier } from "./types";
import { useI18n } from "@/lib/i18n/useI18n";

/* ═══════════════════ Page ═══════════════════ */

export default function StorePageClient() {
  const { t } = useI18n();
  const [selectedTier, setSelectedTier] = useState<CreditStoreTier | null>(null);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <TopStatsBar
        backHref="/home"
        pageTitle={t("store.pageTitle")}
        quickLinks={[
          {
            href: "/multiplayer",
            label: t("common.multiplayer"),
            iconSrc: "/svg/multiplayer-controller.svg",
            iconAlt: t("common.multiplayer"),
          },
          {
            href: "/arena/leaderboard",
            label: t("common.leaderboard"),
            iconSrc: "/svg/leaderboard-logo.svg",
            iconAlt: t("common.leaderboard"),
          },
        ]}
      />
      <StoreBackground />
      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16">
        <div className="text-center mb-10 md:mb-14">
          <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-brand-gray-700 mb-3">
            {t("store.creditsSandbox")}
          </h1>
          <p className="text-brand-gray-500 text-base md:text-lg">
            {t("store.sandboxDesc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-stretch justify-center max-w-4xl mx-auto">
          {CREDIT_STORE_TIERS.map((tier) => (
            <StoreTierCard
              key={tier.id}
              tier={tier}
              onSelect={() => setSelectedTier(tier)}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedTier && (
          <StorePaymentModal
            tier={selectedTier}
            onClose={() => setSelectedTier(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
