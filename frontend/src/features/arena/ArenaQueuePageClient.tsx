"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import TopStatsBar from "@/components/layout/TopStatsBar";
import GameButton from "@/components/ui/GameButton";
import {
  cancelCurrentArenaCompetitiveQueue,
  fetchCurrentArenaCompetitiveQueue,
  fetchArenaMatch,
  confirmArenaMatch,
} from "@/lib/arena/api";
import { arenaWsClient } from "@/lib/arena/realtimeClient";
import { resolveErrorMessage } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/app/useAuthStore";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import type { ArenaCompetitiveQueueState, ArenaMatchState } from "@/lib/apiTypes";

export default function ArenaQueuePageClient() {
  const router = useRouter();
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
        pageTitle="Arena Queue"
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
      <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-6xl flex-col items-center justify-center px-4 py-8 md:px-8">
        <div className="w-full text-center">
          <h1 className="font-heading text-[2.7rem] font-black leading-none tracking-tight text-brand-gray-700 md:text-6xl">
            Find Your Match: Duel
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-brand-gray-600 md:text-base">
            {matchState?.status === "pending"
              ? bothPlayersConnected
                ? "Both players are connected. Accept countdown is now running."
                : "Match found. Waiting for both players to connect before acceptance starts."
              : ""}
          </p>
        </div>

        <div className="mt-10 flex w-full flex-col items-center justify-center gap-5 lg:flex-row lg:gap-8 xl:gap-10">
          <PlayerDuelCard
            title={currentName}
            avatarSrc={currentAvatar}
            accent="left"
            status={currentPlayer?.isAccepted ? "READY" : "WAITING"}
            statusTone={currentPlayer?.isAccepted ? "ready" : "waiting"}
            isAccepted={Boolean(currentPlayer?.isAccepted)}
          />

          <div className="flex flex-col items-center justify-center px-1 md:px-2 lg:px-3">
            <span className="font-heading text-6xl font-black tracking-tight text-brand-gray-600 md:text-7xl lg:text-[6.25rem]">
              VS
            </span>
          </div>

          <PlayerDuelCard
            title={hasOpponent ? opponentName : "FINDING OPPONENT"}
            avatarSrc={hasOpponent ? opponentAvatar : undefined}
            accent="right"
            status={hasOpponent ? (opponentPlayer?.isAccepted ? "READY" : "WAITING") : "SEARCHING"}
            statusTone={hasOpponent ? (opponentPlayer?.isAccepted ? "ready" : "waiting") : "searching"}
            loading={!hasOpponent}
            isAccepted={Boolean(opponentPlayer?.isAccepted)}
          />
        </div>

        <div className="mt-8 flex w-full max-w-3xl flex-col items-center gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <GameButton
              variant="secondary"
              onClick={() => void handleCancel()}
              disabled={busy}
              className="min-w-[180px]"
            >
              Cancel & Exit
            </GameButton>
            {canStartAcceptCountdown ? (
              <GameButton
                onClick={() => void handleAcceptMatch()}
                disabled={accepting}
                className="min-w-[180px]"
              >
                {accepting ? "WAITING FOR OTHERS..." : `ACCEPT (${acceptTimer ?? 0}s)`}
              </GameButton>
            ) : null}
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>
      </main>
    </div>
  );
}

function PlayerDuelCard({
  title,
  avatarSrc,
  accent,
  status,
  statusTone,
  loading = false,
  isAccepted = false,
}: {
  title: string;
  avatarSrc?: string;
  accent: "left" | "right";
  status: string;
  statusTone: "ready" | "waiting" | "searching";
  loading?: boolean;
  isAccepted?: boolean;
}) {
  const statusClassName =
    statusTone === "ready"
      ? "bg-emerald-100 text-emerald-700"
      : statusTone === "waiting"
        ? "bg-amber-100 text-amber-700"
        : "bg-brand-teal/15 text-brand-teal";

  const shadowClassName = "shadow-[0_28px_50px_rgba(95,146,165,0.14)]";

  return (
    <div className={`relative w-full max-w-[360px] overflow-hidden rounded-[30px] border border-white/70 bg-white/62 p-4 backdrop-blur-xl lg:w-[min(44vw,360px)] ${shadowClassName}`}>
      <div className="relative flex min-h-[290px] items-center justify-center rounded-[24px] bg-[linear-gradient(180deg,rgba(222,241,247,0.9),rgba(210,233,242,0.94))] p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="h-16 w-16 animate-spin rounded-full border-[6px] border-brand-teal/15 border-t-brand-teal/60" />
          </div>
        ) : (
          <AvatarBubble src={avatarSrc} alt={title} isAccepted={isAccepted} />
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-[18px] bg-white/80 px-5 py-4 text-center shadow-[0_10px_24px_rgba(95,146,165,0.08)]">
        <p className="truncate font-heading text-[1.55rem] font-extrabold leading-none text-brand-gray-700">
          {title}
        </p>
      </div>
    </div>
  );
}

function AvatarBubble({ src, alt, isAccepted = false }: { src?: string; alt: string; isAccepted?: boolean }) {
  const imageSrc = src || "/avatar/chicken.png";
  return (
    <div className="relative flex h-[170px] w-[170px] items-center justify-center rounded-full bg-white/35 shadow-[inset_0_0_0_12px_rgba(255,255,255,0.26)]">
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22),rgba(255,255,255,0)_58%)]" />
      <div className="relative h-[138px] w-[138px] overflow-hidden rounded-full bg-white shadow-[0_18px_30px_rgba(95,146,165,0.15)]">
        <Image src={imageSrc} alt={alt} fill sizes="138px" className="object-cover" />
      </div>
      {isAccepted ? (
        <div className="absolute bottom-1 right-1 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 shadow-[0_10px_24px_rgba(16,185,129,0.35)] ring-4 ring-[#d8ecf4]">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      ) : null}
    </div>
  );
}
