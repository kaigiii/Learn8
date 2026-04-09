"use client";

import React from "react";
import { useRouter } from "next/navigation";

import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import { useArenaMatchEvents } from "./hooks/useArenaMatchEvents";

export default function ArenaResultPageClient({ matchId }: { matchId: number }) {
  const router = useRouter();
  const { isReady } = useRequireAuthRedirect();
  const match = useArenaMatchEvents(isReady ? matchId : null);
  const result = match?.currentPlayerResult ?? null;

  return (
    <div className="min-h-screen app-shared-bg">
      <TopStatsBar backHref="/home" pageTitle="Arena Result" />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8">
        <DeepGlassCard className="px-6 py-6 md:px-8 md:py-8">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-brand-teal">
            Match Complete
          </p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-gray-700 md:text-5xl">
            {match?.publicCourseTitle ?? "Arena Result"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-brand-gray-500">
            Review your placement, rating movement, and rewards before jumping back into another room.
          </p>
        </DeepGlassCard>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <DeepGlassCard className="px-6 py-6">
            <h2 className="font-heading text-2xl font-bold text-brand-gray-700">Your Finish</h2>
            {result ? (
              <div className="mt-5 space-y-4">
                <ResultMetric label="Placement" value={`#${result.rank}`} />
                <ResultMetric label="Score" value={String(result.score)} />
                <ResultMetric label="Accuracy" value={`${result.accuracy ?? 0}%`} />
                <ResultMetric
                  label="Rating Delta"
                  value={`${result.ratingDelta && result.ratingDelta > 0 ? "+" : ""}${result.ratingDelta ?? 0}`}
                />
                <ResultMetric
                  label="Rank Tier"
                  value={`${result.rankTierBefore ?? "-"} -> ${result.rankTierAfter ?? "-"}`}
                />
                <ResultMetric label="XP Gained" value={`+${result.xpGained ?? 0}`} />
                <ResultMetric label="Credits Gained" value={`+${result.creditsGained ?? 0}`} />
              </div>
            ) : (
              <p className="mt-5 text-sm text-brand-gray-500">Waiting for final player result...</p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <GameButton onClick={() => router.push("/home")}>Back To Home</GameButton>
              <GameButton
                variant="secondary"
                onClick={() => {
                  if (match?.roomCode) {
                    router.push(`/arena/lobby/${match.roomCode}`);
                    return;
                  }
                  router.push("/home");
                }}
              >
                Return To Room
              </GameButton>
            </div>
          </DeepGlassCard>

          <DeepGlassCard className="px-6 py-6">
            <h2 className="font-heading text-2xl font-bold text-brand-gray-700">Final Standings</h2>
            <div className="mt-5 space-y-3">
              {(match?.standings ?? []).map((entry) => (
                <div key={entry.userId} className="rounded-[26px] border border-white/70 bg-white/68 px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-heading text-xl font-bold text-brand-gray-700">
                        #{entry.rank} {entry.displayName}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-brand-teal">
                        {entry.rankTierAfter ?? entry.rankTierBefore ?? "Arena"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-heading text-2xl font-bold text-brand-gray-700">{entry.score}</p>
                      <p className="text-xs text-brand-gray-500">
                        {entry.correctCount} correct / {entry.answeredCount} answered
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <MiniMetric label="Accuracy" value={`${entry.accuracy ?? 0}%`} />
                    <MiniMetric label="Rating" value={`${entry.ratingDelta && entry.ratingDelta > 0 ? "+" : ""}${entry.ratingDelta ?? 0}`} />
                    <MiniMetric label="XP" value={`+${entry.xpGained ?? 0}`} />
                    <MiniMetric label="Credits" value={`+${entry.creditsGained ?? 0}`} />
                  </div>
                </div>
              ))}
            </div>
          </DeepGlassCard>
        </div>
      </main>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-teal">{label}</p>
      <p className="mt-2 font-heading text-2xl font-bold text-brand-gray-700">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#9ecbd4]/18 bg-white/72 px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-teal">{label}</p>
      <p className="mt-1 font-heading text-lg font-bold text-brand-gray-700">{value}</p>
    </div>
  );
}
