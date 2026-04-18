"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileStatBox } from "./components/ProfileStatBox";
import { ProfileToggle } from "./components/ProfileToggle";
import { useProfileSettings } from "./hooks/useProfileSettings";

interface ProfileSettingsDialogProps {
  onClose: () => void;
}

export default function ProfileSettingsDialog({ onClose }: ProfileSettingsDialogProps) {
  const router = useRouter();
  const {
    authUser,
    title,
    preferences,
    setPreferences,
    handleLogout,
  } = useProfileSettings(onClose);

  const { soundOn, darkGlass, difficulty } = preferences;

  const openProfilePanel = (panel: "personal" | "wallet") => {
    onClose();
    router.push(`/profile?panel=${panel}`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/30 backdrop-blur-[6px]"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Modal card */}
        <motion.div
          className="relative z-10 mx-4 w-full max-w-2xl"
          initial={{ scale: 0.9, opacity: 0, y: 28 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative max-h-[86vh] overflow-y-auto rounded-[32px] border border-white/60 bg-white/90 shadow-[0_30px_70px_rgba(15,23,42,0.24)] backdrop-blur-xl">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-brand-gray-200 bg-white/90 text-brand-gray-500 transition hover:text-brand-gray-700"
              aria-label="Close profile dialog"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>

            <div className="px-5 pb-5 pt-8 sm:px-7 sm:pt-9">
              <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
                <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full shadow-lg">
                  <Image
                    src="/icon.ico"
                    alt="Home icon avatar"
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                </div>
                <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700">
                  {authUser?.job_title?.trim() || title}
                </h2>
                <p className="mt-1 text-sm text-brand-gray-500">
                  {authUser?.full_name?.trim() || "Learner"}
                </p>
                {authUser?.email && (
                  <p className="mt-1 text-xs text-brand-gray-400">{authUser.email}</p>
                )}

                <div className="mt-4" />
              </div>

              <div className="mx-auto mt-5 w-full max-w-xl space-y-3">
                <section className="rounded-3xl border border-brand-gray-100 bg-white/90 p-4">
                  <h3 className="mb-3 font-heading text-sm font-bold text-brand-gray-600">
                    Account Snapshot
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <ProfileStatBox
                      label="Credits"
                      value={String(authUser?.credits ?? 0)}
                    />
                    <ProfileStatBox
                      label="Daily Goal"
                      value={
                        authUser?.daily_learning_goal_minutes
                          ? `${authUser.daily_learning_goal_minutes} min`
                          : "Not set"
                      }
                    />
                    <ProfileStatBox
                      label="Education"
                      value={authUser?.education_level || "Not set"}
                    />
                    <ProfileStatBox
                      label="Language"
                      value={authUser?.preferred_language || "Not set"}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <ProfileStatBox
                      label="Display Name"
                      value={authUser?.full_name?.trim() || "Learner"}
                    />
                    <ProfileStatBox
                      label="Job Title"
                      value={authUser?.job_title?.trim() || "Not set"}
                    />
                  </div>
                </section>

                <section className="rounded-3xl border border-brand-gray-100 bg-white/90 p-4">
                  <h3 className="mb-3 text-sm font-bold text-brand-gray-600">Preferences</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-brand-gray-600">Sound Effects</span>
                      <ProfileToggle
                        on={soundOn}
                        onChange={() => setPreferences({ soundOn: !soundOn })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-brand-gray-600">Dark/Glass Theme</span>
                      <ProfileToggle
                        on={darkGlass}
                        onChange={() => setPreferences({ darkGlass: !darkGlass })}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="shrink-0 text-sm text-brand-gray-600">Difficulty</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={difficulty}
                        onChange={(e) =>
                          setPreferences({ difficulty: Number(e.target.value) })
                        }
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-brand-gray-200 accent-brand-teal"
                      />
                    </div>
                  </div>
                </section>
              </div>

              <div className="mx-auto mt-4 flex w-full max-w-xl justify-end">
                <button
                  onClick={handleLogout}
                  className="rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
