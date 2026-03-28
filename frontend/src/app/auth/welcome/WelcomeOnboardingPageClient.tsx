"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import MascotHint from "@/components/ui/MascotHint";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { syncPersistedProfile } from "@/lib/auth/profileSync";
import type { UserProfile } from "@/lib/apiTypes";
import { useAuthStore } from "@/stores/app/useAuthStore";
import useUserStore from "@/stores/app/useUserStore";

interface TopicOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  ring: string;
}

interface Step {
  key: string;
  title: string;
  mascotMsg: string;
}

const TOPICS: TopicOption[] = [
  { id: "tech", label: "Tech", icon: <TechIcon />, ring: "ring-[#5BB5B0]" },
  { id: "history", label: "History", icon: <HistoryIcon />, ring: "ring-[#C4A06A]" },
  { id: "medicine", label: "Medicine", icon: <MedicineIcon />, ring: "ring-[#5BB5B0]" },
  { id: "arts", label: "Arts", icon: <ArtsIcon />, ring: "ring-[#D4765A]" },
  { id: "literature", label: "Literature", icon: <LiteratureIcon />, ring: "ring-[#9B6DBF]" },
  { id: "science", label: "Science", icon: <ScienceIcon />, ring: "ring-[#9B6DBF]" },
];

const STEPS: Step[] = [
  { key: "topics", title: "Welcome, Explorer,", mascotMsg: "Which fields spark your interest?" },
  { key: "name", title: "What should we call you?", mascotMsg: "Give yourself an explorer name!" },
  { key: "goal", title: "Set your daily goal", mascotMsg: "How much time can you spare each day?" },
];

const GOALS = [
  { id: "casual", label: "5 min / day", desc: "Casual" },
  { id: "regular", label: "10 min / day", desc: "Regular" },
  { id: "serious", label: "20 min / day", desc: "Serious" },
  { id: "intense", label: "30 min / day", desc: "Intense" },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0, scale: 0.95 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0, scale: 0.95 }),
};

export default function WelcomeOnboardingPageClient() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [selectedGoal, setSelectedGoal] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = STEPS[step];

  const canProceed = useCallback(() => {
    if (step === 0) return selectedTopics.length > 0;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return selectedGoal !== "";
    return false;
  }, [step, selectedTopics.length, name, selectedGoal]);

  const goalToMinutes = (goal: string) => {
    switch (goal) {
      case "casual":
        return 5;
      case "regular":
        return 10;
      case "serious":
        return 20;
      case "intense":
        return 30;
      default:
        return undefined;
    }
  };

  const handleNext = async () => {
    setError("");
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep((s) => s + 1);
      return;
    }

    setIsSubmitting(true);
    completeOnboarding({ name: name.trim(), topics: selectedTopics, goal: selectedGoal });
    try {
      if (token) {
        const profile = await apiFetch<UserProfile>("/auth/me", {
          method: "PUT",
          body: JSON.stringify({
            full_name: name.trim(),
            daily_learning_goal_minutes: goalToMinutes(selectedGoal),
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

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8] overflow-hidden">
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
                <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-brand-gray-700 text-center">
                  {currentStep.title}
                </h1>
                <div className="mt-4 flex justify-center">
                  <MascotHint message={currentStep.mascotMsg} />
                </div>

                <div className="mt-8">
                  {step === 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {TOPICS.map((topic) => {
                        const selected = selectedTopics.includes(topic.id);
                        return (
                          <button
                            key={topic.id}
                            onClick={() => toggleTopic(topic.id)}
                            className={`rounded-2xl border bg-white/70 px-4 py-5 text-center transition ${
                              selected
                                ? `border-brand-teal ring-2 ${topic.ring}`
                                : "border-white/50 hover:border-brand-teal/50"
                            }`}
                          >
                            <div className="mb-3 flex justify-center">{topic.icon}</div>
                            <div className="text-sm font-semibold text-brand-gray-700">
                              {topic.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {step === 1 && (
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full rounded-2xl border border-white/50 bg-white/75 px-5 py-4 text-center text-lg text-brand-gray-700 outline-none focus:border-brand-teal"
                    />
                  )}

                  {step === 2 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {GOALS.map((goal) => {
                        const selected = selectedGoal === goal.id;
                        return (
                          <button
                            key={goal.id}
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
  return <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.45),transparent_55%)]" />;
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

function TechIcon() {
  return <div className="h-12 w-12 rounded-2xl bg-brand-teal/15" />;
}
function HistoryIcon() {
  return <div className="h-12 w-12 rounded-2xl bg-amber-200/60" />;
}
function MedicineIcon() {
  return <div className="h-12 w-12 rounded-2xl bg-emerald-200/60" />;
}
function ArtsIcon() {
  return <div className="h-12 w-12 rounded-2xl bg-orange-200/60" />;
}
function LiteratureIcon() {
  return <div className="h-12 w-12 rounded-2xl bg-fuchsia-200/60" />;
}
function ScienceIcon() {
  return <div className="h-12 w-12 rounded-2xl bg-indigo-200/60" />;
}
