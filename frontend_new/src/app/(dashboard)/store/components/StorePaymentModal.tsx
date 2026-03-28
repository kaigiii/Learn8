"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { syncPersistedProfile } from "@/lib/auth/profileSync";
import type { UserProfile } from "@/lib/apiTypes";
import useUserStore from "@/stores/app/useUserStore";
import type { CreditStoreTier } from "../types";

export function StorePaymentModal({
  tier,
  onClose,
}: {
  tier: CreditStoreTier;
  onClose: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const addGems = useUserStore((state) => state.addGems);

  const handlePay = async () => {
    setProcessing(true);
    setError("");
    try {
      if (tier.gems > 0) {
        const profile = await apiFetch<UserProfile>(
          `/auth/credits/topup?amount=${tier.gems}`,
          { method: "POST" }
        );
        syncPersistedProfile(profile);
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
      <motion.div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
        animate={{ opacity: 1, backdropFilter: "blur(6px)" }}
        exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />

      <motion.div
        className="relative z-10 mx-4 mb-0 w-full max-w-md md:mb-8"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
      >
        <div className="overflow-hidden rounded-t-3xl bg-white shadow-2xl md:rounded-3xl">
          <div className="relative px-6 pt-6 pb-4">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-brand-gray-100 text-brand-gray-500 transition hover:bg-brand-gray-200"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-center font-heading text-xl font-extrabold text-brand-gray-700">
              Confirm Credit Top-Up
            </h2>
            <p className="mt-1 text-center text-sm text-brand-gray-500">
              {tier.label} ({tier.credits.toLocaleString()} credits)
            </p>
          </div>

          <div className="mx-6 h-px bg-brand-gray-100" />

          {done ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-green/10"
              >
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-brand-green" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </motion.div>
              <p className="font-heading text-lg font-bold text-brand-gray-700">
                Credits Added
              </p>
              <p className="text-sm text-brand-gray-500">
                {tier.credits.toLocaleString()} credits have been added to your account.
              </p>
              <button
                onClick={onClose}
                className="mt-4 w-full rounded-xl bg-brand-green py-3.5 font-heading font-bold text-white shadow-md transition hover:shadow-lg active:translate-y-0.5"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-brand-gray-100 bg-brand-gray-50 px-4 py-4">
                <p className="text-sm font-semibold text-brand-gray-700">
                  Sandbox Action
                </p>
                <p className="mt-1 text-sm leading-relaxed text-brand-gray-500">
                  This button calls the existing backend top-up endpoint directly and adds credits to your account immediately. No payment processor is involved in this UI.
                </p>
              </div>

              <button
                onClick={() => void handlePay()}
                disabled={processing}
                className="w-full rounded-xl border-b-4 border-[#4a9e9a] bg-gradient-to-b from-brand-teal to-[#5fb3af] py-3.5 font-heading font-bold text-white shadow-md transition-all hover:shadow-lg active:translate-y-0.5 active:shadow-sm disabled:opacity-70"
              >
                {processing ? "Applying..." : `Add ${tier.credits.toLocaleString()} Credits`}
              </button>
              {error && <p className="text-center text-sm text-rose-500">{error}</p>}
              <p className="text-center text-xs text-brand-gray-400">
                Safe to use for local testing and UI validation.
              </p>
            </div>
          )}

          <div className="h-4 md:h-0" />
        </div>
      </motion.div>
    </motion.div>
  );
}
