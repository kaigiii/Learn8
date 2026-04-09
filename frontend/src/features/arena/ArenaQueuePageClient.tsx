"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import {
  cancelCurrentArenaCompetitiveQueue,
  fetchCurrentArenaCompetitiveQueue,
} from "@/lib/arena/api";
import { resolveErrorMessage } from "@/lib/apiClient";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import type { ArenaCompetitiveQueueState } from "@/lib/apiTypes";

export default function ArenaQueuePageClient() {
  const router = useRouter();
  const { isReady } = useRequireAuthRedirect();
  const [queueState, setQueueState] = useState<ArenaCompetitiveQueueState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const current = await fetchCurrentArenaCompetitiveQueue();
        if (cancelled) return;
        setQueueState(current);
        if (current?.matchId) {
          router.replace(`/arena/match/${current.matchId}`);
          return;
        }
        if (!current) {
          router.replace("/home");
        }
      } catch (err) {
        if (!cancelled) {
          setError(resolveErrorMessage(err, "Unable to load competition queue right now."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void poll();
    const intervalId = window.setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isReady, router]);

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
