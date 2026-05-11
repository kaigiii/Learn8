"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import {
  createArenaRoom,
  fetchArenaProfile,
  fetchArenaPublicCourses,
  fetchArenaSeason,
  joinArenaCompetitiveQueue,
  joinArenaRoom,
} from "@/lib/arena/api";
import type { ArenaProfile, ArenaPublicCourse, ArenaSeasonSummary } from "@/lib/apiTypes";
import { useI18n } from "@/lib/i18n/useI18n";
import type { TranslationKey } from "@/lib/i18n/translations";

const RANDOM_TOPIC_ID = -1;

function translateRankTier(t: (key: TranslationKey) => string, tier?: string | null): string {
  if (!tier) return "...";
  const key = `leaderboard.tier.${tier.trim().toLowerCase()}` as TranslationKey;
  return t(key);
}

export function HomeArenaPanel() {
  const router = useRouter();
  const { t } = useI18n();
  const [courses, setCourses] = useState<ArenaPublicCourse[]>([]);
  const [season, setSeason] = useState<ArenaSeasonSummary | null>(null);
  const [profile, setProfile] = useState<ArenaProfile | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(RANDOM_TOPIC_ID);
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [nextCourses, nextSeason, nextProfile] = await Promise.all([
          fetchArenaPublicCourses(),
          fetchArenaSeason(),
          fetchArenaProfile(),
        ]);
        if (cancelled) {
          return;
        }
        setCourses(nextCourses);
        setSeason(nextSeason);
        setProfile(nextProfile);
        setSelectedCourseId((current) => current ?? RANDOM_TOPIC_ID);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("arena.failedLoadArena"));
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
  }, []);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  const dropdownOptions = useMemo(() => {
    if (courses.length === 0) return [] as Array<{ value: number; label: string }>;
    return [
      { value: RANDOM_TOPIC_ID, label: t("arena.randomTopicAssignment") },
      ...courses.map((course) => ({
        value: course.id,
        label: `${course.courseTitle} - ${course.title}`,
      })),
    ];
  }, [courses]);

  const resolveTargetCourse = useMemo(() => {
    if (courses.length === 0) return null;
    if (selectedCourseId === RANDOM_TOPIC_ID || selectedCourseId === null) {
      const randomIndex = Math.floor(Math.random() * courses.length);
      return courses[randomIndex] ?? null;
    }
    return courses.find((course) => course.id === selectedCourseId) ?? null;
  }, [courses, selectedCourseId]);
  const rankBadge = resolveRankTierBadgeVisual(profile?.rankTier);

  const handleJoinCompetition = () => {
    if (courses.length === 0) return;
    const targetCourse = resolveTargetCourse;
    if (!targetCourse) return;
    router.push(`/arena/queue?courseId=${targetCourse.id}`);
  };

  const handleCreateRoom = async () => {
    if (courses.length === 0) {
      return;
    }
    const targetCourse = resolveTargetCourse;
    if (!targetCourse) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createArenaRoom({
        publicCourseId: targetCourse.id,
      });
      const topicPref =
        selectedCourseId === RANDOM_TOPIC_ID
          ? "random"
          : String(targetCourse.poolId);
      router.push(`/arena/lobby/${room.roomCode}?topic=${encodeURIComponent(topicPref)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("arena.failedCreateRoom"));
    } finally {
      setBusy(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await joinArenaRoom(roomCode.trim().toUpperCase());
      router.push(`/arena/lobby/${room.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("arena.failedJoinRoom"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DeepGlassCard className="h-full px-4 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6">
      <div className="space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <p className="mt-0 font-heading text-xl font-extrabold leading-tight text-brand-gray-700 sm:text-2xl md:mt-1 md:text-3xl">
            {t("arena.multiplayerMode")}
          </p>
          <div className="w-full rounded-2xl bg-white/72 px-3 py-2 text-left sm:text-right md:w-auto">
            {season?.name ? (
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-teal">
                {season.name}
              </p>
            ) : null}
            <div className="mt-1 flex items-center gap-2 sm:justify-end">
              <Image
                src={rankBadge.src}
                alt={rankBadge.alt}
                width={40}
                height={40}
                className="h-9 w-9 object-contain sm:h-10 sm:w-10"
              />
              <p className="font-heading text-lg font-extrabold text-brand-gray-700 sm:text-xl">
                {translateRankTier(t, profile?.rankTier)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:gap-4 lg:grid-cols-2">
          <section className="flex h-full flex-col rounded-2xl border border-[#9ecbd4]/18 bg-white/52 p-3 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm sm:p-4">
            <h3 className="font-heading text-xl font-bold text-brand-gray-700 sm:text-2xl">{t("arena.officialCompetition")}</h3>
            <div className="mt-3 flex flex-1 flex-col justify-between gap-3 pb-4 sm:pb-5">
              <div>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray-700">
                    {t("arena.publicCourse")}
                  </span>
                  <div className="mt-2">
                    <ArenaCourseDropdown
                      value={selectedCourseId}
                      options={dropdownOptions}
                      placeholder={loading ? t("arena.loadingCompetitions") : t("arena.noCompetitions")}
                      disabled={loading || busy || courses.length === 0}
                      onChange={setSelectedCourseId}
                    />
                  </div>
                </label>

                <p className="mt-2 min-h-[2.5rem] line-clamp-2 text-xs leading-relaxed text-brand-gray-500">
                  {selectedCourseId === RANDOM_TOPIC_ID
                    ? t("arena.randomTopicHint")
                    : selectedCourse?.topic ?? ""}
                </p>
              </div>

              <GameButton
                variant="secondary"
                className="w-full py-3 text-base sm:text-[1.05rem]"
                onClick={handleJoinCompetition}
                disabled={courses.length === 0 || busy}
              >
                {t("arena.quickMatch")}
              </GameButton>
            </div>
          </section>

          <section className="flex h-full flex-col rounded-2xl border border-[#9ecbd4]/18 bg-white/52 p-3 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm sm:p-4">
            <h3 className="font-heading text-xl font-bold text-brand-gray-700 sm:text-2xl">{t("arena.roomManagement")}</h3>

            <div className="mt-3 flex flex-1 flex-col justify-between gap-3 pb-4 sm:pb-5">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray-700">
                  {t("arena.joinPrivateRoom")}
                </span>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-brand-gray-200 bg-white px-4 py-3 text-sm uppercase text-brand-gray-700 outline-none"
                    value={roomCode}
                    onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                    placeholder={t("arena.enterRoomCode")}
                  />
                  <GameButton
                    variant="secondary"
                    className="w-full px-4 py-3 text-sm sm:w-auto sm:min-w-[112px]"
                    onClick={() => void handleJoinRoom()}
                    disabled={!roomCode.trim() || busy}
                  >
                    {t("arena.joinRoom")}
                  </GameButton>
                </div>
              </label>

              <GameButton
                variant="secondary"
                className="w-full py-3 text-base sm:text-[1.05rem]"
                onClick={() => void handleCreateRoom()}
                disabled={courses.length === 0 || busy}
              >
                {t("arena.createRoom")}
              </GameButton>
            </div>
          </section>
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      </div>
    </DeepGlassCard>
  );
}

function ArenaCourseDropdown({
  value,
  options,
  placeholder,
  disabled,
  onChange,
}: {
  value: number | null;
  options: Array<{ value: number; label: string }>;
  placeholder: string;
  disabled?: boolean;
  onChange: (next: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeLabel = options.find((option) => option.value === value)?.label ?? placeholder;

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
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
          }
        }}
        className={`flex h-[52px] w-full items-center justify-between rounded-2xl border border-brand-gray-200 bg-white px-4 text-left text-sm font-semibold text-brand-gray-700 outline-none transition sm:text-base ${
          disabled
            ? "cursor-not-allowed opacity-70"
            : "hover:border-[#0e758b] hover:bg-white"
        } ${open ? "ring-2 ring-brand-teal/30" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span className="truncate">{activeLabel}</span>
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-brand-gray-400 transition ${open ? "rotate-180" : ""}`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M5.25 7.5 10 12.25 14.75 7.5" />
        </svg>
      </button>

      {open && options.length > 0 ? (
        <div
          className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
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
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                option.value === value
                  ? "bg-brand-teal/10 text-brand-gray-800"
                  : "text-brand-gray-600 hover:bg-brand-gray-100/70"
              }`}
              role="option"
              aria-selected={option.value === value}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? <span className="text-xs text-brand-teal">●</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function resolveRankTierBadgeVisual(rankTier?: string | null): { src: string; alt: string } {
  switch ((rankTier ?? "").trim().toLowerCase()) {
    case "silver":
      return { src: "/svg/season-badge-star.svg", alt: "Silver badge" };
    case "gold":
      return { src: "/svg/season-badge-podium.svg", alt: "Gold badge" };
    case "platinum":
      return { src: "/svg/season-badge-elite.svg", alt: "Platinum badge" };
    case "diamond":
    case "master":
    case "grandmaster":
      return { src: "/svg/season-badge-crown.svg", alt: "Top tier badge" };
    case "bronze":
    default:
      return { src: "/svg/season-badge-none.svg", alt: "Bronze badge" };
  }
}
