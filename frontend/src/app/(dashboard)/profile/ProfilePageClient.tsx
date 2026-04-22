"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import Cropper, { type Area } from "react-easy-crop";

import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import { ProfileStatBox } from "@/features/profile/components/ProfileStatBox";
import { ProfileToggle } from "@/features/profile/components/ProfileToggle";
import { useProfileSettings } from "@/features/profile/hooks/useProfileSettings";
import { AnimatePresence, motion } from "framer-motion";
import { ApiError, resolveErrorMessage } from "@/lib/apiClient";
import { fetchArenaProfile, fetchArenaRankHistory } from "@/lib/arena/api";
import { uploadAuthenticatedAvatar } from "@/lib/auth/profileSync";
import type { ArenaProfile, ArenaRankHistoryEntry, UserLedgerEvent } from "@/lib/apiTypes";
import useUserStore, { selectUserProgression } from "@/stores/app/useUserStore";

type OverlayPanel = "personal" | "wallet" | null;

type ProfileFormState = {
  full_name: string;
  job_title: string;
  education_level: string;
  preferred_language: string;
  daily_learning_goal_minutes: string;
};

type PreferenceState = {
  soundOn: boolean;
  darkGlass: boolean;
  difficulty: number;
};

const PREFERRED_LANGUAGES = [
  "English",
  "繁體中文",
  "简体中文",
  "日本語",
  "한국어",
  "Español",
];

const EDUCATION_LEVELS = [
  "Middle School",
  "High School",
  "Undergraduate",
  "Graduate",
  "Professional",
  "Self-Taught",
];

const DAILY_GOAL_OPTIONS = [
  { value: "5", label: "5 min" },
  { value: "10", label: "10 min" },
  { value: "20", label: "20 min" },
  { value: "30", label: "30 min" },
];

const PRESET_AVATARS = [
  "chicken",
  "dog",
  "elephant",
  "fox",
  "monkey",
  "owl",
  "panda",
  "penguin",
  "sheep",
  "tiger",
  "beer",
];

async function createImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
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

