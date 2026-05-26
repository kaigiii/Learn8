"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

import TopStatsBar from "@/components/layout/TopStatsBar";
import GameButton from "@/components/ui/GameButton";
import { useI18n } from "@/lib/i18n/useI18n";
import {
  cancelCurrentArenaCompetitiveQueue,
  fetchCurrentArenaCompetitiveQueue,
  fetchArenaMatch,
  confirmArenaMatch,
  joinArenaCompetitiveQueue,
} from "@/lib/arena/api";
import { arenaWsClient } from "@/lib/arena/realtimeClient";
import { resolveErrorMessage } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/app/useAuthStore";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import type { ArenaCompetitiveQueueState, ArenaMatchState } from "@/lib/apiTypes";

export default function ArenaQueuePageClient() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const pendingCourseId = searchParams.get("courseId");
  const { isReady } = useRequireAuthRedirect();
  const [queueState, setQueueState] = useState<ArenaCompetitiveQueueState | null>(null);
  const [matchState, setMatchState] = useState<ArenaMatchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptTimer, setAcceptTimer] = useState<number | null>(null);
  const authUser = useAuthStore((state) => state.user);

  const presenceStates = matchState?.presenceStates ?? [];
  const currentPlayer = presenceStates.find((player) => player.userId === authUser?.id) ?? null;
  const opponentPlayer = presenceStates.find((player) => player.userId !== authUser?.id) ?? null;
  const bothPlayersConnected =
    presenceStates.length >= 2 &&
    presenceStates.every((player) => player.connectionState === "connected");
  const canStartAcceptCountdown =
    matchState?.status === "pending" && bothPlayersConnected && Boolean(matchState?.deadlineAt);
  const currentAvatar = currentPlayer?.avatarUrl || authUser?.avatar_url || "/avatar/chicken.png";
  const currentName = currentPlayer?.displayName || authUser?.full_name || authUser?.email?.split("@")[0] || "You";
  const opponentName = opponentPlayer?.displayName || "Finding Opponent";
  const opponentAvatar = opponentPlayer?.avatarUrl || "/avatar/chicken.png";
  const hasOpponent = Boolean(opponentPlayer);

  // Auto-join if navigated here with a courseId param (fast-join flow)
  useEffect(() => {
    if (!isReady || !pendingCourseId) return;
    let cancelled = false;

    void (async () => {
      try {
        await joinArenaCompetitiveQueue({ publicCourseId: Number(pendingCourseId) });
      } catch {
        // If already in queue or join fails, continue — poll will handle it
      } finally {
        if (!cancelled) {
          // Strip the courseId param so a refresh doesn't re-join
          router.replace("/arena/queue");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [isReady, pendingCourseId, router]);

  // Poll for queue state (fallback and initial state)
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const current = await fetchCurrentArenaCompetitiveQueue();
        if (cancelled) return;
        setQueueState(current);

        if (current?.matchId) {
          const match = await fetchArenaMatch(current.matchId);
          if (cancelled) return;
          setMatchState(match);

          if (match.status === "in_progress") {
            router.replace(`/arena/match/${current.matchId}`);
            return;
          }
          if (match.status === "finished" || match.status === "cancelled") {
            // Stale match detected in the queue entry, clear it
            setMatchState(null);
            setAccepting(false);
            return;
          }
        } else {
          setMatchState(null);
          setAccepting(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(resolveErrorMessage(err, "Unable to load competition queue."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void poll();
    const intervalId = window.setInterval(poll, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isReady, router]);

  // Smooth Acceptance Timer
  useEffect(() => {
    if (!canStartAcceptCountdown || !matchState?.deadlineAt) {
      setAcceptTimer(null);
      return;
    }

    const calculate = () => {
      if (!matchState?.deadlineAt) return;
      const deadline = new Date(matchState.deadlineAt).getTime();
      const diff = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setAcceptTimer(diff);
    };

    calculate();
    const intervalId = window.setInterval(calculate, 1000);
    return () => window.clearInterval(intervalId);
  }, [canStartAcceptCountdown, matchState?.deadlineAt]);

  // Real-time Event Listener for Match States (Rigor)
  useEffect(() => {
    if (!queueState?.matchId) return;

    const matchId = queueState.matchId;
    arenaWsClient.subscribeMatch(matchId);
    const unsubscribeEvents = arenaWsClient.onEvents(async (events) => {
      const matchEvents = events.filter((e) => e.matchId === matchId);
      if (matchEvents.length === 0) return;
      
      const refreshedMatch = await fetchArenaMatch(matchId);
      setMatchState(refreshedMatch);
      if (refreshedMatch.status === "in_progress") {
        router.replace(`/arena/match/${matchId}`);
      }
      if (refreshedMatch.status === "cancelled") {
        setMatchState(null);
        setAccepting(false);
      }
    });

    return () => {
      unsubscribeEvents();
      arenaWsClient.unsubscribeMatch(matchId);
    };
  }, [queueState?.matchId, router]);

  const handleCancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await cancelCurrentArenaCompetitiveQueue();
      router.push("/home");
    } catch (err) {
      setError(resolveErrorMessage(err, "Unable to cancel queue right now."));
      setBusy(false);
    }
  };

  const handleAcceptMatch = async () => {
    if (!queueState?.matchId || accepting) return;
    setAccepting(true);
    try {
      await confirmArenaMatch(queueState.matchId);
      // Logic continues via polling (match status will update)
    } catch (err) {
      setError(resolveErrorMessage(err, "Failed to accept the match."));
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[url('/backgrounds/MainBg.png')] bg-cover bg-center bg-no-repeat">
      <TopStatsBar
        backHref="/home"
        pageTitle={t("arena.queue.pageTitle")}
        quickLinks={[
          {
            href: "/multiplayer",
            label: t("common.multiplayer"),
            iconSrc: "/svg/multiplayer-controller.svg",
            iconAlt: t("common.multiplayer"),
          },
          {
            href: "/arena/leaderboard",
            label: t("common.leaderboard"),
            iconSrc: "/svg/leaderboard-logo.svg",
            iconAlt: t("common.leaderboard"),
          },
        ]}
      />
      <main className="relative mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl flex-col items-center justify-center px-4 py-8 md:px-8">
        {/* Background sparkle accents */}
        <BackgroundOrbs />

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full text-center"
        >
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#7AC7C4]/40 bg-white/60 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-[#4a9e9b] backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7AC7C4] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5fb3af]" />
            </span>
            {t("arena.queue.rankedDuel")}
          </div>
          <h1
            className="bg-gradient-to-b from-[#7AC7C4] via-[#5fb3af] to-[#8dd4d1] bg-clip-text font-heading text-[2.4rem] font-black leading-none tracking-tight text-transparent md:text-6xl"
          >
            {t("arena.queue.findYourMatch")}
          </h1>
          <p className="mx-auto mt-4 min-h-[24px] max-w-2xl text-sm leading-relaxed text-brand-gray-600 md:text-base">
            {matchState?.status === "pending"
              ? bothPlayersConnected
                ? t("arena.queue.bothConnected")
                : t("arena.queue.waitingSync")
              : hasOpponent
                ? t("arena.queue.matchReady")
                : t("arena.queue.searching")}
          </p>
        </motion.div>

        <div className="relative z-10 mt-6 flex w-full flex-row items-center justify-center gap-2 sm:mt-10 sm:gap-4 lg:gap-8 xl:gap-10">
          <motion.div
            initial={{ opacity: 0, x: -60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", damping: 14, stiffness: 120, delay: 0.15 }}
            className="flex min-w-0 flex-1 justify-center lg:flex-none"
          >
            <PlayerDuelCard
              title={currentName}
              avatarSrc={currentAvatar}
              accent="left"
              isAccepted={Boolean(currentPlayer?.isAccepted)}
            />
          </motion.div>

          <VsBadge />

          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", damping: 14, stiffness: 120, delay: 0.15 }}
            className="flex min-w-0 flex-1 justify-center lg:flex-none"
          >
            <PlayerDuelCard
              title={hasOpponent ? opponentName : t("arena.queue.findingOpponent")}
              avatarSrc={hasOpponent ? opponentAvatar : undefined}
              accent="right"
              loading={!hasOpponent}
              isAccepted={Boolean(opponentPlayer?.isAccepted)}
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative z-10 mt-6 flex w-full max-w-3xl flex-col items-center gap-3 sm:mt-10"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <GameButton
              variant="secondary"
              onClick={() => void handleCancel()}
              disabled={busy}
              className="min-w-[180px]"
            >
              {t("arena.queue.cancelExit")}
            </GameButton>
            {matchState?.status === "pending" ? (
              <GameButton
                onClick={() => void handleAcceptMatch()}
                disabled={accepting || !canStartAcceptCountdown}
                className="min-w-[180px]"
              >
                {accepting
                  ? t("arena.queue.waitingOthers")
                  : canStartAcceptCountdown
                    ? t("arena.queue.accept", { seconds: String(acceptTimer ?? 0) })
                    : t("arena.queue.acceptWaitingSync")}
              </GameButton>
            ) : null}
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </motion.div>
      </main>
    </div>
  );
}

function BackgroundOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <motion.div
        className="absolute -left-32 top-1/4 h-72 w-72 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(122,199,196,0.28), transparent 70%)" }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 bottom-1/4 h-72 w-72 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(158,203,212,0.28), transparent 70%)" }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.75, 0.4] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 1 }}
      />
    </div>
  );
}

function VsBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 10, stiffness: 140, delay: 0.35 }}
      className="relative flex flex-shrink-0 flex-col items-center justify-center px-1 md:px-2 lg:px-3"
    >
      {/* Pulsing energy ring */}
      <motion.div
        className="absolute h-16 w-16 rounded-full sm:h-28 sm:w-28 lg:h-32 lg:w-32"
        style={{
          background:
            "radial-gradient(circle, rgba(212,169,106,0.35) 0%, rgba(122,199,196,0.2) 45%, transparent 70%)",
        }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
      />
      <div className="relative">
        <span
          className="bg-gradient-to-br from-[#DEBA82] via-[#6dbfbc] to-[#55aaa6] bg-clip-text font-heading text-3xl font-black tracking-tight text-transparent sm:text-5xl md:text-7xl lg:text-[6.25rem]"
          style={{
            filter: "drop-shadow(0 4px 14px rgba(122,199,196,0.45))",
            WebkitTextStroke: "1px rgba(255,255,255,0.6)",
          }}
        >
          VS
        </span>
      </div>
    </motion.div>
  );
}

function PlayerDuelCard({
  title,
  avatarSrc,
  accent,
  loading = false,
  isAccepted = false,
}: {
  title: string;
  avatarSrc?: string;
  accent: "left" | "right";
  loading?: boolean;
  isAccepted?: boolean;
}) {
  const accentGlow =
    accent === "left"
      ? "shadow-[0_28px_50px_rgba(122,199,196,0.25)]"
      : "shadow-[0_28px_50px_rgba(158,203,212,0.25)]";

  return (
    <div
      className={`relative w-full max-w-[360px] overflow-hidden rounded-[20px] bg-white/70 p-2 backdrop-blur-xl sm:rounded-[30px] sm:p-4 lg:w-[min(44vw,360px)] ${accentGlow}`}
    >
      {/* Accent corner glow */}
      <div
        className={`pointer-events-none absolute ${
          accent === "left" ? "-top-px -left-px rounded-tl-[28px]" : "-top-px -right-px rounded-tr-[28px]"
        } h-1/3 w-1/2 bg-gradient-to-br from-white/60 to-transparent`}
      />

      <div className="relative flex min-h-[150px] items-center justify-center overflow-hidden rounded-[16px] bg-[linear-gradient(155deg,rgba(232,245,247,0.85),rgba(200,228,233,0.92))] p-2 sm:min-h-[230px] sm:rounded-[24px] sm:p-4 lg:min-h-[290px]">
        {/* Subtle inner grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(122,199,196,0.18) 0%, transparent 35%), radial-gradient(circle at 80% 70%, rgba(212,169,106,0.12) 0%, transparent 40%)",
          }}
        />

        {loading ? <SearchingIndicator /> : <AvatarBubble src={avatarSrc} alt={title} isAccepted={isAccepted} accent={accent} />}
      </div>

      <div className="mt-2 rounded-[12px] border border-white/60 bg-white/85 px-2 py-2 shadow-[0_10px_24px_rgba(95,146,165,0.08)] sm:mt-3 sm:rounded-[18px] sm:px-5 sm:py-3">
        <p className="truncate text-center font-heading text-sm font-extrabold leading-tight text-brand-gray-700 sm:text-lg lg:text-[1.2rem]">
          {title}
        </p>
      </div>
    </div>
  );
}

function SearchingIndicator() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-2 sm:gap-4">
      <div className="relative h-14 w-14 sm:h-20 sm:w-20 lg:h-24 lg:w-24">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-[#7AC7C4]/30"
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-2 border-[#7AC7C4]/40"
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.4 }}
        />
        <div className="absolute inset-[6px] flex items-center justify-center rounded-full bg-gradient-to-br from-[#7AC7C4] to-[#5fb3af] shadow-[0_10px_24px_rgba(122,199,196,0.45)] sm:inset-4">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-white sm:h-7 sm:w-7 lg:h-8 lg:w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-1 font-heading text-xs font-bold uppercase tracking-[0.18em] text-[#4a9e9b]">
        <span>{t("arena.queue.searchingLabel")}</span>
        <SearchingDots />
      </div>
    </div>
  );
}

function SearchingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#5fb3af]"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

function AvatarBubble({
  src,
  alt,
  isAccepted = false,
  accent = "left",
}: {
  src?: string;
  alt: string;
  isAccepted?: boolean;
  accent?: "left" | "right";
}) {
  const imageSrc = src || "/avatar/chicken.png";

  return (
    <div className="relative flex h-[96px] w-[96px] items-center justify-center sm:h-[170px] sm:w-[170px] lg:h-[220px] lg:w-[220px]">
      {/* Soft glow halo */}
      <div className="absolute inset-2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.5),rgba(255,255,255,0)_60%)]" />
      {/* Avatar */}
      <div className="relative h-[86px] w-[86px] overflow-hidden rounded-full bg-white shadow-[0_18px_30px_rgba(95,146,165,0.2)] sm:h-[154px] sm:w-[154px] lg:h-[200px] lg:w-[200px]">
        <Image src={imageSrc} alt={alt} fill sizes="(max-width: 640px) 96px, (max-width: 1024px) 170px, 220px" className="object-cover" />
      </div>
      {isAccepted ? (
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 10, stiffness: 200 }}
          className="absolute bottom-1 right-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_10px_24px_rgba(16,185,129,0.5)] ring-2 ring-white sm:h-10 sm:w-10 sm:ring-4 lg:h-12 lg:w-12"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-white sm:h-6 sm:w-6 lg:h-7 lg:w-7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </motion.div>
      ) : null}
    </div>
  );
}
