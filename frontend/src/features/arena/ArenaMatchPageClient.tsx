"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import { arenaWsClient } from "@/lib/arena/realtimeClient";
import { getArenaEventLabel } from "@/lib/arena/eventTypes";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import { useAuthStore } from "@/stores/app/useAuthStore";
import { useArenaMatchStore } from "@/stores/arena/useArenaMatchStore";
import { useArenaMatchEvents } from "./hooks/useArenaMatchEvents";
import { 
  FiList, 
  FiHash, 
  FiLayers, 
  FiMessageSquare, 
  FiBookOpen, 
  FiZap, 
  FiCheckCircle 
} from "react-icons/fi";
import MultipleChoiceQuestion from "@/components/lesson-session/MultipleChoiceQuestion";
import MatchingPairsQuestion from "@/components/lesson-session/MatchingPairsQuestion";
import OrderingQuestion from "@/components/lesson-session/OrderingQuestion";
import FeynmanQuestion from "@/components/lesson-session/FeynmanQuestion";
import ExplainerMediaCard from "@/components/lesson-session/ExplainerMediaCard";
import { useMatchingPairsStage } from "@/features/lesson-session/hooks/useMatchingPairsStage";

export default function ArenaMatchPageClient({ matchId }: { matchId: number }) {
  const router = useRouter();
  const { isReady } = useRequireAuthRedirect();
  const authUser = useAuthStore((state) => state.user);
  const match = useArenaMatchEvents(isReady ? matchId : null);
  const reset = useArenaMatchStore((state) => state.reset);
  const events = useArenaMatchStore((state) => state.events);
  const connectionStatus = useArenaMatchStore((state) => state.connectionStatus);
  const isRecovering = useArenaMatchStore((state) => state.isRecovering);
  const selectedOptionId = useArenaMatchStore((state) => state.selectedOptionId);
  const setSelectedOptionId = useArenaMatchStore((state) => state.setSelectedOptionId);
  const submitting = useArenaMatchStore((state) => state.submitting);
  const setSubmitting = useArenaMatchStore((state) => state.setSubmitting);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  // --- Interactive Question State ---
  const mapDifficulty = (d?: string | null): "low" | "medium" | "high" | null => {
    if (!d) return "low";
    const lower = d.toLowerCase();
    if (lower === "hard" || lower === "high") return "high";
    if (lower === "medium" || lower === "intermediate") return "medium";
    return "low";
  };

  const activeRound = match?.activeRound ?? null;
  const question = activeRound?.question;

  // Matching Pairs Hook
  const {
    selectedLeftId,
    selectedRightId,
    matched,
    matchedPairs,
    shuffledRightIds,
    allMatched,
    pickLeft,
    pickRight,
    handleHint: handleMatchingHint,
  } = useMatchingPairsStage({
    pairs: (question?.questionType === "MatchingPairs" ? (question?.options || []).map((o: any, i: number) => ({
      id: String(i),
      left: o.left || "Side A",
      right: o.right || "Side B"
    })) : []),
    enabled: question?.questionType === "MatchingPairs" && !activeRound?.hasSubmitted,
    onCorrectStageComplete: (results) => {
      setSelectedOptionId(JSON.stringify(results));
    },
    onHintUse: async () => true, // Arena hints are free for now or handled differently
  });

  // Ordering State
  const [orderedItems, setOrderedItems] = useState<string[]>([]);
  useEffect(() => {
    if (question?.questionType === "Ordering") {
      setOrderedItems([]);
    }
  }, [question?.questionId, question?.questionType]);

  const handleOrderingSubmit = (items: string[]) => {
    setOrderedItems(items);
    setSelectedOptionId(JSON.stringify(items));
  };

  useEffect(() => {
    if (question?.questionType === "Ordering" && activeRound && !activeRound.hasSubmitted) {
      // Initialize with the shuffled items if not already set
      // This allows the user to submit the initial random order if they wish
      const rawSteps = question.options || [];
      const shuffled = [...rawSteps].sort(() => Math.random() - 0.5);
      const initialOrder = shuffled.map((s: any) => typeof s === "string" ? s : (s.text || s.content || s.id || "Step"));
      setSelectedOptionId(JSON.stringify(initialOrder));
    }
  }, [question?.questionId, question?.questionType, activeRound?.roundId]);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (activeRound?.question?.questionType === "MatchingPairs" && allMatched) {
      setSelectedOptionId(JSON.stringify(matchedPairs));
    } else if (activeRound?.question?.questionType === "MatchingPairs" && !allMatched) {
      setSelectedOptionId(null);
    }
  }, [allMatched, matchedPairs, activeRound?.question?.questionType, setSelectedOptionId]);

  useEffect(() => {
    if (activeRound?.roundId) {
       setSelectedOptionId(null);
    }
  }, [activeRound?.roundId, setSelectedOptionId]);

  useEffect(() => {
    if (!match?.activeRound?.deadlineAt) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const deadlineAt = match.activeRound?.deadlineAt ?? "";
      // Ensure the deadline is treated as UTC if it ends with Z
      const deadline = new Date(deadlineAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, deadline - now);
      setRemainingSeconds(Math.ceil(diff / 1000));
    };

    tick();
    const intervalId = window.setInterval(tick, 200);
    return () => window.clearInterval(intervalId);
  }, [match?.activeRound?.deadlineAt]);

  useEffect(() => {
    if (match?.activeRound?.hasSubmitted) {
      setSelectedOptionId(null);
    }
  }, [match?.activeRound?.hasSubmitted, setSelectedOptionId]);

  useEffect(() => {
    if (match?.status === "finished" && match.matchId === matchId) {
      router.replace(`/arena/result/${match.matchId}`);
    }
  }, [match?.matchId, match?.status, matchId, router]);

  const latestReveal = useMemo(() => {
    return [...events].reverse().find((event) => event.eventType === "round.revealed") ?? null;
  }, [events]);
  const latestRevealAnswer = useMemo(() => {
    const payload = latestReveal?.payload;
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const revealedAnswer = (payload as Record<string, unknown>).revealedAnswer;
    if (!revealedAnswer || typeof revealedAnswer !== "object") {
      return null;
    }
    const correctOptionId = (revealedAnswer as Record<string, unknown>).correctOptionId;
    return typeof correctOptionId === "string" ? correctOptionId : null;
  }, [latestReveal]);

  const handleSubmit = async () => {
    if (!match?.activeRound) return;
    
    // For interactive types, ensure we have a value
    let finalValue = selectedOptionId;
    if (question?.questionType === "MatchingPairs" && !finalValue && allMatched) {
      finalValue = JSON.stringify(matchedPairs);
    }
    
    if (!finalValue) return;

    setSubmitting(true);
    setSubmitNotice(null);

    // OPTIMISTIC UI: Instantly show as submitted locally
    useArenaMatchStore.getState().patchMatch({
      activeRound: match?.activeRound ? { ...match.activeRound, hasSubmitted: true } : null
    });

    try {
      const result = await arenaWsClient.sendActionWithResponse<{
        state: any;
        alreadySubmitted: boolean;
        roundClosed: boolean;
        matchFinished: boolean;
      }>("submit_answer", {
        matchId: match.matchId,
        roundId: match.activeRound.roundId,
        selectedOptionId: finalValue,
      });
      useArenaMatchStore.getState().setMatch(result.state);
      if (result.alreadySubmitted) {
        setSubmitNotice("Your answer was already locked in for this round.");
      }
      if (result.roundClosed) {
        setSelectedOptionId(null);
      }
      if (result.matchFinished) {
        router.push(`/arena/result/${result.state.matchId}`);
      }
    } catch (err) {
      // Rollback optimism on error
      useArenaMatchStore.getState().patchMatch({
        activeRound: match?.activeRound ? { ...match.activeRound, hasSubmitted: false } : null
      });
      console.error("Submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const activeRound_ = activeRound; // to avoid shadowed name if any
  const presenceByUserId = useMemo(
    () => new Map((match?.presenceStates ?? []).map((entry) => [entry.userId, entry])),
    [match?.presenceStates]
  );
  const submittedCount = activeRound?.submittedPlayerIds.length ?? 0;
  const totalPlayers = match?.standings.length ?? 0;
  const pendingPlayers = useMemo(() => {
    if (!activeRound || !match) {
      return [];
    }
    const submitted = new Set(activeRound.submittedPlayerIds);
    return match.standings
      .filter((entry) => !submitted.has(entry.userId))
      .map((entry) => ({
        displayName: entry.userId === authUser?.id ? "You" : entry.displayName,
        disconnected: presenceByUserId.get(entry.userId)?.connectionState === "disconnected",
      }));
  }, [activeRound, authUser?.id, match, presenceByUserId]);

  return (
    <div className="min-h-screen app-shared-bg">
      <TopStatsBar backHref="/home" pageTitle="Arena Match" />
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-8 xl:grid-cols-[1.15fr_0.85fr]">
        <DeepGlassCard className="px-6 py-6 md:px-8 md:py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-teal">Match</p>
              <h1 className="mt-2 font-heading text-4xl font-extrabold text-brand-gray-700">
                {match?.publicCourseTitle ?? "Loading Arena match..."}
              </h1>
            </div>
              <div className="flex gap-3">
                <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-3 text-sm text-brand-gray-600">
                  Round {(match?.currentRoundIndex ?? 0) + 1} / {match?.totalRounds ?? 0}
                </div>
                <div className={`rounded-2xl border border-white/70 bg-white/68 px-4 py-3 text-sm font-bold transition-colors ${
                  activeRound && remainingSeconds <= 5 ? "text-rose-600 animate-pulse" : "text-brand-gray-700"
                }`}>
                  {activeRound ? `${remainingSeconds}s` : match?.status === "finished" ? "Finished" : "Waiting"}
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            {activeRound ? (
              <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-brand-gray-100/50">
                <div 
                  className={`h-full transition-all duration-300 ease-linear ${
                    remainingSeconds <= 5 ? "bg-rose-500" : "bg-brand-teal"
                  }`}
                  style={{ width: `${Math.min(100, (remainingSeconds / (activeRound.timerSeconds || 30)) * 100)}%` }}
                />
              </div>
            ) : null}

          {connectionStatus !== "connected" || isRecovering ? (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-900">
              {connectionStatus === "reconnecting" || isRecovering
                ? "Connection interrupted. Re-syncing the match state now..."
                : "Connecting to the live Arena event stream..."}
            </div>
          ) : null}

          {latestReveal ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800">
              {(latestRevealAnswer ?? "Answer")} was just revealed for the previous round.
            </div>
          ) : null}

          {submitNotice ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800">
              {submitNotice}
            </div>
          ) : null}

          {activeRound ? (
            <div className="mt-5 rounded-2xl border border-white/70 bg-white/68 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-brand-gray-700">
                  {submittedCount} / {totalPlayers} players locked in
                </p>
                <p className="text-xs uppercase tracking-[0.16em] text-brand-teal">
                  {pendingPlayers.length === 0 ? "All answers received" : "Waiting on players"}
                </p>
              </div>
              {pendingPlayers.length > 0 ? (
                <p className="mt-2 text-xs text-brand-gray-500">
                  Pending:{" "}
                  {pendingPlayers
                    .map((player) =>
                      player.disconnected ? `${player.displayName} (reconnecting)` : player.displayName
                    )
                    .join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {activeRound ? (
            <div className="mt-6">
              <div className="rounded-[28px] border border-white/70 bg-white/74 p-6 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-teal text-white">
                      {activeRound.question.questionType === "MultipleChoice" && <FiList />}
                      {activeRound.question.questionType === "MatchingPairs" && <FiHash />}
                      {activeRound.question.questionType === "Ordering" && <FiLayers />}
                      {activeRound.question.questionType === "FeynmanMirror" && <FiMessageSquare />}
                      {activeRound.question.questionType === "ExplainerMedia" && <FiBookOpen />}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-teal">
                        {activeRound.question.questionType || "Live Question"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-brand-teal/10 px-3 py-1 text-[10px] font-bold text-brand-teal">
                    <FiZap className="h-3 w-3" />
                    +50 Max Points
                  </div>
                </div>

                <h2 className="font-heading text-2xl font-bold leading-tight text-brand-gray-700">
                  {activeRound.question.prompt}
                </h2>

                {/* ---- QUESTION RENDERERS ---- */}

                {activeRound.question.questionType === "MultipleChoice" ? (
                  <div className="mt-4">
                    <MultipleChoiceQuestion
                      hideChrome
                      stageIndex={(match?.currentRoundIndex ?? 0)}
                      totalStages={match?.totalRounds ?? 0}
                      topic={activeRound.question.prompt}
                      difficulty={mapDifficulty(activeRound.question.difficulty)}
                      question={activeRound.question.prompt}
                      options={activeRound.question.options}
                      correctId="" // Hide correct answer in live match
                      feedbackMsg={{ success: "", error: "", hint: "" }}
                      onSelect={(id: string) => setSelectedOptionId(id)}
                      onComplete={(id: string) => setSelectedOptionId(id)}
                      onHintUse={async () => true}
                    />
                  </div>
                ) : activeRound.question.questionType === "MatchingPairs" ? (
                   <div className="mt-6">
                    <MatchingPairsQuestion
                      hideChrome
                      stageIndex={(match?.currentRoundIndex ?? 0)}
                      totalStages={match?.totalRounds ?? 0}
                      topic={activeRound.question.prompt}
                      difficulty={mapDifficulty(activeRound.question.difficulty)}
                      question={activeRound.question.prompt}
                      pairs={(activeRound.question.options || []).map((o: any, i: number) => ({
                        id: String(i),
                        left: o.left || "Side A",
                        right: o.right || "Side B"
                      }))}
                      shuffledRightIds={shuffledRightIds}
                      matched={matched}
                      matchedPairs={matchedPairs}
                      selectedLeftId={selectedLeftId}
                      selectedRightId={selectedRightId}
                      wrongPair={null}
                      hintPairId={null}
                      hintUsed={false}
                      allMatched={allMatched}
                      feedback={null}
                      onPickLeft={pickLeft}
                      onPickRight={pickRight}
                      onHint={() => void handleMatchingHint()}
                      onSubmit={() => {}} // Submission handled by Arena's button
                      onSkip={() => {}}
                    />
                  </div>
                ) : activeRound.question.questionType === "Ordering" ? (
                  <div className="mt-6">
                    <OrderingQuestion
                      hideChrome
                      stageIndex={(match?.currentRoundIndex ?? 0)}
                      totalStages={match?.totalRounds ?? 0}
                      topic={activeRound.question.prompt}
                      difficulty={mapDifficulty(activeRound.question.difficulty)}
                      stage={{
                        stageId: activeRound.roundId.toString(),
                        topic: activeRound.question.prompt,
                        component: "Ordering",
                        config: {
                          data: { steps: activeRound.question.options },
                          initialState: {}
                        },
                        feedback: { success: "", error: "" }
                      } as any}
                      onSubmit={async (items) => handleOrderingSubmit(items)}
                      onChange={(items) => handleOrderingSubmit(items)}
                      onContinue={() => {}}
                      onSkip={() => {}}
                    />
                  </div>
                ) : activeRound.question.questionType === "FeynmanMirror" ? (
                  <div className="mt-6">
                    <FeynmanQuestion
                      hideChrome
                      stageIndex={(match?.currentRoundIndex ?? 0)}
                      totalStages={match?.totalRounds ?? 0}
                      topic={activeRound.question.prompt}
                      difficulty={mapDifficulty(activeRound.question.difficulty)}
                      prompt={activeRound.question.prompt}
                      sampleAnswer="" // Hide in live match
                      feedbackMsg={{ success: "", error: "", hint: "Keep it simple." }}
                      onSubmit={async (answer) => {
                        setSelectedOptionId(answer);
                        return { result: "correct", feedback: "Captured explanation." };
                      }}
                      onChange={(answer) => setSelectedOptionId(answer)}
                      onContinue={() => {}}
                      onHintUse={async () => true}
                    />
                  </div>
                ) : activeRound.question.questionType === "ExplainerMedia" ? (
                  <div className="mt-6">
                    <ExplainerMediaCard
                      hideChrome
                      stageIndex={(match?.currentRoundIndex ?? 0)}
                      totalStages={match?.totalRounds ?? 0}
                      topic={activeRound.question.prompt}
                      difficulty={mapDifficulty(activeRound.question.difficulty)}
                      title={activeRound.question.prompt}
                      explanation={(activeRound.question as any).explanation || "Read this carefully."}
                      bullets={activeRound.question.options?.map((o: any) => o.text || o) || []}
                      onContinue={() => setSelectedOptionId("acknowledged")}
                      onMount={() => setSelectedOptionId("acknowledged")}
                    />
                  </div>
                ) : (
                  <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center shadow-inner">
                    <FiZap className="mx-auto h-8 w-8 text-rose-400 opacity-60 mb-3" />
                    <h3 className="font-heading font-bold text-rose-800 text-lg">Unsupported App Version</h3>
                    <p className="mt-2 text-sm font-medium text-rose-600">
                      The pool has provided a {"'"}{activeRound.question.questionType}{"'"} component but this Arena Client does not support it. 
                      Please update the client or remove this question from your Arena Pool.
                    </p>
                  </div>
                )}

                <GameButton 
                  className="mt-6 w-full py-4 text-lg" 
                  onClick={() => void handleSubmit()} 
                  disabled={!selectedOptionId || submitting || activeRound.hasSubmitted}
                >
                  {activeRound.hasSubmitted ? "Answer Locked" : "Submit Challenge"}
                </GameButton>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[28px] border border-white/70 bg-white/74 p-6 text-sm text-brand-gray-500">
              This match has no active round right now.
              {match?.status === "finished" ? " The result page is ready." : " Waiting for the next round to start."}
              {match?.status === "finished" ? (
                <div className="mt-4">
                  <GameButton onClick={() => router.push(`/arena/result/${match.matchId}`)}>
                    View Result
                  </GameButton>
                </div>
              ) : null}
            </div>
          )}
        </DeepGlassCard>

        <div className="flex flex-col gap-6">
          <DeepGlassCard className="px-6 py-6">
            <h2 className="font-heading text-2xl font-bold text-brand-gray-700">Standings</h2>
            <div className="mt-5 space-y-3">
              {match?.standings.map((entry) => (
                <div key={entry.userId} className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/68 px-4 py-3">
                  <div>
                    <p className="font-heading text-lg font-bold text-brand-gray-700">
                      #{entry.rank} {entry.displayName}
                    </p>
                    <p className="text-xs text-brand-gray-500">
                      {entry.correctCount} correct / {entry.answeredCount} answered
                    </p>
                    {presenceByUserId.get(entry.userId)?.connectionState === "disconnected" ? (
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-500">
                        Reconnecting
                      </p>
                    ) : null}
                  </div>
                  <p className="font-heading text-2xl font-bold text-brand-gray-700">{entry.score}</p>
                </div>
              ))}
            </div>
          </DeepGlassCard>

          <DeepGlassCard className="px-6 py-6">
            <h2 className="font-heading text-2xl font-bold text-brand-gray-700">Match Feed</h2>
            <div className="mt-5 space-y-3">
              {events.length === 0 ? (
                <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-4 text-sm text-brand-gray-500">
                  Waiting for match events...
                </div>
              ) : (
                events
                  .slice()
                  .reverse()
                  .map((event) => (
                    <div key={event.eventId} className="rounded-2xl border border-white/70 bg-white/68 px-4 py-3">
                      <p className="font-semibold text-brand-gray-700">{getArenaEventLabel(event)}</p>
                      <p className="mt-1 text-xs text-brand-gray-500">{new Date(event.createdAt).toLocaleTimeString()}</p>
                    </div>
                  ))
              )}
            </div>
          </DeepGlassCard>
        </div>
      </main>
    </div>
  );
}
