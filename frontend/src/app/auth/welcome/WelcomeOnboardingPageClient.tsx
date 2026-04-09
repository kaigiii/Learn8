"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import MascotHint from "@/components/ui/MascotHint";
import { ApiError, apiFetch } from "@/lib/apiClient";
import {
  goalMinutesToPreset,
  isProfileOnboardingComplete,
  presetToGoalMinutes,
} from "@/lib/auth/onboarding";
import { syncPersistedProfile } from "@/lib/auth/profileSync";
import type { UserProfile } from "@/lib/apiTypes";
import { useAuthStore } from "@/stores/app/useAuthStore";
import useUserStore from "@/stores/app/useUserStore";

interface Step {
  key: string;
  title: string;
  mascotMsg: string;
}

const STEPS: Step[] = [
  {
    key: "name",
    title: "What should we call you?",
    mascotMsg: "Let’s set up the profile your course space will use.",
  },
  {
    key: "role",
    title: "What best describes you?",
    mascotMsg: "This helps us personalize your explanations and examples.",
  },
  {
    key: "education",
    title: "What is your education level?",
    mascotMsg: "We’ll tune the difficulty and pacing to fit your background.",
  },
  {
    key: "language",
    title: "What language do you prefer?",
    mascotMsg: "We’ll use this as the default language when AI generates lessons and course content.",
  },
  {
    key: "goal",
    title: "Set your daily goal",
    mascotMsg: "How much time can you realistically spare each day?",
  },
];

const EDUCATION_LEVELS = [
  "Middle School",
  "High School",
  "Undergraduate",
  "Graduate",
  "Professional",
  "Self-Taught",
];

const GOALS = [
  { id: "casual", label: "5 min / day", desc: "Casual" },
  { id: "regular", label: "10 min / day", desc: "Regular" },
  { id: "serious", label: "20 min / day", desc: "Serious" },
  { id: "intense", label: "30 min / day", desc: "Intense" },
];

const PREFERRED_LANGUAGES = [
  "English",
  "繁體中文",
  "简体中文",
  "日本語",
  "한국어",
  "Español",
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0, scale: 0.95 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0, scale: 0.95 }),
};

