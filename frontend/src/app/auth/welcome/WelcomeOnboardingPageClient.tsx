"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import MascotHint from "@/components/ui/MascotHint";
import { ApiError, apiFetch } from "@/lib/apiClient";
import {
  goalMinutesToPreset,
  isProfileOnboardingComplete,
  presetToGoalMinutes,
} from "@/lib/auth/onboarding";
import { syncPersistedProfile, uploadAuthenticatedAvatar } from "@/lib/auth/profileSync";
import type { UserProfile } from "@/lib/apiTypes";
import {
  DEFAULT_LANGUAGE_LABEL,
  resolveLanguageLabel,
} from "@/lib/i18n/languages";
import { useI18n } from "@/lib/i18n/useI18n";
import type { TranslationKey } from "@/lib/i18n/translations";
import { useAuthStore } from "@/stores/app/useAuthStore";
import useUserStore from "@/stores/app/useUserStore";

interface Step {
  key: string;
  titleKey: TranslationKey;
  mascotKey: TranslationKey;
}

const STEPS: Step[] = [
  {
    key: "name",
    titleKey: "onboarding.step.name.title",
    mascotKey: "onboarding.step.name.mascot",
  },
  {
    key: "role",
    titleKey: "onboarding.step.role.title",
    mascotKey: "onboarding.step.role.mascot",
  },
  {
    key: "education",
    titleKey: "onboarding.step.education.title",
    mascotKey: "onboarding.step.education.mascot",
  },
  {
    key: "language",
    titleKey: "onboarding.step.language.title",
    mascotKey: "onboarding.step.language.mascot",
  },
  {
    key: "goal",
    titleKey: "onboarding.step.goal.title",
    mascotKey: "onboarding.step.goal.mascot",
  },
  {
    key: "avatar",
    titleKey: "onboarding.step.avatar.title",
    mascotKey: "onboarding.step.avatar.mascot",
  },
];

const EDUCATION_LEVELS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: "Middle School", labelKey: "onboarding.education.middleSchool" },
  { value: "High School", labelKey: "onboarding.education.highSchool" },
  { value: "Undergraduate", labelKey: "onboarding.education.undergraduate" },
  { value: "Graduate", labelKey: "onboarding.education.graduate" },
  { value: "Professional", labelKey: "onboarding.education.professional" },
  { value: "Self-Taught", labelKey: "onboarding.education.selfTaught" },
];

const GOALS: Array<{ id: string; labelKey: TranslationKey; descKey: TranslationKey }> = [
  { id: "casual", labelKey: "onboarding.goal.casual.label", descKey: "onboarding.goal.casual.desc" },
  { id: "regular", labelKey: "onboarding.goal.regular.label", descKey: "onboarding.goal.regular.desc" },
  { id: "serious", labelKey: "onboarding.goal.serious.label", descKey: "onboarding.goal.serious.desc" },
  { id: "intense", labelKey: "onboarding.goal.intense.label", descKey: "onboarding.goal.intense.desc" },
];

const DEFAULT_AVATARS = [
  { id: "chicken", label: "Chicken", src: "/avatar/chicken.png" },
  { id: "dog", label: "Dog", src: "/avatar/dog.png" },
  { id: "beer", label: "Bear", src: "/avatar/beer.png" },
  { id: "elephant", label: "Elephant", src: "/avatar/elephant.png" },
  { id: "penguin", label: "Penguin", src: "/avatar/penguin.png" },
  { id: "monkey", label: "Monkey", src: "/avatar/monkey.png" },
  { id: "owl", label: "Owl", src: "/avatar/owl.png" },
  { id: "fox", label: "Fox", src: "/avatar/fox.png" },
  { id: "panda", label: "Panda", src: "/avatar/panda.png" },
  { id: "sheep", label: "Sheep", src: "/avatar/sheep.png" },
  { id: "tiger", label: "Tiger", src: "/avatar/tiger.png" },
] as const;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0, scale: 0.95 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0, scale: 0.95 }),
};

async function createImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load selected image."));
    image.src = src;
  });
}

