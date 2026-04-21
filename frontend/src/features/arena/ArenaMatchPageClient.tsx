"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
import MultipleChoiceQuestion from "@/components/lesson-session/MultipleChoiceQuestion";
import MatchingPairsQuestion from "@/components/lesson-session/MatchingPairsQuestion";
import OrderingQuestion from "@/components/lesson-session/OrderingQuestion";
import FeynmanQuestion from "@/components/lesson-session/FeynmanQuestion";
import ExplainerMediaCard from "@/components/lesson-session/ExplainerMediaCard";
import { useMatchingPairsStage } from "@/features/lesson-session/hooks/useMatchingPairsStage";

// ─── Seeded shuffle ────────────────────────────────────────────────────────────
// Uses a simple deterministic PRNG based on the roundId so both players
// always see the same item order for Ordering questions.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatMatchingPairs(options: any[]) {
  return options.map((o, i) => {
    // Standard keys or common synonyms
    const left = o.left || o.term || o.text || o.label || "Side A";
    const right = o.right || o.definition || o.match || o.answer || "Side B";
    return {
      id: String(o.id || i),
      left: String(left),
      right: String(right),
    };
  });
}

export default function ArenaMatchPageClient({ matchId }: { matchId: number }) {
  const router = useRouter();
  const { isReady } = useRequireAuthRedirect();
  const authUser = useAuthStore((state) => state.user);
  const { match, refetch: refetchSync } = useArenaMatchEvents(isReady ? matchId : null);
  const reset = useArenaMatchStore((state) => state.reset);
  const events = useArenaMatchStore((state) => state.events);
  const connectionStatus = useArenaMatchStore((state) => state.connectionStatus);
  const isRecovering = useArenaMatchStore((state) => state.isRecovering);
  const selectedOptionId = useArenaMatchStore((state) => state.selectedOptionId);
  const setSelectedOptionId = useArenaMatchStore((state) => state.setSelectedOptionId);
  const submitting = useArenaMatchStore((state) => state.submitting);
  const setSubmitting = useArenaMatchStore((state) => state.setSubmitting);

  // ─── Timer for the current round ──────────────────────────────────────────
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);

  // ─── Intermission state ────────────────────────────────────────────────────
  const [intermissionUntil, setIntermissionUntil] = useState<number | null>(null);
  const [intermissionSeconds, setIntermissionSeconds] = useState(0);
  const isInIntermission = !!intermissionUntil && intermissionSeconds > 0;

  // No more prevRoundRef — we use latestReveal payload
  const userAnswersRef = useRef<Map<number, string>>(new Map());

  // ─── Revealed answer tracking ─────────────────────────────────────────────
  const latestReveal = useMemo(() => {
    return [...events].reverse().find((event) => event.eventType === "round.revealed") ?? null;
  }, [events]);

  const revealedAnswer = useMemo(() => {
    const payload = latestReveal?.payload;
    if (!payload || typeof payload !== "object") return null;
    return (payload as Record<string, unknown>).revealedAnswer as Record<string, unknown> | null ?? null;
  }, [latestReveal]);

  const revealedQuestion = useMemo(() => {
    if (!revealedAnswer) return null;
    return {
      questionType: (revealedAnswer.questionType as string) || "Unknown", // Handle missing type
      prompt: (revealedAnswer.prompt as string) || "",
      options: (revealedAnswer.options as any[]) || [],
      correctOptionId: (revealedAnswer.correctOptionId as string) || "",
      explanation: (revealedAnswer.explanation as string) || "",
      difficulty: "normal",
    };
  }, [revealedAnswer]);

  const revealedCorrectId = useMemo(() => {
    return (revealedAnswer?.correctOptionId as string | undefined) ?? undefined;
  }, [revealedAnswer]);

  const revealedExplanation = useMemo(() => {
    return (revealedAnswer?.explanation as string | undefined) ?? undefined;
  }, [revealedAnswer]);

  // ─── Interactive Question State ───────────────────────────────────────────
  const mapDifficulty = (d?: string | null): "low" | "medium" | "high" | null => {
    if (!d) return "low";
    const lower = d.toLowerCase();
    if (lower === "hard" || lower === "high") return "high";
    if (lower === "medium" || lower === "intermediate") return "medium";
    return "low";
  };

  const activeRound = match?.activeRound ?? null;
  const question = activeRound?.question;

  // ─── Matching Pairs Hook ──────────────────────────────────────────────────
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
    pairs: (question?.questionType === "MatchingPairs" ? formatMatchingPairs(question?.options || []) : []),
    enabled: question?.questionType === "MatchingPairs" && !activeRound?.hasSubmitted,
    onCorrectStageComplete: (results) => {
      setSelectedOptionId(JSON.stringify(results));
    },
    onHintUse: async () => true,
  });

  // ─── Ordering State (stable per roundId) ─────────────────────────────────
  // We keep a per-round shuffle in a ref to prevent re-shuffling on re-renders.
  const orderingShuffleRef = useRef<Map<number, string[]>>(new Map());

  const stableOrderedItems = useMemo(() => {
    if (question?.questionType !== "Ordering" || !activeRound) return [];
    const roundId = activeRound.roundId;
    if (orderingShuffleRef.current.has(roundId)) {
      return orderingShuffleRef.current.get(roundId)!;
    }
    const rawSteps = question.options || [];
    const labels = rawSteps.map((s: any) =>
      typeof s === "string" ? s : (s.text || s.content || s.id || "Step")
    );
    const shuffled = seededShuffle(labels, roundId);
    orderingShuffleRef.current.set(roundId, shuffled);
    return shuffled;
  }, [question?.questionType, activeRound?.roundId, question?.options]);

  // ─── Detect intermission from activeRound.startedAt ───────────────────────
  // When startedAt is in the future, we are in the intermission phase.
  // We also capture the revealed round's question from the latest round.revealed event.
  const activeRoundRef = useRef<typeof activeRound>(null);

  useEffect(() => {
    if (!activeRound?.startedAt) {
      setIntermissionUntil(null);
      return;
    }
    const startsAt = new Date(activeRound.startedAt).getTime();
    const now = Date.now();
    if (startsAt > now + 500) {
      // We're in intermission — show reveal until startsAt
      setIntermissionUntil(startsAt);
    } else {
      // We're live in the question window
      setIntermissionUntil(null);
    }
    activeRoundRef.current = activeRound;
  }, [activeRound?.roundId, activeRound?.startedAt]);

  // ─── Intermission countdown timer ────────────────────────────────────────
  useEffect(() => {
    if (!intermissionUntil) {
      setIntermissionSeconds(0);
      return;
    }
    const tick = () => {
      const diff = Math.max(0, intermissionUntil - Date.now());
      setIntermissionSeconds(Math.ceil(diff / 1000));
      if (diff <= 0) setIntermissionUntil(null);
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [intermissionUntil]);

  // ─── Round countdown timer ────────────────────────────────────────────────
  // We measure time remaining in the *question window* — from startedAt to
  // deadlineAt. During intermission startedAt is in the future so we show 0
  // and the intermission countdown takes over.
  useEffect(() => {
    if (!match?.activeRound?.deadlineAt) {
      setRemainingSeconds(0);
      return;
    }
    const tick = () => {
      const deadlineAt = match.activeRound?.deadlineAt ?? "";
      const startedAt = match.activeRound?.startedAt ?? "";
      const deadline = new Date(deadlineAt).getTime();
      const startMs = startedAt ? new Date(startedAt).getTime() : 0;
      const now = Date.now();
      // Count down only within the question window [startedAt, deadlineAt]
      const effective = Math.max(now, startMs);
      const diff = Math.max(0, deadline - effective);
      setRemainingSeconds(Math.ceil(diff / 1000));
    };
    tick();
    const intervalId = window.setInterval(tick, 200);
    return () => window.clearInterval(intervalId);
  }, [match?.activeRound?.deadlineAt, match?.activeRound?.startedAt]);

  // ─── Proactive re-sync when timer reaches zero ────────────────────────────
  // This triggers a manual state sync when the local timer hits 0,
  // prompting the backend to settle the round if it hasn't already.
  useEffect(() => {
    const isLiveQuestion = activeRound?.status === "active" && !isInIntermission;
    const isIntermissionReveal = isInIntermission;

    if (isLiveQuestion && remainingSeconds === 0) {
      console.log("[Arena] Question timer reached 0, triggering refetch...");
      refetchSync();
    } else if (isIntermissionReveal && intermissionSeconds === 0) {
      console.log("[Arena] Intermission timer reached 0, triggering refetch...");
      refetchSync();
    }
  }, [remainingSeconds, intermissionSeconds, isInIntermission, activeRound?.status]);

  // ─── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (activeRound?.question?.questionType === "MatchingPairs" && allMatched) {
      setSelectedOptionId(JSON.stringify(matchedPairs));
    } else if (activeRound?.question?.questionType === "MatchingPairs" && !allMatched) {
      setSelectedOptionId(null);
    }
  }, [allMatched, matchedPairs, activeRound?.question?.questionType, setSelectedOptionId]);

  // Reset selection when round changes
  useEffect(() => {
    if (activeRound?.roundId) {
      setSelectedOptionId(null);
    }
  }, [activeRound?.roundId, setSelectedOptionId]);

  // Pre-populate ordering answer with stable shuffle
  useEffect(() => {
    if (question?.questionType === "Ordering" && activeRound && !activeRound.hasSubmitted && stableOrderedItems.length > 0) {
      setSelectedOptionId(JSON.stringify(stableOrderedItems));
    }
  }, [question?.questionType, activeRound?.roundId, stableOrderedItems]);

  const handleForcedSubmit = async () => {
    if (!selectedOptionId || !activeRound) return;
    userAnswersRef.current.set(activeRound.roundIndex, selectedOptionId);
    handleSubmit();
  };

  useEffect(() => {
    if (match?.status === "finished" && match.matchId === matchId) {
      router.replace(`/arena/result/${match.matchId}`);
    }
  }, [match?.matchId, match?.status, matchId, router]);

  // ─── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!match?.activeRound) return;
    if (intermissionUntil) return; // Can't submit during intermission

    let finalValue = selectedOptionId;
    if (question?.questionType === "MatchingPairs" && !finalValue && allMatched) {
      finalValue = JSON.stringify(matchedPairs);
    }
    if (!finalValue) return;

    setSubmitting(true);
    setSubmitNotice(null);
    userAnswersRef.current.set(match.activeRound.roundIndex, finalValue);

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
      useArenaMatchStore.getState().patchMatch({
        activeRound: match?.activeRound ? { ...match.activeRound, hasSubmitted: false } : null
      });
      console.error("Submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Derived UI state ─────────────────────────────────────────────────────
  const presenceByUserId = useMemo(
    () => new Map((match?.presenceStates ?? []).map((entry) => [entry.userId, entry])),
    [match?.presenceStates]
  );
  const submittedCount = activeRound?.submittedPlayerIds.length ?? 0;
  const totalPlayers = match?.standings.length ?? 0;
  const pendingPlayers = useMemo(() => {
    if (!activeRound || !match) return [];
    const submitted = new Set(activeRound.submittedPlayerIds);
    return match.standings
      .filter((entry) => !submitted.has(entry.userId))
      .map((entry) => ({
        displayName: entry.userId === authUser?.id ? "You" : entry.displayName,
        disconnected: presenceByUserId.get(entry.userId)?.connectionState === "disconnected",
      }));
  }, [activeRound, authUser?.id, match, presenceByUserId]);

  const timerBase = activeRound?.timerSeconds || 15;
  // During intermission the progress bar should be full (time starting from 0)
  // Once intermission ends, show remaining round time
  const displaySeconds = isInIntermission ? 0 : remainingSeconds;

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
                isInIntermission
                  ? "text-amber-600 animate-pulse"
                  : activeRound && remainingSeconds <= 5
                  ? "text-rose-600 animate-pulse"
                  : "text-brand-gray-700"
              }`}>
                {isInIntermission
                  ? `Next in ${intermissionSeconds}s`
                  : activeRound
                  ? `${remainingSeconds}s`
                  : match?.status === "finished"
                  ? "Finished"
                  : "Waiting"}
              </div>
            </div>
          </div>

          {/* Visual Progress Bar */}
          {activeRound ? (
            <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-brand-gray-100/50">
              {isInIntermission ? (
                // During intermission: amber fill counting DOWN from full
                <div
                  className="h-full bg-amber-400 transition-all duration-200 ease-linear"
                  style={{ width: `${Math.min(100, (intermissionSeconds / 5) * 100)}%` }}
                />
              ) : (
                <div
                  className={`h-full transition-all duration-300 ease-linear ${
                    remainingSeconds <= 5 ? "bg-rose-500" : "bg-brand-teal"
                  }`}
                  style={{ width: `${Math.min(100, (remainingSeconds / timerBase) * 100)}%` }}
                />
              )}
            </div>
          ) : null}

          {connectionStatus !== "connected" || isRecovering ? (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-900">
              {connectionStatus === "reconnecting" || isRecovering
                ? "Connection interrupted. Re-syncing the match state now..."
                : "Connecting to the live Arena event stream..."}
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

          {/* ── QUESTION AREA ──────────────────────────────────────────── */}
          {(activeRound || isInIntermission) ? (
            <div className="mt-6">
              <div className="rounded-[28px] border border-white/70 bg-white/74 p-6 shadow-xl backdrop-blur-xl">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-teal text-white">
                      {(isInIntermission ? revealedQuestion?.questionType : activeRound?.question?.questionType) === "MultipleChoice" && <FiList />}
                      {(isInIntermission ? revealedQuestion?.questionType : activeRound?.question?.questionType) === "MatchingPairs" && <FiHash />}
                      {(isInIntermission ? revealedQuestion?.questionType : activeRound?.question?.questionType) === "Ordering" && <FiLayers />}
                      {(isInIntermission ? revealedQuestion?.questionType : activeRound?.question?.questionType) === "FeynmanMirror" && <FiMessageSquare />}
                      {(isInIntermission ? revealedQuestion?.questionType : activeRound?.question?.questionType) === "ExplainerMedia" && <FiBookOpen />}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-teal">
                        {isInIntermission ? "Round Reveal" : (activeRound?.question?.questionType || "Live Question")}
                      </p>
                    </div>
                  </div>
                  {isInIntermission ? (
                    <div className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-600 animate-pulse">
                      <FiClock className="h-3 w-3" />
                      Next Round in {intermissionSeconds}s
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-full bg-brand-teal/10 px-3 py-1 text-[10px] font-bold text-brand-teal">
                      <FiZap className="h-3 w-3" />
                      {remainingSeconds < 5 ? (
                        <span className="text-red-500">Hurry! {remainingSeconds}s</span>
                      ) : (
                        "+50 Max Points"
                      )}
                    </div>
                  )}
                </div>

                <h2 className="font-heading text-2xl font-bold leading-tight text-brand-gray-700">
                  {isInIntermission ? revealedQuestion?.prompt : activeRound?.question?.prompt}
                </h2>

                {/* Optional Explanation for Intermission */}
                {isInIntermission && revealedExplanation && (
                  <div className="mt-3 rounded-2xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-teal mb-1">Explanation</p>
                    <p className="text-sm text-brand-gray-600 leading-relaxed">
                      {revealedExplanation}
                    </p>
                  </div>
                )}

                {/* ---- QUESTION RENDERERS ---- */}
                {(() => {
                  // Prioritize revealed question during intermission, fallback to active question ONLY if revealed is not yet available
                  const q = isInIntermission ? (revealedQuestion || activeRound?.question) : activeRound?.question;
                  if (!q || !q.questionType) return null;

                  if (q.questionType === "MultipleChoice") {
                    const rIdx = (latestReveal?.payload as any)?.roundIndex;
                    const componentKey = isInIntermission ? `reveal-${rIdx}` : `live-${activeRound?.roundId}`;
                    return (
                      <div className="mt-4" key={componentKey}>
                        <MultipleChoiceQuestion
                          hideChrome
                          stageIndex={isInIntermission ? (rIdx ?? 0) : (match?.currentRoundIndex ?? 0)}
                          totalStages={match?.totalRounds ?? 0}
                          topic={q.prompt}
                          difficulty={mapDifficulty(q.difficulty)}
                          question={q.prompt}
                          options={q.options}
                          correctId="" 
                          forceCorrectId={isInIntermission ? revealedCorrectId : undefined}
                          userSelectedId={isInIntermission ? (userAnswersRef.current.get(rIdx) || undefined) : undefined}
                          feedbackMsg={{ success: "", error: "", hint: "" }}
                          onSelect={(id: string) => !isInIntermission && setSelectedOptionId(id)}
                          onComplete={(id: string) => !isInIntermission && setSelectedOptionId(id)}
                          onHintUse={async () => true}
                        />
                      </div>
                    );
                  }

                  if (q.questionType === "MatchingPairs") {
                    const rIdx = (latestReveal?.payload as any)?.roundIndex;
                    const componentKey = isInIntermission ? `reveal-${rIdx}` : `live-${activeRound?.roundId}`;
                    return (
                      <div className="mt-6" key={componentKey}>
                        <MatchingPairsQuestion
                          hideChrome
                          stageIndex={isInIntermission ? (rIdx ?? 0) : (match?.currentRoundIndex ?? 0)}
                          totalStages={match?.totalRounds ?? 0}
                          topic={q.prompt}
                          difficulty={mapDifficulty(q.difficulty)}
                          question={q.prompt}
                          pairs={formatMatchingPairs(q.options || [])}
                          shuffledRightIds={isInIntermission ? formatMatchingPairs(q.options || []).map(p => p.id) : shuffledRightIds}
                          matched={isInIntermission ? formatMatchingPairs(q.options || []).map(p => p.id) : matched}
                          matchedPairs={isInIntermission ? Object.fromEntries(formatMatchingPairs(q.options || []).map(p => [p.id, p.id])) : matchedPairs}
                          selectedLeftId={isInIntermission ? null : selectedLeftId}
                          selectedRightId={isInIntermission ? null : selectedRightId}
                          wrongPair={null}
                          hintPairId={null}
                          hintUsed={false}
                          allMatched={isInIntermission ? true : allMatched}
                          feedback={null}
                          isRevealed={isInIntermission}
                          onPickLeft={isInIntermission ? () => {} : pickLeft}
                          onPickRight={isInIntermission ? () => {} : pickRight}
                          onHint={isInIntermission ? () => {} : () => void handleMatchingHint()}
                          onSubmit={() => {}}
                          onSkip={() => {}}
                        />
                      </div>
                    );
                  }

                  if (q.questionType === "Ordering") {
                    const rIdx = (latestReveal?.payload as any)?.roundIndex;
                    const componentKey = isInIntermission ? `reveal-${rIdx}` : `live-${activeRound?.roundId}`;
                    return (
                      <div className="mt-6" key={componentKey}>
                        <OrderingQuestion
                          hideChrome
                          stageIndex={isInIntermission ? (rIdx ?? 0) : (match?.currentRoundIndex ?? 0)}
                          totalStages={match?.totalRounds ?? 0}
                          topic={q.prompt}
                          difficulty={mapDifficulty(q.difficulty)}
                          isRevealed={isInIntermission}
                          stage={{
                            stageId: (isInIntermission ? rIdx.toString() : activeRound?.roundId.toString()) || "0",
                            topic: q.prompt,
                            component: "Ordering",
                            config: {
                              data: { steps: q.options || [] },
                              initialState: { order: stableOrderedItems },
                            },
                            feedback: { success: "", error: "" }
                          } as any}
                          onSubmit={async (items: string[]) => {
                            if (!isInIntermission) setSelectedOptionId(JSON.stringify(items));
                          }}
                          onChange={(items: string[]) => !isInIntermission && setSelectedOptionId(JSON.stringify(items))}
                          onContinue={() => {}}
                          onSkip={() => {}}
                        />
                      </div>
                    );
                  }

                  if (q.questionType === "FeynmanMirror") {
                    const rIdx = (latestReveal?.payload as any)?.roundIndex;
                    const componentKey = isInIntermission ? `reveal-${rIdx}` : `live-${activeRound?.roundId}`;
                    return (
                      <div className="mt-6" key={componentKey}>
                        <FeynmanQuestion
                          hideChrome
                          stageIndex={isInIntermission ? (rIdx ?? 0) : (match?.currentRoundIndex ?? 0)}
                          totalStages={match?.totalRounds ?? 0}
                          topic={q.prompt}
                          difficulty={mapDifficulty(q.difficulty)}
                          prompt={q.prompt}
                          sampleAnswer={isInIntermission ? revealedCorrectId || "" : ""}
                          feedbackMsg={{ success: "", error: "", hint: "Keep it simple." }}
                          isRevealed={isInIntermission}
                          onSubmit={async (answer: string) => {
                            if (!isInIntermission) {
                              setSelectedOptionId(answer);
                              return { result: "correct", feedback: "Captured explanation." };
                            }
                            return { result: "correct", feedback: "" };
                          }}
                          onChange={(answer: string) => !isInIntermission && setSelectedOptionId(answer)}
                          onContinue={() => {}}
                          onHintUse={async () => true}
                        />
                      </div>
                    );
                  }

                  if (q.questionType === "ExplainerMedia") {
                    const rIdx = (latestReveal?.payload as any)?.roundIndex;
                    const componentKey = isInIntermission ? `reveal-${rIdx}` : `live-${activeRound?.roundId}`;
                    return (
                      <div className="mt-6" key={componentKey}>
                        <ExplainerMediaCard
                          hideChrome
                          stageIndex={isInIntermission ? (rIdx ?? 0) : (match?.currentRoundIndex ?? 0)}
                          totalStages={match?.totalRounds ?? 0}
                          topic={q.prompt}
                          difficulty={mapDifficulty(q.difficulty)}
                          title={q.prompt}
                          explanation={(q as any).explanation || "Read this carefully."}
                          bullets={q.options?.map((o: any) => o.text || o) || []}
                          onContinue={() => !isInIntermission && setSelectedOptionId("acknowledged")}
                          onMount={() => !isInIntermission && setSelectedOptionId("acknowledged")}
                        />
                      </div>
                    );
                  }

                  return (
                    <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center shadow-inner">
                      <FiZap className="mx-auto h-8 w-8 text-rose-400 opacity-60 mb-3" />
                      <h3 className="font-heading font-bold text-rose-800 text-lg">Unsupported App Version</h3>
                      <p className="mt-2 text-sm font-medium text-rose-600">
                        The pool has provided a {"'"}{q.questionType}{"'"} component but this Arena Client does not support it.
                      </p>
                    </div>
                  );
                })()}

                <GameButton
                  className="mt-6 w-full py-4 text-lg"
                  onClick={() => void handleSubmit()}
                  disabled={!selectedOptionId || submitting || (activeRound?.hasSubmitted ?? false) || isInIntermission}
                >
                  {isInIntermission 
                    ? `Next Round in ${intermissionSeconds}s` 
                    : (activeRound?.hasSubmitted ? "Answer Locked ✓" : "Submit Challenge")}
                </GameButton>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[28px] border border-white/70 bg-white/74 p-6 text-sm text-brand-gray-500">
              This match has no active round right now.
              {match?.status === "finished" ? " The result page is ready." : " Waiting for the next round to start."}
              {match?.status === "finished" && (
                <div className="mt-4">
                  <GameButton onClick={() => router.push(`/arena/result/${match.matchId}`)}>
                    View Result
                  </GameButton>
                </div>
              )}
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
