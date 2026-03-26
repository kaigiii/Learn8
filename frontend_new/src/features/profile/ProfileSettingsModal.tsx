"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ApiError, apiFetch } from "@/lib/apiClient";
import type { UserProfile } from "@/lib/apiTypes";
import { useAuthStore } from "@/stores/useAuthStore";
import { useProjectStore } from "@/stores/useProjectStore";
import useUserStore from "@/stores/useUserStore";

interface ProfileSettingsModalProps {
  onClose: () => void;
}

export default function ProfileSettingsModal({ onClose }: ProfileSettingsModalProps) {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearSession = useAuthStore((s) => s.clearSession);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const {
    name,
    title,
    preferences,
    setPreferences,
    syncFromProfile,
    logout,
  } = useUserStore();
  const [form, setForm] = useState({
    full_name: "",
    job_title: "",
    education_level: "",
    daily_learning_goal_minutes: "",
  });
  const [saving, setSaving] = useState(false);
  const [toppingUpAmount, setToppingUpAmount] = useState<number | null>(null);
  const [error, setError] = useState("");

  const { soundOn, darkGlass, difficulty } = preferences;

  useEffect(() => {
    setForm({
      full_name: authUser?.full_name || name,
      job_title: authUser?.job_title || "",
      education_level: authUser?.education_level || "",
      daily_learning_goal_minutes: authUser?.daily_learning_goal_minutes
        ? String(authUser.daily_learning_goal_minutes)
        : "",
    });
  }, [authUser, name]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setError("");
    try {
      const profile = await apiFetch<UserProfile>("/auth/me", {
        method: "PUT",
        body: JSON.stringify({
          full_name: form.full_name.trim() || null,
          job_title: form.job_title.trim() || null,
          education_level: form.education_level.trim() || null,
          daily_learning_goal_minutes: form.daily_learning_goal_minutes
            ? Number(form.daily_learning_goal_minutes)
            : null,
        }),
      });
      updateUser(profile);
      syncFromProfile(profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickTopUp = async (amount: number) => {
    setToppingUpAmount(amount);
    setError("");
    try {
      const profile = await apiFetch<UserProfile>(
        `/auth/credits/topup?amount=${amount}`,
        { method: "POST" }
      );
      updateUser(profile);
      syncFromProfile(profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to top up credits.");
    } finally {
      setToppingUpAmount(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center"
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

        {/* Modal card */}
        <motion.div
          className="relative z-10 w-full max-w-sm mx-4"
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 30 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
        >
          {/* Floating avatar – overlaps top edge */}
          <div className="flex justify-center -mb-12 relative z-20">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-[#e8ddd0] border-4 border-white shadow-lg flex items-center justify-center overflow-hidden">
                <OwlAvatar />
              </div>
              {/* Edit badge */}
              <button className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-white shadow-md border border-brand-gray-100 flex items-center justify-center hover:bg-brand-gray-50 transition">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-brand-gray-500" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Glass card body */}
          <div className="rounded-2xl border border-white/40 bg-white/80 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 overflow-hidden pt-14 pb-5 px-6">
            {/* Name & title */}
            <div className="text-center mb-5">
              <h2 className="font-heading text-xl font-extrabold text-brand-gray-700">
                {authUser?.job_title?.trim() || title}
              </h2>
              <p className="text-sm text-brand-gray-400 mt-0.5">
                {name}
              </p>
              {authUser?.email && (
                <p className="text-xs text-brand-gray-400 mt-1">{authUser.email}</p>
              )}
            </div>

            {/* ── Stats Grid ── */}
            <div className="mb-5">
              <h3 className="font-heading font-bold text-brand-gray-600 text-sm mb-2.5">
                Account Snapshot
              </h3>
              <div className="grid grid-cols-3 gap-2.5">
                <StatBox
                  label="Credits"
                  value={String(authUser?.credits ?? 0)}
                />
                <StatBox
                  label="Daily Goal"
                  value={
                    authUser?.daily_learning_goal_minutes
                      ? `${authUser.daily_learning_goal_minutes} min`
                      : "Not set"
                  }
                />
                <StatBox
                  label="Education"
                  value={authUser?.education_level || "Not set"}
                />
              </div>
            </div>

            {/* ── Preferences ── */}
            <div className="mb-4">
              <h3 className="font-heading font-bold text-brand-gray-600 text-sm mb-3">
                Profile
              </h3>
              <div className="space-y-3.5">
                <label className="block">
                  <span className="text-sm text-brand-gray-600">Display Name</span>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-brand-gray-200 bg-white/70 px-3 py-2 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-brand-gray-600">Job Title</span>
                  <input
                    type="text"
                    value={form.job_title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, job_title: e.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-brand-gray-200 bg-white/70 px-3 py-2 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-brand-gray-600">Education Level</span>
                  <input
                    type="text"
                    value={form.education_level}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        education_level: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-brand-gray-200 bg-white/70 px-3 py-2 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-brand-gray-600">Daily Goal (min)</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={form.daily_learning_goal_minutes}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        daily_learning_goal_minutes: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-brand-gray-200 bg-white/70 px-3 py-2 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
                  />
                </label>

                <button
                  onClick={() => void handleSaveProfile()}
                  disabled={saving}
                  className="w-full rounded-xl bg-brand-teal px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Profile"}
                </button>
                {error && <p className="text-xs text-rose-500">{error}</p>}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-heading font-bold text-brand-gray-600 text-sm mb-3">
                Credits
              </h3>
              <div className="rounded-2xl border border-brand-gray-100 bg-gradient-to-b from-white/70 to-brand-gray-50 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-brand-gray-400">
                      Available
                    </p>
                    <p className="font-heading text-2xl font-extrabold text-brand-gray-700">
                      {authUser?.credits ?? 0}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      router.push("/store");
                    }}
                    className="rounded-xl border border-brand-gray-200 bg-white px-3 py-2 text-xs font-semibold text-brand-gray-600 transition hover:border-brand-teal hover:text-brand-teal"
                  >
                    Open Store
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[500, 2000, 5000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => void handleQuickTopUp(amount)}
                      disabled={toppingUpAmount !== null}
                      className="rounded-xl bg-brand-teal/10 px-3 py-2 text-xs font-semibold text-brand-teal transition hover:bg-brand-teal hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {toppingUpAmount === amount
                        ? "Adding..."
                        : `+${amount.toLocaleString()}`}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-brand-gray-400">
                  Sandbox refill for testing generation and lesson flows without leaving your account center.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-heading font-bold text-brand-gray-600 text-sm mb-3">
                Preferences
              </h3>
              <div className="space-y-3.5">
                {/* Sound Effects */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-gray-600">Sound Effects</span>
                  <Toggle on={soundOn} onChange={() => setPreferences({ soundOn: !soundOn })} />
                </div>

                {/* Dark/Light Theme */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-gray-600">Dark/Light Theme</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-brand-gray-400 font-medium">Dark/Glass</span>
                    <Toggle on={darkGlass} onChange={() => setPreferences({ darkGlass: !darkGlass })} />
                  </div>
                </div>

                {/* Difficulty Scaling */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-brand-gray-600 shrink-0">Difficulty Scaling</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={difficulty}
                    onChange={(e) => setPreferences({ difficulty: Number(e.target.value) })}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-brand-teal bg-brand-gray-200"
                  />
                </div>
              </div>
            </div>

            {/* ── Log Out ── */}
            <div className="pt-2 border-t border-brand-gray-100">
              <button
                onClick={() => {
                  onClose();
                  router.push("/store");
                }}
                className="w-full text-center text-sm text-brand-gray-500 font-semibold hover:text-brand-gray-700 transition py-2"
              >
                Open Full Store
              </button>
              <button
                onClick={() => {
                  clearSession();
                  setCurrentProject(null);
                  logout();
                  onClose();
                  router.push("/auth/login");
                }}
                className="w-full text-center text-sm text-brand-teal font-semibold hover:text-brand-teal/70 transition py-2"
              >
                Log Out
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Stat box ── */

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gradient-to-b from-white/60 to-brand-gray-50 border border-brand-gray-100 rounded-xl px-2 py-3 text-center">
      <p className="text-[10px] text-brand-gray-400 leading-tight mb-1">{label}</p>
      <p className="font-heading font-extrabold text-brand-gray-700 text-sm">
        {value}
      </p>
    </div>
  );
}

/* ── Toggle switch ── */

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        on ? "bg-brand-teal" : "bg-brand-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
          on ? "translate-x-5.5" : "translate-x-1"
        }`}
        style={{
          width: "18px",
          height: "18px",
          transform: on ? "translateX(22px)" : "translateX(3px)",
        }}
      />
    </button>
  );
}

/* ── Owl avatar (large) ── */

function OwlAvatar() {
  return (
    <svg viewBox="0 0 96 96" className="h-20 w-20" fill="none">
      {/* Body */}
      <ellipse cx="48" cy="56" rx="22" ry="26" fill="#C4A882" />
      <ellipse cx="48" cy="53" rx="17" ry="20" fill="#E8D5B7" />
      {/* Eyes bg */}
      <circle cx="39" cy="44" r="8" fill="white" />
      <circle cx="57" cy="44" r="8" fill="white" />
      {/* Eye rims (glasses) */}
      <circle cx="39" cy="44" r="8.5" fill="none" stroke="#8B7355" strokeWidth="1.8" />
      <circle cx="57" cy="44" r="8.5" fill="none" stroke="#8B7355" strokeWidth="1.8" />
      <line x1="47.5" y1="44" x2="48.5" y2="44" stroke="#8B7355" strokeWidth="1.8" />
      {/* Pupils */}
      <circle cx="40" cy="44" r="4" fill="#333" />
      <circle cx="56" cy="44" r="4" fill="#333" />
      {/* Highlights */}
      <circle cx="41.5" cy="42.5" r="1.5" fill="white" />
      <circle cx="57.5" cy="42.5" r="1.5" fill="white" />
      {/* Beak */}
      <polygon points="48,50 45,54 51,54" fill="#E8734A" />
      {/* Ear tufts */}
      <polygon points="35,32 38,24 42,34" fill="#C4A882" />
      <polygon points="61,32 58,24 54,34" fill="#C4A882" />
      {/* Feet */}
      <ellipse cx="42" cy="80" rx="6" ry="2.5" fill="#E8734A" opacity="0.7" />
      <ellipse cx="54" cy="80" rx="6" ry="2.5" fill="#E8734A" opacity="0.7" />
    </svg>
  );
}
