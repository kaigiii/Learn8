"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import {
  cancelCurrentArenaCompetitiveQueue,
  fetchCurrentArenaCompetitiveQueue,
  fetchArenaMatch,
  confirmArenaMatch,
} from "@/lib/arena/api";
import { watchArenaEvents } from "@/lib/arena/realtimeClient";
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
    if (!matchState?.deadlineAt || matchState.status !== "pending") {
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
  }, [matchState?.deadlineAt, matchState?.status]);

  // Real-time Event Listener for Match States (Rigor)
  useEffect(() => {
    if (!queueState?.matchId) return;

    const matchId = queueState.matchId;
    const watcher = watchArenaEvents({
      streamPath: `/arena/matches/${matchId}/stream`,
      onEvents: async () => {
        // Any event in the match stream triggers a deep state sync
        const refreshedMatch = await fetchArenaMatch(matchId);
        setMatchState(refreshedMatch);
        if (refreshedMatch.status === "in_progress") {
          router.replace(`/arena/match/${matchId}`);
        }
        if (refreshedMatch.status === "cancelled") {
          setMatchState(null);
          setAccepting(false);
        }
      },
    });

    return () => watcher.close();
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
    <div className="min-h-screen app-shared-bg">
      <TopStatsBar backHref="/home" pageTitle="Arena Queue" />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 md:px-8">
        <DeepGlassCard className="px-6 py-6 md:px-8 md:py-8">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-brand-teal">
            Topic Competition
          </p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-gray-700">
            Finding your next challenger
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-gray-500">
            We are matching you into the real-time official-topic competition. Stay on this screen
            and you will enter the match automatically once an opponent is found.
          </p>
        </DeepGlassCard>

        <DeepGlassCard className="px-6 py-6">
          <div className="grid gap-4 md:grid-cols-3">
            <QueueMetric label="Status" value={queueState?.status ?? (loading ? "loading" : "idle")} />
            <QueueMetric label="Topic" value={queueState?.publicCourseTitle ?? "..."} />
            <QueueMetric
              label="Queued At"
              value={queueState ? new Date(queueState.queuedAt).toLocaleTimeString() : "..."}
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <GameButton variant="secondary" onClick={() => void handleCancel()} disabled={busy}>
              Leave Queue
            </GameButton>
            <GameButton onClick={() => router.push("/home")} disabled={busy}>
              Back To Home
            </GameButton>
          </div>

          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        </DeepGlassCard>

        {matchState && matchState.status === "pending" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-gray-900/40 p-4 backdrop-blur-md">
            <DeepGlassCard className="w-full max-w-lg border-brand-teal/30 px-8 py-8 shadow-2xl">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-teal/10">
                  <div className="h-4 w-4 animate-ping rounded-full bg-brand-teal" />
                </div>
                <h2 className="mt-6 font-heading text-3xl font-black text-brand-gray-700">
                  MATCH FOUND!
                </h2>
                <p className="mt-2 text-brand-gray-500">
                  A challenger has arrived. Are you ready to compete?
                </p>

                <div className="mt-8 w-full space-y-3">
                  <div className="flex justify-between gap-4">
                    {(matchState.presenceStates || []).map((p) => (
                      <div key={p.userId} className="flex-1 rounded-xl bg-brand-gray-900/50 p-4 text-center">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-brand-gray-400">
                          {p.userId === authUser?.id ? "You" : "Challenger"}
                        </div>
                        <div className={`mt-1 text-sm font-black ${p.isAccepted ? "text-brand-teal" : "text-brand-gray-300"}`}>
                          {p.isAccepted ? "✓ READY" : "WAITING"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col items-center rounded-2xl bg-brand-gray-800/80 p-6 backdrop-blur-xl">
                    <span className="text-5xl font-black tabular-nums text-brand-teal">
                      {acceptTimer ?? "0"}
                    </span>
                    <span className="mt-1 text-xs font-bold uppercase tracking-widest text-brand-gray-400">
                      Seconds Remaining
                    </span>
                  </div>
                </div>

                <div className="mt-10 flex w-full flex-col gap-3">
                  <GameButton
                    onClick={() => void handleAcceptMatch()}
                    disabled={accepting}
                    className="h-14 text-lg"
                  >
                    {accepting ? "WAITING FOR OTHERS..." : "ACCEPT MATCH"}
                  </GameButton>
                  <button
                    onClick={() => void handleCancel()}
                    disabled={accepting}
                    className="text-sm font-semibold text-brand-gray-400 hover:text-rose-500"
                  >
                    Decline and Leave
                  </button>
                </div>
              </div>
            </DeepGlassCard>
          </div>
        )}
      </main>
    </div>
  );
}

function QueueMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-teal">{label}</p>
      <p className="mt-2 font-heading text-2xl font-bold text-brand-gray-700">{value}</p>
    </div>
  );
}
