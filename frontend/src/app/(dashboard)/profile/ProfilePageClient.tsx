"use client";

import { useEffect, useMemo, useState } from "react";

import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import { fetchArenaProfile, fetchArenaRankHistory } from "@/lib/arena/api";
import { resolveErrorMessage } from "@/lib/apiClient";
import type { ArenaProfile, ArenaRankHistoryEntry, UserLedgerEvent } from "@/lib/apiTypes";
import { ProfileStatBox } from "@/features/profile/components/ProfileStatBox";
import { ProfileToggle } from "@/features/profile/components/ProfileToggle";
import { useProfileSettings } from "@/features/profile/hooks/useProfileSettings";
import useUserStore, { selectUserProgression } from "@/stores/app/useUserStore";

export default function ProfilePageClient() {
  const {
    authUser,
    title,
    preferences,
    form,
    setForm,
    saving,
    toppingUpAmount,
    ledgerLoading,
    ledgerItems,
    error,
    setPreferences,
    handleSaveProfile,
    handleQuickTopUp,
    handleOpenStore,
    handleLogout,
  } = useProfileSettings(() => {});
  const progression = useUserStore(selectUserProgression);
  const [arenaProfile, setArenaProfile] = useState<ArenaProfile | null>(null);
  const [arenaHistory, setArenaHistory] = useState<ArenaRankHistoryEntry[]>([]);
  const [arenaLoading, setArenaLoading] = useState(true);
  const [arenaError, setArenaError] = useState<string | null>(null);

  const displayName = authUser?.full_name?.trim() || form.full_name || "Learner";
  const profileLabel =
    authUser?.job_title?.trim() ||
    authUser?.education_level?.trim() ||
    title ||
    "Learner";
  const initial = displayName.slice(0, 1).toUpperCase() || "P";
  const arenaTopTopics = useMemo(
    () => [...(arenaProfile?.topicRatings ?? [])].sort((left, right) => right.rating - left.rating).slice(0, 4),
    [arenaProfile?.topicRatings]
  );
  const arenaRecentMomentum = useMemo(
    () => arenaHistory.slice(0, 5).reduce((sum, entry) => sum + entry.ratingDelta, 0),
    [arenaHistory]
  );

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
      } catch (error) {
        if (!cancelled) {
          setArenaError(resolveErrorMessage(error, "Unable to load Arena competitive profile right now."));
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

  return (
    <div className="relative min-h-screen overflow-hidden app-shared-bg">
      <TopStatsBar
        backHref="/home"
        pageTitle="Profile"
        quickLinks={[
          {
            href: "/multiplayer",
            label: "Multiplayer",
            iconSrc: "/multiplayer-controller.svg",
            iconAlt: "Multiplayer",
          },
          {
            href: "/arena/leaderboard",
            label: "Leaderboard",
            iconSrc: "/leaderboard-logo.svg",
            iconAlt: "Leaderboard",
          },
        ]}
      />

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
        <DeepGlassCard className="overflow-hidden border border-white/70 bg-white/78 px-6 py-6 shadow-[0_24px_60px_rgba(31,41,55,0.12)]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ffd23c] to-[#f4b800] shadow-[0_18px_36px_rgba(244,184,0,0.35)]">
                <span className="font-heading text-2xl font-extrabold text-white">
                  {initial}
                </span>
              </div>
              <div>
                <p className="font-heading text-3xl font-extrabold text-brand-gray-700">
                  {displayName}
                </p>
                <p className="mt-1 text-sm text-brand-gray-500">{profileLabel}</p>
                {authUser?.email && (
                  <p className="mt-1 text-xs text-brand-gray-400">
                    {authUser.email}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <ProfileStatBox
                label="Credits"
                value={String(authUser?.credits ?? 0)}
              />
              <ProfileStatBox
                label="Level"
                value={String(progression.level)}
              />
              <ProfileStatBox
                label="XP"
                value={String(progression.xp)}
              />
              <ProfileStatBox
                label="Daily Goal"
                value={
                  authUser?.daily_learning_goal_minutes
                    ? `${authUser.daily_learning_goal_minutes} min`
                    : "Not set"
                }
              />
            </div>
          </div>
        </DeepGlassCard>

        <DeepGlassCard className="border border-white/70 bg-white/82 px-6 py-6 shadow-[0_24px_60px_rgba(31,41,55,0.12)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal">
                Arena
              </p>
              <h2 className="mt-2 font-heading text-2xl font-extrabold text-brand-gray-700">
                Competitive Identity
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-gray-500">
                Your real-time competition snapshot lives here, including rating, ladder momentum,
                strongest topics, and recent ranked movement.
              </p>
            </div>

            <div className="rounded-3xl border border-[#f5d77a]/55 bg-gradient-to-br from-[#fff7d8] via-white to-[#f6fbfc] px-5 py-4 shadow-[0_18px_36px_rgba(244,184,0,0.14)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-gray-400">
                Active Season
              </p>
              <p className="mt-2 font-heading text-2xl font-extrabold text-brand-gray-700">
                {arenaProfile?.activeSeason ?? "No active season"}
              </p>
              <p className="mt-1 text-xs text-brand-gray-500">
                {arenaLoading
                  ? "Loading Arena season status..."
                  : arenaProfile
                    ? `${arenaProfile.rankTier} ladder currently active`
                    : "Season data will appear after your first Arena sync."}
              </p>
            </div>
          </div>

          {arenaError ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-600">
              {arenaError}
            </div>
          ) : null}

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <ProfileStatBox
                  label="Arena Rating"
                  value={arenaLoading ? "..." : String(arenaProfile?.rating ?? 0)}
                />
                <ProfileStatBox
                  label="Rank Tier"
                  value={arenaLoading ? "..." : arenaProfile?.rankTier ?? "Unranked"}
                />
                <ProfileStatBox
                  label="Best Tier"
                  value={arenaLoading ? "..." : arenaProfile?.bestRankTier ?? "Unranked"}
                />
                <ProfileStatBox
                  label="Win Rate"
                  value={arenaLoading ? "..." : `${(arenaProfile?.winRate ?? 0).toFixed(1)}%`}
                />
                <ProfileStatBox
                  label="Ranked Matches"
                  value={arenaLoading ? "..." : String(arenaProfile?.rankedMatches ?? 0)}
                />
                <ProfileStatBox
                  label="Recent Momentum"
                  value={
                    arenaLoading
                      ? "..."
                      : `${arenaRecentMomentum > 0 ? "+" : ""}${arenaRecentMomentum}`
                  }
                />
              </div>

              <div className="rounded-[28px] border border-white/70 bg-white/68 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
                      Season Honors
                    </p>
                    <h3 className="mt-2 font-heading text-xl font-bold text-brand-gray-700">
                      Current season identity
                    </h3>
                  </div>
                  <span className="rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">
                    {arenaLoading
                      ? "..."
                      : arenaProfile?.seasonPlacement
                        ? `#${arenaProfile.seasonPlacement}`
                        : "Unranked"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <ArenaMetricPill
                    label="Season Badge"
                    value={arenaLoading ? "..." : arenaProfile?.seasonBadge ?? "None"}
                  />
                  <ArenaMetricPill
                    label="Season Title"
                    value={arenaLoading ? "..." : arenaProfile?.seasonTitle ?? "Contender"}
                  />
                  <ArenaMetricPill
                    label="Percentile"
                    value={
                      arenaLoading
                        ? "..."
                        : arenaProfile?.seasonPercentile != null
                          ? `${arenaProfile.seasonPercentile.toFixed(1)}%`
                          : "-"
                    }
                  />
                </div>
              </div>

              <div className="rounded-[28px] border border-white/70 bg-white/68 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
                      Match Summary
                    </p>
                    <h3 className="mt-2 font-heading text-xl font-bold text-brand-gray-700">
                      Competitive record
                    </h3>
                  </div>
                  <span className="rounded-full bg-brand-teal/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-teal">
                    {arenaLoading ? "..." : `${arenaProfile?.rankedMatches ?? 0} matches`}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <ArenaMetricPill
                    label="Wins"
                    value={arenaLoading ? "..." : String(arenaProfile?.wins ?? 0)}
                  />
                  <ArenaMetricPill
                    label="Losses"
                    value={arenaLoading ? "..." : String(arenaProfile?.losses ?? 0)}
                  />
                  <ArenaMetricPill
                    label="Draws"
                    value={arenaLoading ? "..." : String(arenaProfile?.draws ?? 0)}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] xl:grid-cols-1">
              <div className="rounded-[28px] border border-white/70 bg-white/68 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
                  Strongest Topics
                </p>
                <h3 className="mt-2 font-heading text-xl font-bold text-brand-gray-700">
                  Topic strengths
                </h3>
                <div className="mt-4 space-y-3">
                  {arenaLoading ? (
                    <p className="text-sm text-brand-gray-500">Loading Arena topic ratings...</p>
                  ) : arenaTopTopics.length === 0 ? (
                    <p className="text-sm text-brand-gray-500">
                      Topic ratings will appear after a few Arena matches.
                    </p>
                  ) : (
                    arenaTopTopics.map((topic) => (
                      <div
                        key={topic.publicCourseId}
                        className="rounded-2xl border border-white/70 bg-white/76 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-brand-gray-700">
                              {topic.title}
                            </p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-brand-teal">
                              {topic.rankTier}
                            </p>
                          </div>
                          <p className="font-heading text-xl font-bold text-brand-gray-700">
                            {topic.rating}
                          </p>
                        </div>
                        <p className="mt-2 text-xs text-brand-gray-500">{topic.topic}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/70 bg-white/68 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
                  Rank History
                </p>
                <h3 className="mt-2 font-heading text-xl font-bold text-brand-gray-700">
                  Recent ladder movement
                </h3>
                <div className="mt-4 space-y-3">
                  {arenaLoading ? (
                    <p className="text-sm text-brand-gray-500">Loading rating history...</p>
                  ) : arenaHistory.length === 0 ? (
                    <p className="text-sm text-brand-gray-500">
                      Your ladder history will appear after ranked matches are recorded.
                    </p>
                  ) : (
                    arenaHistory.map((entry, index) => (
                      <ArenaHistoryRow
                        key={`${entry.matchId ?? "entry"}-${entry.createdAt}-${index}`}
                        entry={entry}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </DeepGlassCard>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <DeepGlassCard className="border border-white/70 bg-white/80 px-6 py-6 shadow-[0_20px_50px_rgba(31,41,55,0.10)]">
            <div className="mb-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal">
                Account
              </p>
              <h2 className="mt-2 font-heading text-2xl font-extrabold text-brand-gray-700">
                Personal Details
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-brand-gray-500">
                Update the identity shown across your courses, map, and learning
                sessions.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-brand-gray-600">Display Name</span>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-2xl border border-brand-gray-200 bg-white/75 px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
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
                  className="mt-1.5 w-full rounded-2xl border border-brand-gray-200 bg-white/75 px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
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
                  className="mt-1.5 w-full rounded-2xl border border-brand-gray-200 bg-white/75 px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
                />
              </label>

              <label className="block">
                <span className="text-sm text-brand-gray-600">Preferred Language</span>
                <input
                  type="text"
                  value={form.preferred_language}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      preferred_language: e.target.value,
                    }))
                  }
                  placeholder="English, 繁體中文, 日本語..."
                  className="mt-1.5 w-full rounded-2xl border border-brand-gray-200 bg-white/75 px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
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
                  className="mt-1.5 w-full rounded-2xl border border-brand-gray-200 bg-white/75 px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <GameButton
                onClick={() => void handleSaveProfile()}
                disabled={saving}
                className="min-w-[170px]"
              >
                {saving ? "Saving..." : "Save Profile"}
              </GameButton>
              {error && <p className="text-sm text-rose-500">{error}</p>}
            </div>
          </DeepGlassCard>

          <div className="space-y-6">
            <DeepGlassCard className="border border-white/70 bg-white/80 px-6 py-6 shadow-[0_20px_50px_rgba(31,41,55,0.10)]">
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal">
                  Credits
                </p>
                <h2 className="mt-2 font-heading text-2xl font-extrabold text-brand-gray-700">
                  Wallet
                </h2>
              </div>

              <div className="rounded-3xl border border-[#f5d77a]/55 bg-gradient-to-br from-[#fff7d8] via-white to-[#f6fbfc] px-5 py-5 shadow-[0_16px_40px_rgba(244,184,0,0.12)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-gray-400">
                      Available
                    </p>
                    <p className="mt-2 font-heading text-3xl font-extrabold text-brand-gray-700">
                      {(authUser?.credits ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={handleOpenStore}
                    className="rounded-2xl border border-brand-gray-200 bg-white px-3 py-2 text-xs font-semibold text-brand-gray-600 transition hover:border-brand-teal hover:text-brand-teal"
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
                      className="rounded-2xl bg-brand-teal/10 px-3 py-2 text-xs font-semibold text-brand-teal transition hover:bg-brand-teal hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {toppingUpAmount === amount
                        ? "Adding..."
                        : `+${amount.toLocaleString()}`}
                    </button>
                  ))}
                </div>
              </div>
            </DeepGlassCard>

            <DeepGlassCard className="border border-white/70 bg-white/80 px-6 py-6 shadow-[0_20px_50px_rgba(31,41,55,0.10)]">
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal">
                  Activity
                </p>
                <h2 className="mt-2 font-heading text-2xl font-extrabold text-brand-gray-700">
                  Recent Account Activity
                </h2>
              </div>

              <div className="space-y-3">
                {ledgerLoading ? (
                  <div className="rounded-2xl border border-brand-gray-100 bg-brand-gray-50 px-4 py-4 text-sm text-brand-gray-500">
                    Loading recent activity...
                  </div>
                ) : ledgerItems.length === 0 ? (
                  <div className="rounded-2xl border border-brand-gray-100 bg-brand-gray-50 px-4 py-4 text-sm text-brand-gray-500">
                    No credits or XP events yet.
                  </div>
                ) : (
                  ledgerItems.map((item) => (
                    <LedgerActivityRow key={item.id} item={item} />
                  ))
                )}
              </div>
            </DeepGlassCard>

            <DeepGlassCard className="border border-white/70 bg-white/80 px-6 py-6 shadow-[0_20px_50px_rgba(31,41,55,0.10)]">
              <div className="mb-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal">
                  Preferences
                </p>
                <h2 className="mt-2 font-heading text-2xl font-extrabold text-brand-gray-700">
                  Learning Setup
                </h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-gray-600">
                    Sound Effects
                  </span>
                  <ProfileToggle
                    on={preferences.soundOn}
                    onChange={() =>
                      setPreferences({ soundOn: !preferences.soundOn })
                    }
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-gray-600">
                    Dark / Glass Theme
                  </span>
                  <ProfileToggle
                    on={preferences.darkGlass}
                    onChange={() =>
                      setPreferences({ darkGlass: !preferences.darkGlass })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-brand-gray-600">
                      Difficulty Scaling
                    </span>
                    <span className="text-xs font-semibold text-brand-gray-400">
                      {preferences.difficulty}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={preferences.difficulty}
                    onChange={(e) =>
                      setPreferences({ difficulty: Number(e.target.value) })
                    }
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-brand-gray-200 accent-brand-teal"
                  />
                </div>
              </div>
            </DeepGlassCard>

            <DeepGlassCard className="border border-white/70 bg-white/80 px-6 py-6 shadow-[0_20px_50px_rgba(31,41,55,0.10)]">
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleOpenStore}
                  className="rounded-2xl border border-brand-gray-200 bg-white px-4 py-3 text-sm font-semibold text-brand-gray-600 transition hover:border-brand-teal hover:text-brand-teal"
                >
                  Open Full Store
                </button>
                <button
                  onClick={handleLogout}
                  className="rounded-2xl bg-brand-teal px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Log Out
                </button>
              </div>
            </DeepGlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerActivityRow({ item }: { item: UserLedgerEvent }) {
  const eventLabel = getLedgerEventLabel(item.event_type);
  const creditsText =
    item.credits_delta === 0
      ? null
      : `${item.credits_delta > 0 ? "+" : ""}${item.credits_delta.toLocaleString()} credits`;
  const xpText =
    item.xp_delta === 0
      ? null
      : `+${item.xp_delta.toLocaleString()} XP`;
  const timestamp = new Date(item.created_at).toLocaleString();

  return (
    <div className="rounded-2xl border border-brand-gray-100 bg-brand-gray-50/75 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-gray-700">{eventLabel}</p>
          <p className="mt-1 text-xs text-brand-gray-400">{timestamp}</p>
        </div>
        <div className="text-right">
          {creditsText && (
            <p
              className={`text-sm font-semibold ${
                item.credits_delta > 0 ? "text-brand-green" : "text-rose-500"
              }`}
            >
              {creditsText}
            </p>
          )}
          {xpText && <p className="text-sm font-semibold text-brand-teal">{xpText}</p>}
        </div>
      </div>
      <p className="mt-2 text-xs text-brand-gray-500">
        Balance: {item.credits_balance_after.toLocaleString()} credits, level{" "}
        {item.level_after}, {item.xp_balance_after.toLocaleString()} XP
      </p>
    </div>
  );
}

function ArenaMetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/78 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-gray-400">
        {label}
      </p>
      <p className="mt-2 font-heading text-2xl font-bold text-brand-gray-700">{value}</p>
    </div>
  );
}

function ArenaHistoryRow({ entry }: { entry: ArenaRankHistoryEntry }) {
  const timestamp = new Date(entry.createdAt).toLocaleString();
  const deltaText = `${entry.ratingDelta > 0 ? "+" : ""}${entry.ratingDelta}`;

  return (
    <div className="rounded-2xl border border-white/70 bg-white/76 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-gray-700">
            {entry.rankTierBefore} to {entry.rankTierAfter}
          </p>
          <p className="mt-1 text-xs text-brand-gray-400">{timestamp}</p>
        </div>
        <div className="text-right">
          <p
            className={`text-sm font-semibold ${
              entry.ratingDelta > 0
                ? "text-brand-green"
                : entry.ratingDelta < 0
                  ? "text-rose-500"
                  : "text-brand-gray-500"
            }`}
          >
            {deltaText}
          </p>
          <p className="mt-1 text-xs text-brand-gray-500">
            {entry.ratingBefore} to {entry.ratingAfter}
          </p>
        </div>
      </div>
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
