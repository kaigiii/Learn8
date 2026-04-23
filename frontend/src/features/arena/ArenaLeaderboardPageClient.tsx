"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import { useAuthStore } from "@/stores/app/useAuthStore";
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

const DEFAULT_AVATAR_SRC = "/avatar/chicken.png";

function resolveAvatarUrl(value?: string | null) {
  const avatar = value?.trim();
  return avatar ? avatar : DEFAULT_AVATAR_SRC;
}

export default function ArenaLeaderboardPageClient() {
  const { isReady } = useRequireAuthRedirect();
  const authUser = useAuthStore((state) => state.user);
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
  const currentUserAvatar = resolveAvatarUrl(authUser?.avatar_url);

  const snapshotMetricLabel =
    category === "win_rate"
      ? "Win Rate"
      : category === "matches"
        ? "Matches"
        : "Current Rating";
  const ratingProgress = Math.max(
    8,
    Math.min(100, ((profile?.rating ?? currentUserStanding?.entry.rating ?? 0) / 2000) * 100)
  );

  return (
    <div className="min-h-screen app-shared-bg">
      <TopStatsBar
        backHref="/home"
        pageTitle="Arena Leaderboard"
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
            active: true,
            iconSrc: "/svg/leaderboard-logo.svg",
            iconAlt: "Leaderboard",
          },
        ]}
      />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-extrabold text-brand-gray-700 md:text-4xl">
              Arena Leaderboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-brand-gray-500 md:text-[1.03rem]">
              Explore the live competitive ladder with multiple ranking viewer, from pure rating to
              leaders and high-volume grinders.
            </p>
          </div>

          <div className="flex gap-2">
            <LeaderboardDropdown
              value={tab}
              onChange={setTab}
              options={[
                { value: "season", label: "Season" },
                { value: "global", label: "Global" },
              ]}
            />
            <LeaderboardDropdown
              value={category}
              onChange={setCategory}
              options={[
                { value: "rating", label: "Rating" },
                { value: "win_rate", label: "Win Rate" },
                { value: "matches", label: "Matches" },
              ]}
            />
          </div>
        </div>

        {error ? (
          <DeepGlassCard className="px-6 py-5 text-sm text-rose-700">{error}</DeepGlassCard>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
          <DeepGlassCard className="min-w-0 px-4 py-4 md:px-5 md:py-5">
            <h2 className="font-heading text-[1.6rem] font-bold text-brand-gray-700">Your Ladder Snapshot</h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
                <div className="min-w-0 rounded-[22px] border border-white/70 bg-white/68 p-3">
                  <div className="flex items-center gap-3">
                    <AvatarPlaceholder
                      src={resolveAvatarUrl(
                        profile?.avatarUrl ??
                          profile?.avatar_url ??
                          (profile?.userId === authUser?.id ? authUser?.avatar_url : null)
                      )}
                      alt={`${profile?.displayName ?? "Player"} avatar`}
                    />
                    <div className="min-w-0">
                      <p className="font-heading break-words text-xl font-bold leading-tight text-brand-gray-700 xl:text-2xl">
                        {profile?.displayName ?? "Unknown"}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <TierShield />
                    </div>
                  </div>
                </div>

                <div className="min-w-0 rounded-[22px] border border-white/70 bg-white/68 p-3">
                  <p className="text-xs font-semibold text-brand-gray-500">{snapshotMetricLabel}</p>
                  <p className="mt-1 font-heading text-3xl font-bold leading-none text-brand-gray-700">
                    {currentMetricValue}
                  </p>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-brand-gray-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-teal/70 to-brand-teal/35"
                      style={{ width: `${ratingProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <SnapshotStatTile label="Rank Tier" value={profile?.rankTier ?? "-"} />
                <SnapshotStatTile
                  label="Matches"
                  value={String(profile?.rankedMatches ?? currentUserStanding?.entry.totalMatches ?? 0)}
                />
                <SnapshotStatTile
                  label="Wins | Losses"
                  value={`${profile?.wins ?? 0}W | ${profile?.losses ?? 0}L`}
                />
                <SnapshotStatTile
                  label="Placement"
                  value={currentUserStanding ? `#${currentUserStanding.placement}` : "#-"}
                />
              </div>

              <div className="mt-3 flex items-center justify-between rounded-[22px] border border-white/70 bg-white/68 px-4 py-3">
                <div>
                  <p className="text-xs text-brand-gray-500">Season Status</p>
                  <p className="mt-1 font-heading text-[1.4rem] font-bold leading-tight text-brand-gray-700 break-words">
                    {season?.name ?? "No active season."}
                  </p>
                </div>
                <div className="rounded-lg border border-white/70 bg-white/75 p-2 text-brand-gray-500">
                  <SeasonCalendar />
                </div>
              </div>
          </DeepGlassCard>

          <DeepGlassCard className="min-w-0 px-4 py-4 md:px-5 md:py-5">
            <h2 className="font-heading text-[1.75rem] font-bold text-brand-gray-700">
                {tab === "season" ? "Current Season" : "Global Ladder"}
              </h2>

              <div className="mt-3 flex flex-wrap gap-2">
                <CategoryChip
                  active={category === "rating"}
                  label="Rating"
                  onClick={() => setCategory("rating")}
                />
                <CategoryChip
                  active={category === "win_rate"}
                  label="Win Rate"
                  onClick={() => setCategory("win_rate")}
                />
                <CategoryChip
                  active={category === "matches"}
                  label="Matches"
                  onClick={() => setCategory("matches")}
                />
              </div>

              <div className="mt-4 grid grid-cols-[82px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(100px,0.85fr)] items-center gap-2 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-brand-gray-500">
                <span className="text-right">Rank</span>
                <span className="pl-3">Player</span>
                <span>Tier</span>
                <span className="text-center">Stats</span>
              </div>

              <div className="scrollbar-hide mt-2 max-h-[292px] space-y-2 overflow-y-auto pr-1">
                {sortedBoard.map((entry, index) => {
                  const isCurrentUser = entry.userId === profile?.userId;
                  return (
                    <div
                      key={entry.userId}
                      className={`grid grid-cols-[82px_minmax(0,1.6fr)_minmax(0,1fr)_minmax(100px,0.85fr)] items-center gap-2 rounded-[22px] border px-2 py-2 ${
                        isCurrentUser
                          ? "border-white/70 bg-[#e3e8ee]/95 shadow-[0_18px_34px_rgba(113,145,156,0.16)]"
                          : "border-white/70 bg-white/68"
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <RankBadge rank={index + 1} />
                      </div>

                      <div className="flex min-w-0 items-center gap-2 pl-3">
                        <AvatarPlaceholder
                          small
                          src={resolveAvatarUrl(
                            entry.avatarUrl ??
                              entry.avatar_url ??
                              (entry.userId === authUser?.id ? currentUserAvatar : null)
                          )}
                          alt={`${entry.displayName} avatar`}
                        />
                        <p className={`min-w-0 break-words text-lg font-bold leading-tight lg:text-xl ${isCurrentUser ? "text-brand-gray-900 font-extrabold" : "text-brand-gray-700"}`}>
                          {entry.displayName}
                        </p>
                        {isCurrentUser ? (
                          <span className="rounded-full bg-[#0e758b] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white">
                            You
                          </span>
                        ) : null}
                      </div>

                      <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-brand-gray-700 lg:text-base">
                        <TierShield small />
                        <span className="break-words">{entry.rankTier}</span>
                      </div>

                      <div className="text-center">
                        <p className={`text-2xl font-bold lg:text-[1.85rem] ${isCurrentUser ? "text-brand-gray-900" : "text-brand-gray-700"}`}>
                          {category === "win_rate"
                            ? `${entry.winRate.toFixed(0)}%`
                            : category === "matches"
                              ? entry.totalMatches
                              : entry.rating}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {sortedBoard.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-brand-gray-300 bg-white/60 px-4 py-4 text-base text-brand-gray-500">
                    {loading
                      ? "Loading leaderboard..."
                      : "No leaderboard entries yet. Match results will appear here."}
                  </div>
                ) : null}
              </div>
          </DeepGlassCard>
        </div>
      </main>
    </div>
  );
}

function LeaderboardDropdown<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = options.find((option) => option.value === value) ?? options[0];

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
        className={`flex min-w-[120px] items-center justify-between gap-2 rounded-2xl border border-white/70 bg-white/85 px-4 py-2.5 text-base font-semibold text-brand-gray-700 shadow-[0_12px_24px_rgba(113,145,156,0.14)] transition hover:bg-white ${open ? "ring-2 ring-brand-teal/30" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{active?.label}</span>
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
          className="absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
          role="listbox"
        >
          {options.map((option) => (
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
              {option.value === value ? (
                <span className="text-xs text-brand-teal">●</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SnapshotStatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/68 px-3 py-2.5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-gray-500">
        {icon} {label}
      </p>
      <p className="mt-1 font-heading text-[1.25rem] font-bold leading-tight text-brand-gray-700 xl:text-[1.4rem] break-words">
        {value}
      </p>
    </div>
  );
}

function CategoryChip({
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
      className={`rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-[0.08em] transition ${
        active
          ? "border-[#d1d5db] bg-[#e5e7eb] text-brand-gray-700 shadow-[0_8px_16px_rgba(107,114,128,0.08)]"
          : "border-[#d1d5db] bg-[#f3f4f6] text-brand-gray-600 hover:bg-[#e5e7eb]"
      }`}
    >
      {label}
    </button>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1 || rank === 2 || rank === 3) {
    return <MedalBadge place={rank} />;
  }

  return (
    <span className="inline-flex items-center justify-center text-4xl font-extrabold text-brand-gray-600">
      {rank}
    </span>
  );
}

function MedalBadge({ place }: { place: 1 | 2 | 3 }) {
  const medalPalette =
    place === 1
      ? {
          outer: "#FFD94D",
          outerStroke: "#F0B400",
          inner: "#FFC62A",
          innerStroke: "#F2A800",
          number: "#F6A90A",
        }
      : place === 2
        ? {
            outer: "#D9E3EC",
            outerStroke: "#A5B3C2",
            inner: "#C7D2DE",
            innerStroke: "#93A3B4",
            number: "#7E8FA1",
          }
        : {
            outer: "#E2B38D",
            outerStroke: "#BD845B",
            inner: "#D79A6D",
            innerStroke: "#AF6C44",
            number: "#A45D33",
          };

  return (
    <svg viewBox="0 0 64 74" className="h-12 w-12" aria-label={`rank-${place}-medal`}>
      <path d="M13 4h14l8 19H22L13 4z" fill="#F45E79" />
      <path d="M37 4h14l-9 19H29L37 4z" fill="#DE1D1D" />
      <path d="M27 4h10l4 19H23l4-19z" fill="#E6F2FF" />
      <rect x="23" y="20" width="18" height="8" rx="3" fill="#FFCC2E" />

      <circle
        cx="32"
        cy="48"
        r="21"
        fill={medalPalette.outer}
        stroke={medalPalette.outerStroke}
        strokeWidth="2"
      />
      <circle
        cx="32"
        cy="48"
        r="14"
        fill={medalPalette.inner}
        stroke={medalPalette.innerStroke}
        strokeWidth="2"
      />
      <circle cx="24" cy="48" r="1.9" fill="#FFE17B" opacity="0.95" />
      <circle cx="40" cy="48" r="1.9" fill="#FFE17B" opacity="0.95" />
      <text
        x="32"
        y="53"
        textAnchor="middle"
        fontSize="20"
        fontWeight="800"
        fill={medalPalette.number}
      >
        {place}
      </text>
    </svg>
  );
}

function AvatarPlaceholder({
  small = false,
  src = DEFAULT_AVATAR_SRC,
  alt = "Player avatar",
}: {
  small?: boolean;
  src?: string;
  alt?: string;
}) {
  const [imageSrc, setImageSrc] = useState(resolveAvatarUrl(src));

  useEffect(() => {
    setImageSrc(resolveAvatarUrl(src));
  }, [src]);

  return (
    <div
      className={`relative overflow-hidden rounded-full border border-brand-gray-200 bg-white ${
        small ? "h-12 w-12" : "h-20 w-20"
      }`}
    >
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes={small ? "48px" : "80px"}
        className="object-cover"
        onError={() => setImageSrc(DEFAULT_AVATAR_SRC)}
      />
    </div>
  );
}

function TierShield({ small = false }: { small?: boolean }) {
  const sizeClass = small ? "h-8 w-8" : "h-14 w-14";
  return (
    <svg viewBox="0 0 64 64" className={sizeClass} fill="none" aria-hidden="true">
      <path
        d="M32 6l20 7v16c0 13.5-8.1 22.9-20 29-11.9-6.1-20-15.5-20-29V13l20-7z"
        fill="url(#shieldFill)"
        stroke="#f3cf97"
        strokeWidth="2"
      />
      <path d="M32 14v34" stroke="#ffe6c2" strokeOpacity="0.65" />
      <path d="M18 24l14-10 14 10" stroke="#ffdfb0" strokeOpacity="0.55" />
      <defs>
        <linearGradient id="shieldFill" x1="12" y1="8" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d8a16c" />
          <stop offset="1" stopColor="#8a4d2a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SeasonCalendar() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
      <rect x="9" y="13" width="6" height="5" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
