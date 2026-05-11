"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileStatBox } from "./components/ProfileStatBox";
import { ProfileToggle } from "./components/ProfileToggle";
import { useProfileSettings } from "./hooks/useProfileSettings";
import { useI18n } from "@/lib/i18n/useI18n";

interface ProfileSettingsDialogProps {
  onClose: () => void;
}

export default function ProfileSettingsDialog({ onClose }: ProfileSettingsDialogProps) {
  const router = useRouter();
  const { t } = useI18n();
  const {
    authUser,
    title,
    preferences,
    setPreferences,
    handleLogout,
  } = useProfileSettings(onClose);

  const { soundOn, darkGlass, difficulty, voiceAssistant, autoPlaySpeech } = preferences;

  const openProfilePanel = (panel: "personal" | "wallet") => {
    onClose();
    router.push(`/profile?panel=${panel}`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/30 backdrop-blur-[4px] will-change-[opacity]"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Modal card */}
        <motion.div
          className="relative z-10 mx-4 w-full max-w-2xl transform-gpu will-change-[transform,opacity]"
          initial={{ scale: 0.9, opacity: 0, y: 28 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative max-h-[86vh] overflow-y-auto rounded-[32px] border border-white/60 bg-white/90 shadow-[0_30px_70px_rgba(15,23,42,0.24)] backdrop-blur-lg">
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
                    src="/icons/icon.ico"
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
                  {authUser?.full_name?.trim() || t("common.learner")}
                </p>
                {authUser?.email && (
                  <p className="mt-1 text-xs text-brand-gray-400">{authUser.email}</p>
                )}

                <div className="mt-4" />
              </div>

              <div className="mx-auto mt-5 w-full max-w-xl space-y-3">
                <section className="rounded-3xl border border-brand-gray-100 bg-white/90 p-4">
                  <h3 className="mb-3 font-heading text-sm font-bold text-brand-gray-600">
                    {t("common.accountSnapshot")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <ProfileStatBox
                      label={t("common.credits")}
                      value={String(authUser?.credits ?? 0)}
                    />
                    <ProfileStatBox
                      label={t("common.dailyGoal")}
                      value={
                        authUser?.daily_learning_goal_minutes
                          ? t("profile.dailyGoalValue", {
                              minutes: authUser.daily_learning_goal_minutes,
                            })
                          : t("common.notSet")
                      }
                    />
                    <ProfileStatBox
                      label={t("common.education")}
                      value={authUser?.education_level || t("common.notSet")}
                    />
                    <ProfileStatBox
                      label={t("common.language")}
                      value={authUser?.preferred_language || t("common.notSet")}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <ProfileStatBox
                      label={t("common.displayName")}
                      value={authUser?.full_name?.trim() || t("common.learner")}
                    />
                    <ProfileStatBox
                      label={t("common.jobTitle")}
                      value={authUser?.job_title?.trim() || t("common.notSet")}
                    />
                  </div>
                </section>

                <section className="rounded-3xl border border-brand-gray-100 bg-white/90 p-4">
                  <h3 className="mb-3 text-sm font-bold text-brand-gray-600">{t("common.preferences")}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-brand-gray-600">{t("common.soundEffects")}</span>
                      <ProfileToggle
                        on={soundOn}
                        onChange={() => setPreferences({ soundOn: !soundOn })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-brand-gray-600">{t("common.darkGlassTheme")}</span>
                      <ProfileToggle
                        on={darkGlass}
                        onChange={() => setPreferences({ darkGlass: !darkGlass })}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="shrink-0 text-sm text-brand-gray-600">{t("common.aiVoiceAssistant")}</span>
                      <select
                        value={voiceAssistant || "preset_01"}
                        onChange={(e) => setPreferences({ voiceAssistant: e.target.value })}
                        className="rounded-lg border border-brand-gray-200 bg-white px-2 py-1 text-xs text-brand-gray-700 shadow-sm outline-none transition focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
                      >
                        <option value="preset_01">{t("voice.preset01.label")}</option>
                        <option value="preset_02">{t("voice.preset02.label")}</option>
                        <option value="preset_03">{t("voice.preset03.label")}</option>
                        <option value="preset_04">{t("voice.preset04.label")}</option>
                        <option value="preset_05">{t("voice.preset05.label")}</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-brand-gray-600">{t("common.autoPlaySpeech")}</span>
                      <ProfileToggle
                        on={!!autoPlaySpeech}
                        onChange={() => setPreferences({ autoPlaySpeech: !autoPlaySpeech })}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="shrink-0 text-sm text-brand-gray-600">{t("common.difficulty")}</span>
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
                  {t("common.logOut")}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
