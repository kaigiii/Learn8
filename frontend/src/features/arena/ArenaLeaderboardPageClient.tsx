"use client";

import React, { useEffect, useMemo, useState } from "react";
import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import {
  fetchArenaLeaderboard,
  fetchArenaProfile,
  fetchArenaSeason,
  fetchArenaSeasonLeaderboard,
} from "@/lib/arena/api";
import type { ArenaLeaderboardEntry, ArenaProfile, ArenaSeasonSummary } from "@/lib/apiTypes";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";

type LeaderboardTab = "global" | "season";
type LeaderboardCategory = "rating" | "win_rate" | "matches";

type RankedLeaderboardEntry = ArenaLeaderboardEntry & {
  totalMatches: number;
  winRate: number;
};

export default function ArenaLeaderboardPageClient() {
  const { isReady } = useRequireAuthRedirect();
  const [tab, setTab] = useState<LeaderboardTab>("season");
  const [category, setCategory] = useState<LeaderboardCategory>("rating");
  const [profile, setProfile] = useState<ArenaProfile | null>(null);
  const [season, setSeason] = useState<ArenaSeasonSummary | null>(null);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<ArenaLeaderboardEntry[]>([]);
  const [seasonLeaderboard, setSeasonLeaderboard] = useState<ArenaLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const [nextProfile, nextSeason, nextGlobal] = await Promise.all([
          fetchArenaProfile(),
          fetchArenaSeason(),
          fetchArenaLeaderboard(100),
        ]);
        const nextSeasonBoard = await fetchArenaSeasonLeaderboard(100, nextSeason?.id ?? null);

        if (cancelled) {
          return;
        }

        setProfile(nextProfile);
        setSeason(nextSeason);
        setGlobalLeaderboard(nextGlobal.items);
        setSeasonLeaderboard(nextSeasonBoard.items);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Arena leaderboard.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady]);

  const activeBoard = tab === "season" ? seasonLeaderboard : globalLeaderboard;
  const activeLabel = tab === "season" ? season?.name ?? "Current Season" : "Global Ladder";

  const sortedBoard = useMemo<RankedLeaderboardEntry[]>(() => {
    const entries = activeBoard.map((entry) => {
      const totalMatches = Math.max(entry.rankedMatches, entry.wins + entry.losses);
      const winRate = totalMatches > 0 ? (entry.wins / totalMatches) * 100 : 0;
      return {
        ...entry,
        totalMatches,
        winRate,
      };
    });

    const sorted = [...entries];
    if (category === "win_rate") {
      sorted.sort(
        (left, right) =>
          right.winRate - left.winRate ||
          right.rating - left.rating ||
          right.totalMatches - left.totalMatches ||
          left.displayName.localeCompare(right.displayName)
      );
      return sorted;
    }

    if (category === "matches") {
      sorted.sort(
        (left, right) =>
          right.totalMatches - left.totalMatches ||
          right.rating - left.rating ||
          right.winRate - left.winRate ||
          left.displayName.localeCompare(right.displayName)
      );
      return sorted;
    }

    sorted.sort(
      (left, right) =>
        right.rating - left.rating ||
        right.winRate - left.winRate ||
        right.totalMatches - left.totalMatches ||
        left.displayName.localeCompare(right.displayName)
    );
    return sorted;
  }, [activeBoard, category]);

  const currentUserStanding = useMemo(() => {
    if (!profile) {
      return null;
    }
    const index = sortedBoard.findIndex((entry) => entry.userId === profile.userId);
    if (index === -1) {
      return null;
    }
    return {
      placement: index + 1,
      entry: sortedBoard[index],
    };
  }, [profile, sortedBoard]);

  const currentMetricValue = useMemo(() => {
    if (!currentUserStanding) {
      return "...";
    }
    if (category === "win_rate") {
      return `${currentUserStanding.entry.winRate.toFixed(1)}%`;
    }
    if (category === "matches") {
      return String(currentUserStanding.entry.totalMatches);
    }
    return String(currentUserStanding.entry.rating);
  }, [category, currentUserStanding]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]">
      <TopStatsBar
        backHref="/home"
        pageTitle="Arena Leaderboard"
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
            active: true,
            iconSrc: "/leaderboard-logo.svg",
            iconAlt: "Leaderboard",
          },
        ]}
      />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <DeepGlassCard className="px-6 py-6 md:px-8 md:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-teal">
                Competitive Rankings
              </p>
              <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-gray-700 md:text-5xl">
                Arena leaderboard
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-brand-gray-500 md:text-base">
                Explore the live competitive ladder with multiple ranking views, from pure rating to
                win-rate leaders and high-volume grinders.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <TabButton
                active={tab === "season"}
                label={season?.name ?? "Season"}
                onClick={() => setTab("season")}
              />
              <TabButton
                active={tab === "global"}
                label="Global"
                onClick={() => setTab("global")}
              />
            </div>
          </div>
        </DeepGlassCard>

        {error ? (
          <DeepGlassCard className="px-6 py-5 text-sm text-rose-700">{error}</DeepGlassCard>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <DeepGlassCard className="px-6 py-6">
            <h2 className="font-heading text-2xl font-bold text-brand-gray-700">Your Ladder Snapshot</h2>
            <div className="mt-5 space-y-4">
              <MetricCard label="Display Name" value={profile?.displayName ?? "..."} />
              <MetricCard label="Current Rating" value={profile ? String(profile.rating) : "..."} />
              <MetricCard label="Rank Tier" value={profile?.rankTier ?? "..."} />
              <MetricCard label="Season Badge" value={profile?.seasonBadge ?? "..."} />
              <MetricCard label="Season Title" value={profile?.seasonTitle ?? "..."} />
              <MetricCard
                label={
                  category === "win_rate"
                    ? "Current Win Rate"
                    : category === "matches"
                      ? "Competition Matches"
                      : "Rank Rating"
                }
                value={currentMetricValue}
              />
              <MetricCard
                label={`${activeLabel} Placement`}
                value={currentUserStanding ? `#${currentUserStanding.placement}` : "Unranked"}
              />
            </div>

            <div className="mt-6 rounded-[26px] border border-white/70 bg-white/68 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">
                Season Status
              </p>
              <p className="mt-3 font-heading text-2xl font-bold text-brand-gray-700">
                {season?.name ?? "No active season"}
              </p>
              <p className="mt-2 text-sm text-brand-gray-500">
                {season?.startedAt
                  ? `Started ${new Date(season.startedAt).toLocaleDateString()}`
                  : "Season timing will appear here once configured."}
              </p>
            </div>
          </DeepGlassCard>

          <DeepGlassCard className="px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl font-bold text-brand-gray-700">{activeLabel}</h2>
                <p className="mt-2 text-sm text-brand-gray-500">
                  Independent leaderboard categories for rank rating, win rate, and total competition
                  matches.
                </p>
              </div>
              <span className="rounded-full bg-white/75 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-teal">
                {sortedBoard.length} ranked
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <CategoryButton
                active={category === "rating"}
                label="Rank"
                onClick={() => setCategory("rating")}
              />
              <CategoryButton
                active={category === "win_rate"}
                label="Win Rate"
                onClick={() => setCategory("win_rate")}
              />
              <CategoryButton
                active={category === "matches"}
                label="Matches"
                onClick={() => setCategory("matches")}
              />
            </div>

            <div className="mt-5 space-y-3">
              {sortedBoard.map((entry, index) => {
                const isCurrentUser = entry.userId === profile?.userId;
                return (
                  <div
                    key={entry.userId}
                    className={`rounded-[26px] border px-5 py-4 ${
                      isCurrentUser
                        ? "border-brand-teal/45 bg-brand-teal/10 shadow-[0_16px_30px_rgba(95,179,175,0.16)]"
                        : "border-white/70 bg-white/68"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-heading text-xl font-bold text-brand-gray-700">
                          #{index + 1} {entry.displayName}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-brand-teal">
                          {entry.rankTier}
                          {isCurrentUser ? " • You" : ""}
                        </p>
                        {entry.seasonTitle ? (
                          <p className="mt-1 text-xs text-brand-gray-500">
                            {entry.seasonBadge ? `${entry.seasonBadge} • ` : ""}
                            {entry.seasonTitle}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="font-heading text-2xl font-bold text-brand-gray-700">
                          {category === "win_rate"
                            ? `${entry.winRate.toFixed(1)}%`
                            : category === "matches"
                              ? entry.totalMatches
                              : entry.rating}
                        </p>
                        <p className="text-xs text-brand-gray-500">
                          {entry.wins}W / {entry.losses}L / {entry.totalMatches} matches
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {sortedBoard.length === 0 && !loading ? (
                <div className="rounded-2xl border border-dashed border-brand-gray-300 bg-white/60 px-4 py-5 text-sm text-brand-gray-500">
                  No leaderboard entries yet. The ladder will appear after Arena competition results
                  are recorded.
                </div>
              ) : null}
            </div>
          </DeepGlassCard>
        </div>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">{label}</p>
      <p className="mt-2 font-heading text-2xl font-bold text-brand-gray-700">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
        active
          ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
          : "border-white/70 bg-white/65 text-brand-gray-700 hover:bg-white/80"
      }`}
    >
      {label}
    </button>
  );
}

function CategoryButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] transition ${
        active
          ? "bg-brand-teal/12 text-brand-teal ring-1 ring-brand-teal/20"
          : "bg-white/60 text-brand-gray-600 hover:bg-white/85"
      }`}
    >
      {label}
    </button>
  );
}