export default function WelcomeOnboardingPageClient() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const authUser = useAuthStore((s) => s.user);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = STEPS[step];

  useEffect(() => {
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    if (authUser && isProfileOnboardingComplete(authUser)) {
      router.replace("/home");
    }
  }, [authUser, router, token]);

  useEffect(() => {
    if (!authUser) return;
    setName(authUser.full_name ?? "");
    setJobTitle(authUser.job_title ?? "");
    setEducationLevel(authUser.education_level ?? "");
    setPreferredLanguage(authUser.preferred_language ?? "");
    setSelectedGoal(goalMinutesToPreset(authUser.daily_learning_goal_minutes));
  }, [authUser]);

  const canProceed = useCallback(() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return jobTitle.trim().length > 0;
    if (step === 2) return educationLevel.trim().length > 0;
    if (step === 3) return preferredLanguage.trim().length > 0;
    if (step === 4) return selectedGoal !== "";
    return false;
  }, [step, name, jobTitle, educationLevel, preferredLanguage, selectedGoal]);

  const handleNext = async () => {
    setError("");
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep((s) => s + 1);
      return;
    }

    setIsSubmitting(true);
    completeOnboarding({ name: name.trim(), topics: [], goal: selectedGoal });
    try {
      if (token) {
        const profile = await apiFetch<UserProfile>("/auth/me", {
          method: "PUT",
          body: JSON.stringify({
            full_name: name.trim(),
            job_title: jobTitle.trim(),
            education_level: educationLevel.trim(),
            preferred_language: preferredLanguage.trim(),
            daily_learning_goal_minutes: presetToGoalMinutes(selectedGoal),
          }),
        });
        syncPersistedProfile(profile);
      }
      router.push("/home");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail
          : "Failed to save your onboarding profile."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden app-shared-bg">
      <BgEffects />
      {step > 0 && <SideHint side="left" step={STEPS[step - 1]} />}
      {step < STEPS.length - 1 && <SideHint side="right" step={STEPS[step + 1]} />}

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        <motion.div
          className="w-full max-w-2xl cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_e, info) => {
            if (info.offset.x < -80 && canProceed()) void handleNext();
            if (info.offset.x > 80) handleBack();
          }}
        >
          <DeepGlassCard className="px-6 py-8 md:px-8 md:py-10">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep.key}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <h1 className="text-center font-heading text-3xl font-extrabold text-brand-gray-700 md:text-4xl">
                  {currentStep.title}
                </h1>
                <div className="mt-4 flex justify-center">
                  <MascotHint message={currentStep.mascotMsg} />
                </div>

                <div className="mt-8">
                  {step === 0 && (
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full rounded-2xl border border-white/50 bg-white/75 px-5 py-4 text-center text-lg text-brand-gray-700 outline-none focus:border-brand-teal"
                    />
                  )}

                  {step === 1 && (
                    <input
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="Student, Product Designer, Physician..."
                      className="w-full rounded-2xl border border-white/50 bg-white/75 px-5 py-4 text-center text-lg text-brand-gray-700 outline-none focus:border-brand-teal"
                    />
                  )}

                  {step === 2 && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {EDUCATION_LEVELS.map((level) => {
                        const selected = educationLevel === level;
                        return (
                          <button
                            key={level}
                            type="button"
                            onClick={() => setEducationLevel(level)}
                            className={`rounded-2xl border px-5 py-5 text-left transition ${
                              selected
                                ? "border-brand-teal bg-brand-teal/10"
                                : "border-white/50 bg-white/70 hover:border-brand-teal/40"
                            }`}
                          >
                            <div className="font-semibold text-brand-gray-700">
                              {level}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {step === 3 && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {PREFERRED_LANGUAGES.map((language) => {
                        const selected = preferredLanguage === language;
                        return (
                          <button
                            key={language}
                            type="button"
                            onClick={() => setPreferredLanguage(language)}
                            className={`rounded-2xl border px-5 py-5 text-left transition ${
                              selected
                                ? "border-brand-teal bg-brand-teal/10"
                                : "border-white/50 bg-white/70 hover:border-brand-teal/40"
                            }`}
                          >
                            <div className="font-semibold text-brand-gray-700">
                              {language}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {step === 4 && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {GOALS.map((goal) => {
                        const selected = selectedGoal === goal.id;
                        return (
                          <button
                            key={goal.id}
                            type="button"
                            onClick={() => setSelectedGoal(goal.id)}
                            className={`rounded-2xl border px-5 py-5 text-left transition ${
                              selected
                                ? "border-brand-teal bg-brand-teal/10"
                                : "border-white/50 bg-white/70 hover:border-brand-teal/40"
                            }`}
                          >
                            <div className="font-semibold text-brand-gray-700">
                              {goal.label}
                            </div>
                            <div className="mt-1 text-sm text-brand-gray-500">
                              {goal.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {error && (
                  <p className="mt-4 text-center text-sm text-rose-500">{error}</p>
                )}

                <div className="mt-8 flex items-center justify-between gap-4">
                  <GameButton
                    onClick={handleBack}
                    disabled={step === 0}
                    className="min-w-[120px] opacity-100 disabled:opacity-40"
                  >
                    Back
                  </GameButton>
                  <GameButton
                    onClick={() => void handleNext()}
                    disabled={!canProceed() || isSubmitting}
                    className="min-w-[160px]"
                  >
                    {isSubmitting
                      ? "Saving..."
                      : step === STEPS.length - 1
                        ? "Enter Learn8"
                        : "Next"}
                  </GameButton>
                </div>
              </motion.div>
            </AnimatePresence>
          </DeepGlassCard>
        </motion.div>
      </main>
    </div>
  );
}

function BgEffects() {
  return (
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_55%)]" />
  );
}

function SideHint({ side, step }: { side: "left" | "right"; step: Step }) {
  return (
    <div
      className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 xl:block ${side === "left" ? "left-10" : "right-10"}`}
    >
      <div className="max-w-[180px] rounded-2xl bg-white/30 px-4 py-3 text-sm text-brand-gray-500 backdrop-blur-md">
        {step.mascotMsg}
      </div>
    </div>
  );
}