export default function ProfilePageClient() {
  const searchParams = useSearchParams();
  const panelParam = searchParams.get("panel");
  const [activeOverlay, setActiveOverlay] = useState<OverlayPanel>(null);

  const {
    authUser,
    title,
    preferences,
    form,
    setForm,
    saving,
    ledgerLoading,
    ledgerItems,
    error,
    setPreferences,
    handleSaveProfile,
    handleLogout,
  } = useProfileSettings(() => setActiveOverlay(null));

  const progression = useUserStore(selectUserProgression);
  const [arenaProfile, setArenaProfile] = useState<ArenaProfile | null>(null);
  const [arenaHistory, setArenaHistory] = useState<ArenaRankHistoryEntry[]>([]);
  const [arenaLoading, setArenaLoading] = useState(true);
  const [arenaError, setArenaError] = useState<string | null>(null);

  const displayName = authUser?.full_name?.trim() || form.full_name || "Learner";
  const profileLabel = authUser?.job_title?.trim() || authUser?.education_level?.trim() || title || "Learner";
  const initial = displayName.slice(0, 1).toUpperCase() || "P";
  const avatarUrl = authUser?.avatar_url?.trim() || null;
  const [profileAvatarSrc, setProfileAvatarSrc] = useState(avatarUrl || "/avatar/chicken.png");
  const uploadAvatarInputRef = useRef<HTMLInputElement>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isAvatarSelectorOpen, setIsAvatarSelectorOpen] = useState(false);
  const [selectedAvatarPreview, setSelectedAvatarPreview] = useState<string | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState("avatar.png");
  const [cropPoint, setCropPoint] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [isApplyingPresetAvatar, setIsApplyingPresetAvatar] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState("");

  useEffect(() => {
    setProfileAvatarSrc(avatarUrl || "/avatar/chicken.png");
  }, [avatarUrl]);

  useEffect(() => {
    return () => {
      if (cropSourceUrl) {
        URL.revokeObjectURL(cropSourceUrl);
      }
    };
  }, [cropSourceUrl]);

  const closeCropModal = () => {
    setIsCropModalOpen(false);
    setCropPoint({ x: 0, y: 0 });
    setCropZoom(1);
    setCropPixels(null);
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
    }
    setCropSourceUrl(null);
    setCropFileName("avatar.png");
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      return;
    }
    if (!nextFile.type.startsWith("image/")) {
      setAvatarUploadError("Please choose an image file.");
      return;
    }
    if (cropSourceUrl) {
      URL.revokeObjectURL(cropSourceUrl);
    }
    const nextCropSourceUrl = URL.createObjectURL(nextFile);
    setAvatarUploadError("");
    setCropFileName(nextFile.name || "avatar.png");
    setCropSourceUrl(nextCropSourceUrl);
    setCropPoint({ x: 0, y: 0 });
    setCropZoom(1);
    setCropPixels(null);
    setIsCropModalOpen(true);
    event.currentTarget.value = "";
  };

  const handleConfirmAvatarCrop = async () => {
    if (!cropSourceUrl || !cropPixels) {
      setAvatarUploadError("Please adjust the crop area first.");
      return;
    }
    setIsCropping(true);
    try {
      const croppedBlob = await cropImageToPngBlob(cropSourceUrl, cropPixels);
      const normalizedBaseName = cropFileName.replace(/\.[^/.]+$/, "") || "avatar";
      const croppedFile = new File([croppedBlob], `${normalizedBaseName}.png`, { type: "image/png" });
      await uploadAuthenticatedAvatar(croppedFile);
      setAvatarUploadError("");
      closeCropModal();
    } catch (caughtError) {
      setAvatarUploadError(
        caughtError instanceof ApiError
          ? caughtError.detail
          : "Failed to upload avatar. Please try another file."
      );
    } finally {
      setIsCropping(false);
    }
  };

  const handleConfirmPresetAvatar = async () => {
    if (!selectedAvatarPreview) {
      setIsAvatarSelectorOpen(false);
      return;
    }

    setIsApplyingPresetAvatar(true);
    setAvatarUploadError("");
    try {
      const response = await fetch(selectedAvatarPreview);
      if (!response.ok) {
        throw new Error("Failed to load preset avatar image.");
      }

      const presetBlob = await response.blob();
      const presetName = selectedAvatarPreview.split("/").pop()?.replace(/\.png$/i, "") || "avatar";
      const presetFile = new File([presetBlob], `${presetName}.png`, { type: "image/png" });
      await uploadAuthenticatedAvatar(presetFile);
      setSelectedAvatarPreview(null);
      setIsAvatarSelectorOpen(false);
    } catch (caughtError) {
      setAvatarUploadError(
        caughtError instanceof ApiError
          ? caughtError.detail
          : "Failed to save preset avatar. Please try again."
      );
    } finally {
      setIsApplyingPresetAvatar(false);
    }
  };

  const arenaTopTopics = useMemo(
    () => [...(arenaProfile?.topicRatings ?? [])].sort((left, right) => right.rating - left.rating).slice(0, 4),
    [arenaProfile?.topicRatings]
  );
  const arenaRecentMomentum = useMemo(
    () => arenaHistory.slice(0, 5).reduce((sum, entry) => sum + entry.ratingDelta, 0),
    [arenaHistory]
  );
  const recentOutcomeTrends = useMemo(() => resolveRecentOutcomeTrends(arenaHistory), [arenaHistory]);

  useEffect(() => {
    let cancelled = false;
    setArenaLoading(true);
    setArenaError(null);

    void (async () => {
      try {
        const [nextArenaProfile, nextArenaHistory] = await Promise.all([
          fetchArenaProfile(),
          fetchArenaRankHistory(8),
        ]);
        if (cancelled) {
          return;
        }
        setArenaProfile(nextArenaProfile);
        setArenaHistory(nextArenaHistory.items);
      } catch (caughtError) {
        if (!cancelled) {
          setArenaError(resolveErrorMessage(caughtError, "Unable to load Arena competitive profile right now."));
        }
      } finally {
        if (!cancelled) {
          setArenaLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (panelParam === "personal" || panelParam === "wallet") {
      setActiveOverlay(panelParam);
    }
  }, [panelParam]);

  const seasonLabel = arenaProfile?.activeSeason ?? "Initial Season";
  const rankPosition = arenaProfile?.seasonPlacement != null ? `#${arenaProfile.seasonPlacement}` : (arenaProfile?.rankTier ?? "Bronze");
  const seasonBadgeValue = arenaLoading ? "..." : arenaProfile?.seasonBadge ?? "None";
  const seasonBadgeVisual = arenaLoading ? null : resolveSeasonBadgeVisual(seasonBadgeValue);
  const seasonTitleTagline = arenaLoading ? "..." : resolveRankTierTagline(arenaProfile?.rankTier);
  const normalizedSeasonPercentile = Math.min(100, Math.max(0, arenaProfile?.seasonPercentile ?? 0));
  const seasonPercentileTagline = arenaLoading
    ? "..."
    : `Ahead of ${Number.isInteger(normalizedSeasonPercentile) ? normalizedSeasonPercentile.toFixed(0) : normalizedSeasonPercentile.toFixed(1)}% players`;

  return (
    <div className="relative min-h-screen overflow-hidden app-shared-bg">
      <TopStatsBar
        backHref="/home"
        pageTitle="Profile"
        quickLinks={[
          {
            href: "/multiplayer",
            label: "Multiplayer",
            iconSrc: "/svg/multiplayer-controller.svg",
            iconAlt: "Multiplayer",
          },
          {
            href: "/arena/leaderboard",
            label: "Leaderboard",
            iconSrc: "/svg/leaderboard-logo.svg",
            iconAlt: "Leaderboard",
          },
        ]}
      />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
        <DeepGlassCard className="overflow-hidden border border-white/70 bg-white/78 px-6 py-6 shadow-[0_24px_60px_rgba(31,41,55,0.12)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                <Image
                  src={profileAvatarSrc}
                  alt={`${displayName} avatar`}
                  fill
                  sizes="64px"
                  className="object-cover"
                  onError={() => setProfileAvatarSrc("/avatar/chicken.png")}
                />
              </div>
              <div>
                <p className="font-heading text-3xl font-extrabold text-brand-gray-700">{displayName}</p>
                <p className="mt-1 text-sm text-brand-gray-500">{profileLabel}</p>
              </div>
            </div>

            <div className="w-full lg:max-w-[760px]">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <ProfileStatBox label="Credits" value={String(authUser?.credits ?? 0)} />
                <ProfileStatBox label="Level" value={String(progression.level)} />
                <ProfileStatBox label="XP" value={String(progression.xp)} />
                <ProfileStatBox
                  label="Daily Goal"
                  value={authUser?.daily_learning_goal_minutes ? `${authUser.daily_learning_goal_minutes} min` : "Not set"}
                />

                <button
                  type="button"
                  onClick={() => setActiveOverlay("personal")}
                  className={`min-h-[58px] rounded-xl border-[1.5px] px-3 text-sm font-semibold transition ${
                    activeOverlay === "personal"
                      ? "border-[#d1d5db] bg-[#e5e7eb] text-brand-gray-700 shadow-[0_10px_20px_rgba(107,114,128,0.08)]"
                      : "border-[#d1d5db] bg-[#f3f4f6] text-brand-gray-700 hover:border-[#bfdbfe] hover:bg-[#e5e7eb]"
                  }`}
                >
                  Personal Profile
                </button>

                <button
                  type="button"
                  onClick={() => setActiveOverlay("wallet")}
                  className={`min-h-[58px] rounded-xl border-[1.5px] px-3 text-sm font-semibold transition ${
                    activeOverlay === "wallet"
                      ? "border-[#d1d5db] bg-[#e5e7eb] text-brand-gray-700 shadow-[0_10px_20px_rgba(107,114,128,0.08)]"
                      : "border-[#d1d5db] bg-[#f3f4f6] text-brand-gray-700 hover:border-[#bfdbfe] hover:bg-[#e5e7eb]"
                  }`}
                >
                  Wallet
                </button>
              </div>
            </div>
          </div>
        </DeepGlassCard>

        <DeepGlassCard className="border border-white/70 bg-white/82 px-5 py-5 shadow-[0_24px_60px_rgba(31,41,55,0.12)] md:px-6 md:py-6">
          {arenaError ? (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
              {arenaError}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[1.08fr_1.32fr_0.82fr]">
            <section className="rounded-[28px] border border-white/70 bg-white/68 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gray-500">Arena</p>
              <h2 className="mt-1 font-heading text-[29px] font-extrabold leading-tight text-brand-gray-700">Competitive Identity</h2>

              <div className="relative mt-4 overflow-hidden rounded-3xl border border-white/70 bg-gradient-to-br from-[#7f8fa3] via-[#9aa8b7] to-[#d6dce5] px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
                <div className="absolute inset-x-0 top-0 h-10 bg-white/20 blur-xl" />
                <div className="relative">
                  <Image src="/svg/leaderboard-logo.svg" alt="Season emblem" width={100} height={100} className="mx-auto h-24 w-24" />
                  <p className="mt-3 font-heading text-3xl font-extrabold text-white">{seasonLabel}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/85">
                    {arenaLoading ? "Syncing season info" : `${arenaProfile?.rankTier ?? "Bronze"} rank currently active`}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <ProfileStatBox label="Arena Rating" value={arenaLoading ? "..." : String(arenaProfile?.rating ?? 0)} />
                <ProfileStatBox label="Rank Tier" value={arenaLoading ? "..." : arenaProfile?.rankTier ?? "Unranked"} />
                <ProfileStatBox label="Rank Position" value={arenaLoading ? "..." : rankPosition} />
                <ProfileStatBox label="Win Rate" value={arenaLoading ? "..." : `${(arenaProfile?.winRate ?? 0).toFixed(1)}%`} />
                <ProfileStatBox label="Ranked Matches" value={arenaLoading ? "..." : String(arenaProfile?.rankedMatches ?? 0)} />
                <ProfileStatBox
                  label="Recent Momentum"
                  value={arenaLoading ? "..." : `${arenaRecentMomentum > 0 ? "+" : ""}${arenaRecentMomentum}`}
                />
              </div>
            </section>

            <div className="grid gap-6 xl:grid-rows-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
              <section className="flex h-full flex-col rounded-[28px] border border-white/70 bg-white/68 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gray-500">Season Honors</p>
                <h3 className="mt-1 font-heading text-[26px] font-extrabold leading-tight text-brand-gray-700">Current season identity</h3>

                <div className="mt-3 grid flex-1 grid-cols-1 items-stretch gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
                  <ArenaMetricPill
                    label="Season Badge"
                    value={seasonBadgeValue}
                    iconSrc={seasonBadgeVisual?.src}
                    iconAlt={seasonBadgeVisual?.alt}
                  />
                  <ArenaMetricPill label="Season Title" value={seasonTitleTagline} compactText />
                  <ArenaMetricPill
                    label="Percentile"
                    value={seasonPercentileTagline}
                    compactText
                  />
                </div>
              </section>

              <section className="flex h-full flex-col rounded-[28px] border border-white/70 bg-white/68 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gray-500">Match Summary</p>
                <h3 className="mt-1 font-heading text-[26px] font-extrabold leading-tight text-brand-gray-700">Competitive record</h3>

                <div className="mt-4 grid flex-1 grid-cols-1 items-stretch gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
                  <ArenaSummaryMetric
                    label="Wins"
                    value={arenaLoading ? "..." : String(recentOutcomeTrends.win[recentOutcomeTrends.win.length - 1] ?? 0)}
                    tone="win"
                    trendValues={recentOutcomeTrends.win}
                  />
                  <ArenaSummaryMetric
                    label="Losses"
                    value={arenaLoading ? "..." : String(recentOutcomeTrends.loss[recentOutcomeTrends.loss.length - 1] ?? 0)}
                    tone="loss"
                    trendValues={recentOutcomeTrends.loss}
                  />
                  <ArenaSummaryMetric
                    label="Draws"
                    value={arenaLoading ? "..." : String(recentOutcomeTrends.draw[recentOutcomeTrends.draw.length - 1] ?? 0)}
                    tone="draw"
                    trendValues={recentOutcomeTrends.draw}
                  />
                </div>
              </section>
            </div>

            <div className="grid gap-6 xl:grid-rows-[minmax(0,0.86fr)_minmax(0,1.14fr)]">
              <section className="flex h-full flex-col rounded-[28px] border border-white/70 bg-white/68 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gray-500">Strong Topics</p>
                <h3 className="mt-1 font-heading text-[26px] font-extrabold leading-tight text-brand-gray-700">Topic strengths</h3>

                {(arenaLoading || arenaTopTopics.length === 0) && (
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <p className="max-w-[170px] text-sm text-brand-gray-500">
                      {arenaLoading
                        ? "Loading topic strengths..."
                        : "Topic strengths will appear after a few Arena matches. Play to unlock."}
                    </p>
                    <Image src="/svg/topic-strengths.svg" alt="Topic strength visual" width={88} height={88} className="h-20 w-20 opacity-95" />
                  </div>
                )}

                {!arenaLoading && arenaTopTopics.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {arenaTopTopics.slice(0, 2).map((topic) => (
                      <div
                        key={topic.publicCourseId}
                        className="rounded-xl border border-white/75 bg-white/76 px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-brand-gray-700">{topic.title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

                <section className="flex h-full flex-col rounded-[28px] border border-white/70 bg-white/68 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-gray-500">Rank History</p>
                <h3 className="mt-1 font-heading text-[30px] font-extrabold leading-tight text-brand-gray-700">Recent ladder movement</h3>

                {(arenaLoading || arenaHistory.length === 0) && (
                  <div className="mt-3 flex flex-1 items-end justify-between gap-4">
                    <p className="max-w-[170px] text-sm text-brand-gray-500">
                      {arenaLoading
                        ? "Loading ladder timeline..."
                        : "Your detailed ladder and rank history will appear here after ranked matches are recorded. Rank up to fill this history."}
                    </p>
                    <Image src="/svg/rank-history-scroll.svg" alt="Rank history visual" width={90} height={90} className="h-20 w-20 opacity-95" />
                  </div>
                )}

                {!arenaLoading && arenaHistory.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {arenaHistory.slice(0, 2).map((entry, index) => (
                      <div key={`${entry.createdAt}-${entry.matchId ?? "entry"}-${index}`} className="rounded-xl border border-white/75 bg-white/76 px-3 py-2">
                        <p className="text-sm font-semibold text-brand-gray-700">
                          {entry.rankTierBefore} to {entry.rankTierAfter}
                        </p>
                        <p className="mt-1 text-xs text-brand-gray-500">
                          {entry.ratingBefore} to {entry.ratingAfter} ({entry.ratingDelta > 0 ? "+" : ""}{entry.ratingDelta})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </DeepGlassCard>
      </div>

      <AnimatePresence>
        {activeOverlay ? (
          <ProfileOverlayShell
            title={activeOverlay === "personal" ? "Personal Profile" : "Wallet"}
            onClose={() => setActiveOverlay(null)}
          >
            {activeOverlay === "personal" ? (
              <PersonalProfileContent
                form={form}
                setForm={setForm}
                saving={saving}
                error={error}
                handleSaveProfile={handleSaveProfile}
                preferences={preferences}
                setPreferences={setPreferences}
                handleLogout={handleLogout}
                uploadAvatarInputRef={uploadAvatarInputRef}
                onAvatarFileChange={handleAvatarFileChange}
                onAvatarButtonClick={() => setIsAvatarSelectorOpen(true)}
                avatarUploadError={avatarUploadError}
              />
            ) : (
              <WalletContent
                ledgerLoading={ledgerLoading}
                ledgerItems={ledgerItems}
                error={error}
              />
            )}
          </ProfileOverlayShell>
        ) : null}
      </AnimatePresence>

      {isAvatarSelectorOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={() => {
              setSelectedAvatarPreview(null);
              setIsAvatarSelectorOpen(false);
            }}
          />

          <div className="relative z-10 w-full max-w-2xl rounded-[28px] border border-brand-gray-200 bg-white p-5 shadow-[0_26px_60px_rgba(15,23,42,0.25)] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 sm:text-3xl">
                Choose your avatar
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSelectedAvatarPreview(null);
                  setIsAvatarSelectorOpen(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-gray-200 bg-white text-brand-gray-500 transition hover:text-brand-gray-700"
                aria-label="Close avatar selector"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="mt-3 text-sm text-brand-gray-500">
              Upload a photo or keep the default avatar for now.
            </p>

            <div className="mt-6">
              <p className="text-sm font-semibold text-brand-gray-700">Choose an avatar</p>
              <p className="mt-1 text-xs text-brand-gray-500">Tap the first circle to upload your own image.</p>

              <div className="mt-4 grid grid-cols-6 gap-4">
                {/* Upload button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarSelectorOpen(false);
                    uploadAvatarInputRef.current?.click();
                  }}
                  className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-brand-gray-300 bg-brand-gray-50 transition hover:border-brand-teal hover:bg-brand-teal/10"
                  title="Upload custom avatar"
                >
                  <Image
                    src="/avatar/Upload.png"
                    alt="Upload avatar"
                    width={64}
                    height={64}
                    className="h-full w-full rounded-full object-cover"
                  />
                </button>

                {/* Preset avatars */}
                {PRESET_AVATARS.map((avatarName) => (
                  <button
                    key={avatarName}
                    type="button"
                    onClick={() => {
                      setSelectedAvatarPreview(`/avatar/${avatarName}.png`);
                    }}
                    className={`flex h-16 w-16 items-center justify-center rounded-full border-2 bg-white transition ${
                      selectedAvatarPreview === `/avatar/${avatarName}.png`
                        ? "border-brand-teal"
                        : "border-brand-gray-200 hover:border-brand-teal"
                    }`}
                    title={`Select ${avatarName} avatar`}
                  >
                    <Image
                      src={`/avatar/${avatarName}.png`}
                      alt={`${avatarName} avatar`}
                      width={64}
                      height={64}
                      className="h-full w-full rounded-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedAvatarPreview(null);
                  setIsAvatarSelectorOpen(false);
                }}
                className="rounded-xl border border-brand-gray-300 px-6 py-2.5 text-sm font-semibold text-brand-gray-600 transition hover:bg-brand-gray-100"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleConfirmPresetAvatar();
                }}
                disabled={isApplyingPresetAvatar}
                className="rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {isApplyingPresetAvatar ? "Saving..." : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCropModalOpen && cropSourceUrl ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={closeCropModal}
          />

          <div className="relative z-10 w-full max-w-2xl rounded-[28px] border border-brand-gray-200 bg-white p-5 shadow-[0_26px_60px_rgba(15,23,42,0.25)] sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 sm:text-3xl">
                Crop your new avatar
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
              Drag the image and adjust zoom to set your visible avatar area.
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
              <span className="text-sm font-semibold text-brand-gray-600">Zoom</span>
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
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmAvatarCrop()}
                disabled={isCropping || !cropPixels}
                className="rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isCropping ? "Uploading..." : "Set new avatar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfileOverlayShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[120]">
      <motion.div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[6px]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      />
      <div className="relative z-10 flex min-h-full items-center justify-center p-4" onClick={onClose}>
        <motion.div
          className="w-full max-w-3xl rounded-[30px] border border-white/70 bg-white/90 shadow-[0_30px_80px_rgba(15,23,42,0.28)] backdrop-blur-xl"
          initial={{ scale: 0.9, opacity: 0, y: 28 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 16 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-brand-gray-100 px-5 py-4 md:px-6">
            <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-gray-200 bg-white text-brand-gray-500 transition hover:text-brand-gray-700"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="max-h-[78vh] overflow-y-auto px-5 py-5 md:px-6 md:py-6">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}

function PersonalProfileContent({
  form,
  setForm,
  saving,
  error,
  handleSaveProfile,
  preferences,
  setPreferences,
  handleLogout,
  uploadAvatarInputRef,
  onAvatarFileChange,
  onAvatarButtonClick,
  avatarUploadError,
}: {
  form: ProfileFormState;
  setForm: Dispatch<SetStateAction<ProfileFormState>>;
  saving: boolean;
  error: string;
  handleSaveProfile: () => Promise<void>;
  preferences: PreferenceState;
  setPreferences: (patch: Partial<PreferenceState>) => void;
  handleLogout: () => void;
  uploadAvatarInputRef: React.RefObject<HTMLInputElement>;
  onAvatarFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAvatarButtonClick: () => void;
  avatarUploadError: string;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-brand-gray-500">
        Update your public profile details and learning preferences. Changes are applied immediately after saving.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <input
          ref={uploadAvatarInputRef}
          type="file"
          accept="image/*"
          onChange={onAvatarFileChange}
          className="hidden"
        />
        <label className="block">
          <span className="text-sm text-brand-gray-600">Display Name</span>
          <input
            type="text"
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
            className="mt-1.5 w-full rounded-2xl border border-brand-gray-200 bg-white/85 px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
          />
        </label>

        <label className="block">
          <span className="text-sm text-brand-gray-600">Job Title</span>
          <input
            type="text"
            value={form.job_title}
            onChange={(event) => setForm((prev) => ({ ...prev, job_title: event.target.value }))}
            className="mt-1.5 w-full rounded-2xl border border-brand-gray-200 bg-white/85 px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
          />
        </label>

        <label className="block">
          <span className="text-sm text-brand-gray-600">Education Level</span>
          <div className="mt-1.5">
            <ProfileDropdown
              value={form.education_level}
              placeholder="Select level"
              options={EDUCATION_LEVELS}
              onChange={(next) => setForm((prev) => ({ ...prev, education_level: next }))}
            />
          </div>
        </label>

        <label className="block">
          <span className="text-sm text-brand-gray-600">Preferred Language</span>
          <div className="mt-1.5">
            <ProfileDropdown
              value={form.preferred_language}
              placeholder="Select language"
              options={PREFERRED_LANGUAGES}
              onChange={(next) => setForm((prev) => ({ ...prev, preferred_language: next }))}
            />
          </div>
        </label>

        <label className="block">
          <span className="text-sm text-brand-gray-600">Daily Goal (min)</span>
          <div className="mt-1.5">
            <ProfileDropdown
              value={form.daily_learning_goal_minutes}
              placeholder="Select goal"
              options={DAILY_GOAL_OPTIONS}
              onChange={(next) => setForm((prev) => ({ ...prev, daily_learning_goal_minutes: next }))}
            />
          </div>
        </label>

        <label className="block">
          <span className="text-sm text-brand-gray-600">Avatar</span>
          <div className="mt-1.5">
            <button
              type="button"
              onClick={onAvatarButtonClick}
              className="flex w-full items-center justify-between gap-2 rounded-2xl border border-brand-gray-200 bg-white/85 px-4 py-3 text-sm text-brand-gray-700 outline-none transition hover:bg-white focus:border-brand-teal"
            >
              <span>Select Avatar</span>
            </button>
          </div>
        </label>
      </div>
      {avatarUploadError ? <p className="text-sm text-rose-500">{avatarUploadError}</p> : null}

      <div className="rounded-2xl border border-brand-gray-100 bg-brand-gray-50/75 p-4">
        <p className="text-sm font-semibold text-brand-gray-700">Learning preferences</p>

        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-brand-gray-600">Sound Effects</span>
            <ProfileToggle on={preferences.soundOn} onChange={() => setPreferences({ soundOn: !preferences.soundOn })} />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-brand-gray-600">Dark / Glass Theme</span>
            <ProfileToggle on={preferences.darkGlass} onChange={() => setPreferences({ darkGlass: !preferences.darkGlass })} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-brand-gray-600">Difficulty Scaling</span>
              <span className="text-xs font-semibold text-brand-gray-400">{preferences.difficulty}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={preferences.difficulty}
              onChange={(event) => setPreferences({ difficulty: Number(event.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-brand-gray-200 accent-brand-teal"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-xl border border-brand-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-gray-600 transition hover:border-brand-teal hover:text-brand-teal"
        >
          Log Out
        </button>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          {error ? <p className="text-sm text-rose-500">{error}</p> : null}
          <GameButton onClick={() => void handleSaveProfile()} disabled={saving} className="min-w-[170px]">
            {saving ? "Saving..." : "Save Profile"}
          </GameButton>
        </div>
      </div>
    </div>
  );
}

function WalletContent({
  ledgerLoading,
  ledgerItems,
  error,
}: {
  ledgerLoading: boolean;
  ledgerItems: UserLedgerEvent[];
  error: string;
}) {
  return (
    <div className="space-y-5">
      {error ? <p className="text-sm text-rose-500">{error}</p> : null}

      <div className="rounded-2xl border border-brand-gray-100 bg-brand-gray-50/75 p-4">
        <p className="text-sm font-semibold text-brand-gray-700">Recent account activity</p>
        <div className="mt-3 space-y-3">
          {ledgerLoading ? (
            <div className="rounded-2xl border border-brand-gray-100 bg-white px-4 py-4 text-sm text-brand-gray-500">
              Loading recent activity...
            </div>
          ) : ledgerItems.length === 0 ? (
            <div className="rounded-2xl border border-brand-gray-100 bg-white px-4 py-4 text-sm text-brand-gray-500">
              No credits or XP events yet.
            </div>
          ) : (
            ledgerItems.map((item) => <LedgerActivityRow key={item.id} item={item} />)
          )}
        </div>
      </div>
    </div>
  );
}

function LedgerActivityRow({ item }: { item: UserLedgerEvent }) {
  const eventLabel = getLedgerEventLabel(item.event_type);
  const creditsText = item.credits_delta === 0 ? null : `${item.credits_delta > 0 ? "+" : ""}${item.credits_delta.toLocaleString()} credits`;
  const xpText = item.xp_delta === 0 ? null : `+${item.xp_delta.toLocaleString()} XP`;
  const timestamp = new Date(item.created_at).toLocaleString();

  return (
    <div className="rounded-2xl border border-brand-gray-100 bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-gray-700">{eventLabel}</p>
          <p className="mt-1 text-xs text-brand-gray-400">{timestamp}</p>
        </div>
        <div className="text-right">
          {creditsText && (
            <p className={`text-sm font-semibold ${item.credits_delta > 0 ? "text-brand-green" : "text-rose-500"}`}>
              {creditsText}
            </p>
          )}
          {xpText ? <p className="text-sm font-semibold text-brand-teal">{xpText}</p> : null}
        </div>
      </div>
      <p className="mt-2 text-xs text-brand-gray-500">
        Balance: {item.credits_balance_after.toLocaleString()} credits, level {item.level_after}, {item.xp_balance_after.toLocaleString()} XP
      </p>
    </div>
  );
}

function resolveSeasonBadgeVisual(badge: string): { src: string; alt: string } {
  switch (badge.trim().toLowerCase()) {
    case "crown":
      return { src: "/svg/season-badge-crown.svg", alt: "Crown badge" };
    case "podium":
      return { src: "/svg/season-badge-podium.svg", alt: "Podium badge" };
    case "elite":
      return { src: "/svg/season-badge-elite.svg", alt: "Elite badge" };
    case "star":
      return { src: "/svg/season-badge-star.svg", alt: "Star badge" };
    case "":
    case "none":
    case "unranked":
      return { src: "/svg/season-badge-none.svg", alt: "Unranked badge" };
    default:
      return { src: "/svg/season-badge-none.svg", alt: `${badge} badge` };
  }
}

function resolveRankTierTagline(rankTier?: string | null): string {
  switch ((rankTier ?? "").trim().toLowerCase()) {
    case "bronze":
      return "Foundation";
    case "silver":
      return "Steady";
    case "gold":
      return "Focused";
    case "platinum":
      return "Tempo";
    case "diamond":
      return "Precision";
    case "master":
      return "Command";
    case "grandmaster":
      return "Apex";
    default:
      return "Climb";
  }
}

function ArenaMetricPill({
  label,
  value,
  iconSrc,
  iconAlt,
  compactText,
}: {
  label: string;
  value: string;
  iconSrc?: string;
  iconAlt?: string;
  compactText?: boolean;
}) {
  return (
    <div className="flex h-full min-h-[98px] w-full min-w-0 flex-col rounded-2xl border border-[#365580] bg-gradient-to-b from-[#2d4f7b] to-[#1f385b] px-3 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
      <p className="w-full text-center text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">{label}</p>
      {iconSrc ? (
        <div className="mt-2 flex flex-1 items-center justify-center">
          <Image
            src={iconSrc}
            alt={iconAlt ?? `${label} badge`}
            width={56}
            height={56}
            className="h-11 w-11 object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.25)] sm:h-12 sm:w-12"
          />
        </div>
      ) : compactText ? (
        <div className="mt-2 flex flex-1 items-center justify-center">
          <p className="w-full text-center font-heading text-[0.8rem] font-extrabold leading-snug text-white/95 sm:text-[0.9rem]">{value}</p>
        </div>
      ) : (
        <p className="mt-2 w-full whitespace-nowrap text-center font-heading text-[1.15rem] font-extrabold leading-none sm:text-[1.35rem]">{value}</p>
      )}
    </div>
  );
}

function resolveRecentOutcomeTrends(history: ArenaRankHistoryEntry[]): { win: number[]; loss: number[]; draw: number[] } {
  const recentDesc = [...history]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 5);
  const chronological = recentDesc.sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const paddedChronological: Array<ArenaRankHistoryEntry | null> = [
    ...Array.from({ length: Math.max(0, 5 - chronological.length) }, () => null),
    ...chronological,
  ];

  let wins = 0;
  let losses = 0;
  let draws = 0;

  const winTrend: number[] = [];
  const lossTrend: number[] = [];
  const drawTrend: number[] = [];

  for (const entry of paddedChronological) {
    if (entry) {
      if (entry.ratingDelta > 0) {
        wins += 1;
      } else if (entry.ratingDelta < 0) {
        losses += 1;
      } else {
        draws += 1;
      }
    }
    winTrend.push(wins);
    lossTrend.push(losses);
    drawTrend.push(draws);
  }

  return {
    win: winTrend,
    loss: lossTrend,
    draw: drawTrend,
  };
}

function ProfileDropdown({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: Array<string | { value: string; label: string }>;
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );
  const activeLabel =
    normalizedOptions.find((option) => option.value === value)?.label ||
    value.trim() ||
    placeholder ||
    "Select";

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointer = (event: MouseEvent) => {
      if (!rootRef.current || rootRef.current.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border border-brand-gray-200 bg-white/85 px-4 py-3 text-sm text-brand-gray-700 outline-none transition hover:bg-white focus:border-brand-teal ${open ? "ring-2 ring-brand-teal/30" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value.trim() ? "" : "text-brand-gray-400"}>{activeLabel}</span>
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-brand-gray-400 transition ${open ? "rotate-180" : ""}`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.25 7.5 10 12.25 14.75 7.5" />
        </svg>
      </button>
      {open ? (
        <div
          className="scrollbar-hide absolute left-0 right-0 z-20 mt-2 max-h-56 overflow-auto rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
          role="listbox"
        >
          {normalizedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition ${
                option.value === value
                  ? "bg-brand-teal/10 text-brand-gray-800"
                  : "text-brand-gray-600 hover:bg-brand-gray-100/70"
              }`}
              role="option"
              aria-selected={option.value === value}
            >
              <span>{option.label}</span>
              {option.value === value ? <span className="text-xs text-brand-teal">●</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ArenaSummaryMetric({
  label,
  value,
  tone,
  trendValues,
}: {
  label: string;
  value: string;
  tone: "win" | "loss" | "draw";
  trendValues: number[];
}) {
  return (
    <div className="flex h-full min-h-[122px] w-full min-w-0 flex-col rounded-2xl border border-[#365580] bg-gradient-to-b from-[#2d4f7b] to-[#1f385b] px-3 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">{label}</p>
      <p className="mt-2 truncate font-heading text-3xl font-extrabold leading-none">{value}</p>
    </div>
  );
}

function getLedgerEventLabel(eventType: string) {
  switch (eventType) {
    case "credits_top_up":
      return "Credits Added";
    case "credits_spend":
      return "Credits Spent";
    case "lesson_completion_reward":
      return "Lesson Reward";
    default:
      return eventType;
  }
}