async function cropImageToPngBlob(imageSrc: string, cropArea: Area) {
  const image = await createImageElement(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cropArea.width));
  canvas.height = Math.max(1, Math.round(cropArea.height));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to initialize image crop canvas.");
  }

  context.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to generate cropped image."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export default function WelcomeOnboardingPageClient() {
  const router = useRouter();
  const { t, setLanguageLabel, languageOptions } = useI18n();
  const token = useAuthStore((s) => s.token);
  const authUser = useAuthStore((s) => s.user);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<string>(DEFAULT_LANGUAGE_LABEL);
  const [selectedGoal, setSelectedGoal] = useState("");
  const [avatarChoice, setAvatarChoice] = useState<"" | "default" | "upload">("default");
  const [selectedDefaultAvatar, setSelectedDefaultAvatar] = useState<string>(DEFAULT_AVATARS[0].src);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const uploadAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const hasInitializedFromProfileRef = useRef(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState("avatar.png");
  const [cropPoint, setCropPoint] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);
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
    if (hasInitializedFromProfileRef.current) return;
    hasInitializedFromProfileRef.current = true;
    setName(authUser.full_name ?? "");
    setJobTitle(authUser.job_title ?? "");
    setEducationLevel(authUser.education_level ?? "");
    const normalizedLanguage = resolveLanguageLabel(authUser.preferred_language);
    setPreferredLanguage(normalizedLanguage);
    setLanguageLabel(normalizedLanguage);
    setSelectedGoal(goalMinutesToPreset(authUser.daily_learning_goal_minutes));
    setAvatarChoice("default");
    setSelectedDefaultAvatar(DEFAULT_AVATARS[0].src);
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
  }, [authUser, setLanguageLabel]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    return () => {
      if (cropSourceUrl) {
        URL.revokeObjectURL(cropSourceUrl);
      }
    };
  }, [cropSourceUrl]);

  const closeCropModal = useCallback(() => {
    setIsCropModalOpen(false);
    setCropPoint({ x: 0, y: 0 });
    setCropZoom(1);
    setCropPixels(null);
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
    }
    setCropSourceUrl(null);
    setCropFileName("avatar.png");
  }, [cropSourceUrl]);

  const confirmAvatarCrop = useCallback(async () => {
    if (!cropSourceUrl || !cropPixels) {
      setError(t("onboarding.error.adjustCrop"));
      return;
    }

    setIsCropping(true);
    try {
      const croppedBlob = await cropImageToPngBlob(cropSourceUrl, cropPixels);
      const normalizedBaseName = cropFileName.replace(/\.[^/.]+$/, "") || "avatar";
      const croppedFile = new File([croppedBlob], `${normalizedBaseName}.png`, { type: "image/png" });

      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }

      const nextPreviewUrl = URL.createObjectURL(croppedFile);
      setAvatarFile(croppedFile);
      setAvatarPreviewUrl(nextPreviewUrl);
      setAvatarChoice("upload");
      await uploadAuthenticatedAvatar(croppedFile);
      setError("");
      closeCropModal();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : t("onboarding.error.uploadAvatar")
      );
    } finally {
      setIsCropping(false);
    }
  }, [avatarPreviewUrl, closeCropModal, cropFileName, cropPixels, cropSourceUrl, t]);

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      return;
    }

    if (!nextFile.type.startsWith("image/")) {
      setError(t("onboarding.error.chooseImage"));
      return;
    }

    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
    }

    const nextCropSourceUrl = URL.createObjectURL(nextFile);
    setError("");
    setCropFileName(nextFile.name || "avatar.png");
    setCropSourceUrl(nextCropSourceUrl);
    setCropPoint({ x: 0, y: 0 });
    setCropZoom(1);
    setCropPixels(null);
    setIsCropModalOpen(true);

    // Allow re-selecting the same file in subsequent uploads.
    event.currentTarget.value = "";
  };

  const uploadSelectedDefaultAvatar = useCallback(async (avatarSrc: string) => {
    const response = await fetch(avatarSrc);
    if (!response.ok) {
      throw new Error("Failed to load selected default avatar.");
    }

    const avatarBlob = await response.blob();
    const filename = avatarSrc.split("/").pop() || "default-avatar.png";
    const avatarFile = new File([avatarBlob], filename, {
      type: avatarBlob.type || "image/png",
    });

    await uploadAuthenticatedAvatar(avatarFile);
  }, []);

  const canProceed = useCallback(() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return jobTitle.trim().length > 0;
    if (step === 2) return educationLevel.trim().length > 0;
    if (step === 3) return preferredLanguage.trim().length > 0;
    if (step === 4) return selectedGoal !== "";
    if (step === 5)
      return (
        (avatarChoice === "default" && Boolean(selectedDefaultAvatar)) ||
        (avatarChoice === "upload" && avatarFile !== null)
      );
    return false;
  }, [
    step,
    name,
    jobTitle,
    educationLevel,
    preferredLanguage,
    selectedGoal,
    avatarChoice,
    selectedDefaultAvatar,
    avatarFile,
  ]);

  const handleLanguageSelect = useCallback(
    (language: string) => {
      setPreferredLanguage(language);
      setLanguageLabel(language);
    },
    [setLanguageLabel]
  );

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

        if (avatarChoice === "upload" && avatarFile) {
          await uploadAuthenticatedAvatar(avatarFile);
        } else if (avatarChoice === "default") {
          await uploadSelectedDefaultAvatar(selectedDefaultAvatar);
        }
      }
      router.push("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t("onboarding.error.saveProfile"));
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
      {isCropModalOpen && cropSourceUrl ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={closeCropModal}
          />

          <div className="relative z-10 w-full max-w-2xl rounded-[28px] border border-brand-gray-200 bg-white p-5 shadow-[0_26px_60px_rgba(15,23,42,0.25)] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 sm:text-3xl">
                {t("onboarding.avatar.cropTitle")}
              </h2>
              <button
                type="button"
                onClick={closeCropModal}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-gray-200 bg-white text-brand-gray-500 transition hover:text-brand-gray-700"
                aria-label="Close crop dialog"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mt-2 text-sm text-brand-gray-500">
              {t("onboarding.avatar.cropHint")}
            </p>

            <div className="relative mt-5 h-[320px] overflow-hidden rounded-2xl border border-brand-gray-200 bg-white">
              <Cropper
                image={cropSourceUrl}
                crop={cropPoint}
                zoom={cropZoom}
                zoomSpeed={0.2}
                aspect={1}
                cropShape="round"
                showGrid={false}
                objectFit="horizontal-cover"
                onCropChange={setCropPoint}
                onZoomChange={setCropZoom}
                onCropComplete={(_area, areaPixels) => setCropPixels(areaPixels)}
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm font-semibold text-brand-gray-600">{t("common.zoom")}</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.005}
                value={cropZoom}
                onChange={(event) => setCropZoom(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-brand-gray-200 accent-brand-teal"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeCropModal}
                className="rounded-xl border border-brand-gray-300 px-4 py-2 text-sm font-semibold text-brand-gray-600 transition hover:bg-brand-gray-100"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void confirmAvatarCrop()}
                disabled={isCropping || !cropPixels}
                className="rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isCropping ? t("common.uploading") : t("onboarding.avatar.setNew")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
                  {t(currentStep.titleKey)}
                </h1>
                <div className="mt-4 flex justify-center">
                  <MascotHint message={t(currentStep.mascotKey)} />
                </div>

                <div className="mt-8">
                  {step === 0 && (
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("onboarding.placeholder.name")}
                      className="w-full rounded-2xl border border-white/50 bg-white/75 px-5 py-4 text-center text-lg text-brand-gray-700 outline-none focus:border-brand-teal"
                    />
                  )}

                  {step === 1 && (
                    <input
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder={t("onboarding.placeholder.role")}
                      className="w-full rounded-2xl border border-white/50 bg-white/75 px-5 py-4 text-center text-lg text-brand-gray-700 outline-none focus:border-brand-teal"
                    />
                  )}

                  {step === 2 && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {EDUCATION_LEVELS.map((level) => {
                        const selected = educationLevel === level.value;
                        return (
                          <button
                            key={level.value}
                            type="button"
                            onClick={() => setEducationLevel(level.value)}
                            className={`rounded-2xl border px-5 py-5 text-left transition ${
                              selected
                                ? "border-brand-teal bg-brand-teal/10"
                                : "border-white/50 bg-white/70 hover:border-brand-teal/40"
                            }`}
                          >
                            <div className="font-semibold text-brand-gray-700">
                              {t(level.labelKey)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {step === 3 && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {languageOptions.map((option) => {
                        const selected = preferredLanguage === option.label;
                        return (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => handleLanguageSelect(option.label)}
                            className={`rounded-2xl border px-5 py-5 text-left transition ${
                              selected
                                ? "border-brand-teal bg-brand-teal/10"
                                : "border-white/50 bg-white/70 hover:border-brand-teal/40"
                            }`}
                          >
                            <div className="font-semibold text-brand-gray-700">
                              {option.label}
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
                              {t(goal.labelKey)}
                            </div>
                            <div className="mt-1 text-sm text-brand-gray-500">
                              {t(goal.descKey)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {step === 5 && (
                    <div className="space-y-4">
                      <div className="rounded-2xl px-5 py-5 text-left">
                        <div className="font-semibold text-brand-gray-700">{t("onboarding.avatar.title")}</div>
                        <div className="mt-1 text-sm text-brand-gray-500">
                          {t("onboarding.avatar.hint")}
                        </div>

                        <input
                          ref={uploadAvatarInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarFileChange}
                          className="hidden"
                        />

                        <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-6">
                          <button
                            type="button"
                            onClick={() => {
                              uploadAvatarInputRef.current?.click();
                            }}
                            className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white/55 transition focus:outline-none focus:ring-2 focus:ring-brand-teal/45 ${
                              avatarChoice === "upload"
                                ? "ring-2 ring-brand-teal"
                                : "ring-1 ring-transparent hover:ring-brand-teal/40"
                            }`}
                            aria-label={t("onboarding.avatar.uploadCustom")}
                            aria-pressed={avatarChoice === "upload"}
                          >
                            {avatarPreviewUrl ? (
                              <img
                                src={avatarPreviewUrl}
                                alt="Uploaded avatar preview"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-7 w-7 text-brand-gray-700"
                                aria-hidden="true"
                              >
                                <path d="M12 16V5" />
                                <path d="m7.5 9.5 4.5-4.5 4.5 4.5" />
                                <path d="M18.5 14.5v2a3.5 3.5 0 0 1-3.5 3.5h-6a3.5 3.5 0 0 1-3.5-3.5v-2" />
                              </svg>
                            )}
                          </button>

                          {DEFAULT_AVATARS.map((avatar) => {
                            const isSelected =
                              avatarChoice === "default" && selectedDefaultAvatar === avatar.src;

                            return (
                              <button
                                key={avatar.id}
                                type="button"
                                onClick={() => {
                                  setAvatarChoice("default");
                                  setSelectedDefaultAvatar(avatar.src);
                                  if (avatarPreviewUrl) {
                                    URL.revokeObjectURL(avatarPreviewUrl);
                                  }
                                  setAvatarFile(null);
                                  setAvatarPreviewUrl(null);
                                }}
                                className={`relative h-12 w-12 overflow-hidden rounded-full bg-transparent transition focus:outline-none focus:ring-2 focus:ring-brand-teal/45 ${
                                  isSelected
                                    ? "ring-2 ring-brand-teal"
                                    : "ring-1 ring-transparent hover:ring-brand-teal/40"
                                }`}
                                aria-label={`Use ${avatar.label} avatar`}
                                aria-pressed={isSelected}
                              >
                                <img
                                  src={avatar.src}
                                  alt={`${avatar.label} avatar`}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>

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
                    {t("common.back")}
                  </GameButton>
                  <GameButton
                    onClick={() => void handleNext()}
                    disabled={!canProceed() || isSubmitting}
                    className="min-w-[160px]"
                  >
                    {isSubmitting
                      ? t("common.saving")
                      : step === STEPS.length - 1
                        ? t("common.enterLearn8")
                        : t("common.next")}
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
  const { t } = useI18n();
  return (
    <div
      className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 xl:block ${side === "left" ? "left-10" : "right-10"}`}
    >
      <div className="max-w-[180px] rounded-2xl bg-white/30 px-4 py-3 text-sm text-brand-gray-500 backdrop-blur-md">
        {t(step.mascotKey)}
      </div>
    </div>
  );
}
