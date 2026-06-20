"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import { arenaWsClient } from "@/lib/arena/realtimeClient";
import { ArenaAnswerSubmitResponse, ArenaMatchState } from "@/lib/apiTypes";
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

function buildRevealedQuestion(revealedAnswer: Record<string, unknown> | null) {
  if (!revealedAnswer) return null;
  return {
    questionType: (revealedAnswer.questionType as string) || "Unknown",
    prompt: (revealedAnswer.prompt as string) || "",
    options: (revealedAnswer.options as any[]) || [],
    correctOptionId: (revealedAnswer.correctOptionId as string) || "",
    explanation: (revealedAnswer.explanation as string) || "",
    difficulty: "normal",
  };
}

const ROUND_MAX_SCORE = 1000;
const ROUND_SWITCH_DELAY_MS = 2500;

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
  const [isRoundSwitchDelay, setIsRoundSwitchDelay] = useState(false);
  const [submissionReview, setSubmissionReview] = useState<{
    roundId: number;
    isCorrect: boolean;
    scoreAwarded: number;
    selectedOptionId: string | null;
    revealedAnswer: Record<string, unknown> | null;
  } | null>(null);

  // ─── Intermission state ────────────────────────────────────────────────────
  const [intermissionUntil, setIntermissionUntil] = useState<number | null>(null);
  const [intermissionSeconds, setIntermissionSeconds] = useState(0);
  const isInIntermission = !!intermissionUntil && intermissionSeconds > 0;
  const [showFinalSummary, setShowFinalSummary] = useState(false);
  const [showFinalSpinner, setShowFinalSpinner] = useState(false);
  const [finalSummarySeconds, setFinalSummarySeconds] = useState(0);

  // No more prevRoundRef — we use latestReveal payload
  const userAnswersRef = useRef<Map<number, string>>(new Map());
  const readyRoundRef = useRef<number | null>(null);
  const prevRoundIdRef = useRef<number | null>(null);
  const latestActiveRoundRef = useRef<ArenaMatchState["activeRound"] | null>(null);
  const roundSwitchTimeoutRef = useRef<number | null>(null);
  const finalSpinnerTimeoutRef = useRef<number | null>(null);
  const finalSummaryTimeoutRef = useRef<number | null>(null);
  const questionAreaRef = useRef<HTMLDivElement | null>(null);
  const [cachedQuestionAreaHeight, setCachedQuestionAreaHeight] = useState<number | null>(null);
  const [displayRound, setDisplayRound] = useState<ArenaMatchState["activeRound"] | null>(null);

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
    return buildRevealedQuestion(revealedAnswer);
  }, [revealedAnswer]);

  const revealedRoundIndex = useMemo(() => {
    const payload = latestReveal?.payload as Record<string, unknown> | undefined;
    const value = payload?.roundIndex;
    return typeof value === "number" ? value : null;
  }, [latestReveal]);

  const revealedRoundId = useMemo(() => {
    const payload = latestReveal?.payload as Record<string, unknown> | undefined;
    const value = payload?.roundId;
    return typeof value === "number" ? value : null;
  }, [latestReveal]);

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
  latestActiveRoundRef.current = activeRound;
  const question = displayRound?.question;
  const displayRoundStartsInFuture = Boolean(
    displayRound?.startedAt && new Date(displayRound.startedAt).getTime() > Date.now()
  );
  const isQuestionLoading = displayRound?.status === "pending" && !displayRoundStartsInFuture && match?.status !== "finished";

  const localRevealAnswer = submissionReview?.roundId === displayRound?.roundId
    ? submissionReview?.revealedAnswer ?? null
    : null;

  const localRevealQuestion = useMemo(() => buildRevealedQuestion(localRevealAnswer), [localRevealAnswer]);

  const isRevealTime = isInIntermission || displayRound?.status === "closed" || match?.status === "finished";

  // The player who already submitted gets to see the reveal immediately —
  // their submissionReview already carries the correct answer + explanation
  // from the backend, so no need to gate on intermission/round-closed.
  const isSelfRevealVisible = !!localRevealQuestion && !!displayRound && !isQuestionLoading;

  const isServerRevealVisible = Boolean(
    isRevealTime &&
    revealedQuestion &&
    displayRound &&
    revealedRoundIndex !== null &&
    (
      revealedRoundIndex === displayRound.roundIndex ||
      (displayRound.status === "pending" && displayRound.roundIndex === revealedRoundIndex + 1)
    )
  );
  // At match end there is no "next round" to open an intermission reveal window,
  // so the final round's correct answer would otherwise never be shown before the
  // summary. Surface the last round's revealed answer (from the round.revealed event,
  // falling back to the fetched round state) once the match is finished.
  const finalRevealAnswer = useMemo(() => {
    if (match?.status !== "finished") return null;
    return revealedAnswer ?? match?.activeRound?.revealedAnswer ?? displayRound?.revealedAnswer ?? null;
  }, [match?.status, revealedAnswer, match?.activeRound?.revealedAnswer, displayRound?.revealedAnswer]);
  const finalRevealQuestion = useMemo(() => buildRevealedQuestion(finalRevealAnswer), [finalRevealAnswer]);
  const isFinalReveal = match?.status === "finished" && !!finalRevealQuestion;

  const displayRevealQuestion =
    (isSelfRevealVisible ? localRevealQuestion : null) ??
    (isServerRevealVisible ? revealedQuestion : null) ??
    (isFinalReveal ? finalRevealQuestion : null);
  const displayRevealCorrectId =
    (isSelfRevealVisible ? (localRevealQuestion?.correctOptionId || undefined) : undefined) ??
    (isServerRevealVisible ? revealedCorrectId : undefined) ??
    (isFinalReveal ? (finalRevealQuestion?.correctOptionId || undefined) : undefined);
  const displayRevealExplanation =
    (isSelfRevealVisible ? ((localRevealQuestion?.explanation as string | undefined) || undefined) : undefined) ??
    (isServerRevealVisible ? revealedExplanation : undefined) ??
    (isFinalReveal ? ((finalRevealQuestion?.explanation as string | undefined) || undefined) : undefined);
  const showRevealMode = isQuestionLoading || isSelfRevealVisible || isServerRevealVisible || isFinalReveal;
  const [visibleQuestionRoundId, setVisibleQuestionRoundId] = useState<number | null>(null);
  useEffect(() => {
    if (isQuestionLoading || isInIntermission) return;
    const nextRoundId = displayRound?.roundId ?? activeRound?.roundId ?? submissionReview?.roundId ?? null;
    if (nextRoundId !== null) {
      setVisibleQuestionRoundId(nextRoundId);
    }
  }, [isQuestionLoading, isInIntermission, displayRound?.roundId, activeRound?.roundId, submissionReview?.roundId]);
  const renderedQuestionRoundKey = visibleQuestionRoundId !== null
    ? `round-${visibleQuestionRoundId}`
    : "round-unknown";
  const isAnswerLocked = Boolean(activeRound?.hasSubmitted) || submitting || isRoundSwitchDelay;

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
    // Try multiple seeds; if the shuffle coincidentally matches the original
    // (correct) order, the player would see the answer already arranged.
    let shuffled = seededShuffle(labels, roundId);
    const matchesOriginal = (arr: string[]) =>
      arr.length === labels.length && arr.every((item, i) => item === labels[i]);
    for (let attempt = 1; attempt <= 5 && matchesOriginal(shuffled); attempt++) {
      shuffled = seededShuffle(labels, roundId + attempt * 9973);
    }
    if (labels.length > 1 && matchesOriginal(shuffled)) {
      // Final fallback: rotate so the player never sees the correct order.
      shuffled = [...shuffled.slice(1), shuffled[0]];
    }
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

  // Hold 2.5 seconds before showing the next round question.
  useEffect(() => {
    const currentRoundId = activeRound?.roundId ?? null;
    if (currentRoundId === null) {
      // Keep the last question visible briefly when match is finished.
      if (match?.status === "finished" && displayRound) {
        return;
      }
      if (roundSwitchTimeoutRef.current !== null) {
        window.clearTimeout(roundSwitchTimeoutRef.current);
        roundSwitchTimeoutRef.current = null;
      }
      prevRoundIdRef.current = null;
      setIsRoundSwitchDelay(false);
      setDisplayRound(null);
      return;
    }
    if (prevRoundIdRef.current === null) {
      prevRoundIdRef.current = currentRoundId;
      setDisplayRound(activeRound);
      return;
    }
    if (prevRoundIdRef.current !== currentRoundId) {
      prevRoundIdRef.current = currentRoundId;
      setIsRoundSwitchDelay(true);
      if (roundSwitchTimeoutRef.current !== null) {
        window.clearTimeout(roundSwitchTimeoutRef.current);
      }
      roundSwitchTimeoutRef.current = window.setTimeout(() => {
        setDisplayRound(latestActiveRoundRef.current);
        setIsRoundSwitchDelay(false);
        roundSwitchTimeoutRef.current = null;
      }, ROUND_SWITCH_DELAY_MS);
      return;
    }
    if (isRoundSwitchDelay) return;
    setDisplayRound(activeRound);
  }, [activeRound, isRoundSwitchDelay, match?.status, displayRound]);

  useEffect(() => {
    return () => {
      if (roundSwitchTimeoutRef.current !== null) {
        window.clearTimeout(roundSwitchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (finalSpinnerTimeoutRef.current !== null) {
      window.clearTimeout(finalSpinnerTimeoutRef.current);
      finalSpinnerTimeoutRef.current = null;
    }
    if (finalSummaryTimeoutRef.current !== null) {
      window.clearTimeout(finalSummaryTimeoutRef.current);
      finalSummaryTimeoutRef.current = null;
    }

    if (match?.status !== "finished") {
      setShowFinalSummary(false);
      setShowFinalSpinner(false);
      setFinalSummarySeconds(0);
      return;
    }

    setShowFinalSummary(false);
    setShowFinalSpinner(false);
    setFinalSummarySeconds(5);
    const countdownInterval = window.setInterval(() => {
      setFinalSummarySeconds((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    finalSpinnerTimeoutRef.current = window.setTimeout(() => {
      setShowFinalSpinner(true);
      setFinalSummarySeconds(0);
      finalSpinnerTimeoutRef.current = null;
    }, 5000);
    finalSummaryTimeoutRef.current = window.setTimeout(() => {
      setShowFinalSummary(true);
      setShowFinalSpinner(false);
      finalSummaryTimeoutRef.current = null;
    }, 6000);

    return () => {
      window.clearInterval(countdownInterval);
    };
  }, [match?.status]);

  useEffect(() => {
    return () => {
      if (finalSpinnerTimeoutRef.current !== null) {
        window.clearTimeout(finalSpinnerTimeoutRef.current);
      }
      if (finalSummaryTimeoutRef.current !== null) {
        window.clearTimeout(finalSummaryTimeoutRef.current);
      }
    };
  }, []);

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
  // We measure time remaining from the absolute deadline so periodic
  // re-syncs do not reset the displayed countdown.
  useEffect(() => {
    if (!displayRound?.deadlineAt) {
      setRemainingSeconds(0);
      return;
    }
    const tick = () => {
      if (displayRound?.hasSubmitted) {
        return;
      }
      const deadlineAt = displayRound?.deadlineAt ?? "";
      const deadline = new Date(deadlineAt).getTime();
      if (!deadline) {
        setRemainingSeconds(0);
        return;
      }
      const diff = Math.max(0, deadline - Date.now());
      setRemainingSeconds(Math.ceil(diff / 1000));
    };
    tick();
    const intervalId = window.setInterval(tick, 200);
    return () => window.clearInterval(intervalId);
  }, [displayRound?.deadlineAt, displayRound?.hasSubmitted]);

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
    if (!activeRound || !isReady) return;
    if (activeRound.status !== "pending") return;

    const roundId = activeRound.roundId;
    const trySendReady = () => {
      if (readyRoundRef.current === roundId) return;
      if (arenaWsClient.getStatus() !== "connected") return;
      arenaWsClient.sendAction("question_ready", { matchId, roundId });
      readyRoundRef.current = roundId;
    };

    // Fire immediately if the socket is already open; otherwise wait for
    // the connection to come up. Without this, the ready signal can be
    // silently dropped while the WebSocket is still CONNECTING and both
    // players get stuck on "Waiting for both players to load the question".
    trySendReady();
    const unsubscribe = arenaWsClient.onStatusChange(() => trySendReady());
    return () => { unsubscribe(); };
  }, [activeRound?.roundId, activeRound?.status, isReady, matchId]);

  // Recovery while stuck on "Waiting for both players to load the question".
  // The ready signal above is only sent once per round. If that message is dropped
  // after the socket already reports "connected" (transient loss / backend restart),
  // neither player ever re-sends and both stall on the loading screen indefinitely.
  // While the loading screen is showing, re-send the ready signal periodically until
  // the round transitions to active (the 1s match-state poll then clears the screen).
  useEffect(() => {
    if (!isQuestionLoading || !isReady) return;
    const roundId = activeRound?.roundId;
    if (roundId == null) return;
    const resend = () => {
      if (arenaWsClient.getStatus() === "connected") {
        arenaWsClient.sendAction("question_ready", { matchId, roundId });
      }
    };
    const intervalId = window.setInterval(resend, 2000);
    return () => window.clearInterval(intervalId);
  }, [isQuestionLoading, isReady, matchId, activeRound?.roundId]);

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
      setSubmitNotice(null);
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

  // ─── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!match?.activeRound || match.activeRound.status !== "active") return;
    if (isQuestionLoading || intermissionUntil) return; // Can't submit during loading or reveal

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
      const result = await arenaWsClient.sendActionWithResponse<ArenaAnswerSubmitResponse>("submit_answer", {
        matchId: match.matchId,
        roundId: match.activeRound.roundId,
        selectedOptionId: finalValue,
      });
      useArenaMatchStore.getState().setMatch(result.state);
      if (result.revealedAnswer) {
        setSubmissionReview({
          roundId: match.activeRound.roundId,
          isCorrect: Boolean(result.isCorrect),
          scoreAwarded: Number(result.scoreAwarded ?? 0),
          selectedOptionId: result.selectedOptionId ?? finalValue,
          revealedAnswer: result.revealedAnswer,
        });
        setSubmitNotice("Answer recorded.");
      }
      if (result.alreadySubmitted) {
        setSubmitNotice("Your answer was already locked in for this round.");
      }
      if (result.roundClosed) {
        setSelectedOptionId(null);
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

  const maxPossibleScore = useMemo(() => {
    const rounds = Math.max(match?.totalRounds ?? 1, 1);
    return rounds * ROUND_MAX_SCORE;
  }, [match?.totalRounds]);

  const versusPlayers = useMemo(() => {
    const ranked = [...(match?.standings ?? [])]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 2);

    const ordered = (() => {
      if (!authUser?.id || ranked.length < 2) return ranked;
      const self = ranked.find((entry) => entry.userId === authUser.id);
      const opponent = ranked.find((entry) => entry.userId !== authUser.id);
      if (!self || !opponent) return ranked;
      return [self, opponent];
    })();

    return ordered.map((entry) => {
      const presence = presenceByUserId.get(entry.userId);
      const avatarUrl = presence?.avatarUrl || "/avatar/chicken.png";
      const fillPercent = Math.max(0, Math.min(100, (entry.score / maxPossibleScore) * 100));
      return {
        userId: entry.userId,
        displayName: entry.displayName,
        avatarUrl,
        score: entry.score,
        fillPercent,
      };
    });
  }, [authUser?.id, match?.standings, maxPossibleScore, presenceByUserId]);

  const allPlayers = useMemo(() => {
    if (!match?.standings) return [];
    return [...match.standings]
      .sort((a, b) => {
        if (a.userId === authUser?.id) return -1;
        if (b.userId === authUser?.id) return 1;
        return a.rank - b.rank;
      })
      .map((entry) => {
        const presence = presenceByUserId.get(entry.userId);
        const avatarUrl = presence?.avatarUrl || "/avatar/chicken.png";
        const fillPercent = Math.max(0, Math.min(100, (entry.score / maxPossibleScore) * 100));
        return {
          userId: entry.userId,
          displayName: entry.displayName,
          avatarUrl,
          score: entry.score,
          fillPercent,
          rank: entry.rank,
        };
      });
  }, [authUser?.id, match?.standings, maxPossibleScore, presenceByUserId]);

  const renderQuestion = displayRevealQuestion ?? displayRound?.question;
  const currentResult =
    match?.currentPlayerResult ??
    match?.standings?.find((entry) => entry.userId === authUser?.id) ??
    null;

  useEffect(() => {
    if (isQuestionLoading) return;
    if (!questionAreaRef.current) return;
    const rect = questionAreaRef.current.getBoundingClientRect();
    if (rect.height > 0) {
      setCachedQuestionAreaHeight(rect.height);
    }
  }, [isQuestionLoading, renderQuestion?.questionType, renderQuestion?.prompt, displayRound?.roundId, showRevealMode, match?.status]);
  const winLoseText = currentResult
    ? currentResult.rank === 1
      ? "Win"
      : "Lose"
    : "-";
  const normalizedRankTierBefore = (currentResult?.rankTierBefore ?? "").trim();
  const normalizedRankTierAfter = (currentResult?.rankTierAfter ?? "").trim();
  const rankTierBefore = normalizedRankTierBefore || normalizedRankTierAfter || "";
  const rankTierAfter = normalizedRankTierAfter || normalizedRankTierBefore || "";
  const rankTierText = rankTierBefore && rankTierAfter
    ? (rankTierBefore === rankTierAfter ? rankTierAfter : `${rankTierBefore} -> ${rankTierAfter}`)
    : "Settling...";
  const rankTierBadge = resolveRankTierBadgeVisual(rankTierAfter || rankTierBefore || null);
  // During intermission the progress bar should be full (time starting from 0)
  // Once intermission ends, show remaining round time
  const displaySeconds = isInIntermission ? intermissionSeconds : remainingSeconds;
  const inlineQuestionInCenter = versusPlayers.length === 2;

  const questionArea = (displayRound || isInIntermission || match?.status === "finished") ? (
    <div
      ref={questionAreaRef}
      style={isQuestionLoading ? { minHeight: `${cachedQuestionAreaHeight ?? 420}px` } : undefined}
      className="relative rounded-[28px] border border-white/70 bg-white/74 p-4 shadow-xl backdrop-blur-xl sm:p-6"
    >
      {match?.status === "finished" && (showFinalSpinner || showFinalSummary) ? (
        !showFinalSummary ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
            <div className="h-16 w-16 animate-spin rounded-full border-[6px] border-brand-teal/15 border-t-brand-teal/70" />
            <p className="mt-5 text-lg font-bold text-brand-gray-700">Calculating final summary...</p>
            <p className="mt-2 text-sm text-brand-gray-500">Please wait a moment while we settle the match results.</p>
          </div>
        ) : (
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-teal">Match Complete</p>
          <h2 className="font-heading text-3xl font-extrabold text-brand-gray-700">Final Summary</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">Win Or Lose</p>
              <p className="mt-2 font-heading text-2xl font-bold text-brand-gray-700">{winLoseText}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">Credits</p>
              <p className="mt-2 font-heading text-2xl font-bold text-brand-gray-700">+{currentResult?.creditsGained ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">Gained</p>
              <p className="mt-2 font-heading text-2xl font-bold text-brand-gray-700">+{currentResult?.xpGained ?? 0} XP</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">Accuracy</p>
              <p className="mt-2 font-heading text-2xl font-bold text-brand-gray-700">{currentResult?.accuracy ?? 0}%</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/70 bg-white/68 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">Rank Tier</p>
            <div className="mt-2 flex items-center gap-3">
              <Image
                src={rankTierBadge.src}
                alt={rankTierBadge.alt}
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <p className="font-heading text-2xl font-bold text-brand-gray-700">{rankTierText}</p>
              {typeof currentResult?.ratingDelta === "number" && currentResult.ratingDelta !== 0 ? (
                <span
                  className={`ml-auto font-heading text-lg font-extrabold tabular-nums ${
                    currentResult.ratingDelta > 0 ? "text-emerald-600" : "text-rose-500"
                  }`}
                >
                  {currentResult.ratingDelta > 0 ? "+" : ""}
                  {currentResult.ratingDelta} pts
                </span>
              ) : null}
            </div>
          </div>
          <GameButton className="mt-2 w-full py-4 text-lg" onClick={() => router.push("/home")}>
            Back To Home
          </GameButton>
        </div>
        )
      ) : (
        isQuestionLoading ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
            <div className="h-16 w-16 animate-spin rounded-full border-[6px] border-brand-teal/15 border-t-brand-teal/70" />
            <p className="mt-5 text-lg font-bold text-brand-gray-700">Waiting for both players to load the question</p>
            <p className="mt-2 text-sm text-brand-gray-500">The round will start once everyone enters this screen.</p>
          </div>
        ) : (
        <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-teal text-white">
            {(renderQuestion?.questionType) === "MultipleChoice" && <FiList />}
            {(renderQuestion?.questionType) === "MatchingPairs" && <FiHash />}
            {(renderQuestion?.questionType) === "Ordering" && <FiLayers />}
            {(renderQuestion?.questionType) === "FeynmanMirror" && <FiMessageSquare />}
            {(renderQuestion?.questionType) === "ExplainerMedia" && <FiBookOpen />}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-teal">
              {isInIntermission ? "Round Reveal" : (isSelfRevealVisible ? "Your Result" : (isFinalReveal ? "Round Reveal" : (displayRound?.question?.questionType || "Live Question")))}
            </p>
          </div>
        </div>
        {isInIntermission ? (
          <div className="flex animate-pulse items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-600">
            <FiClock className="h-3 w-3" />
            Next Round in {intermissionSeconds}s
          </div>
        ) : null}
      </div>

      <h2 className="font-heading text-lg font-bold leading-tight text-brand-gray-700 sm:text-2xl">
        {renderQuestion?.prompt}
      </h2>

      {showRevealMode && displayRevealExplanation && (
        <div className="mt-3 rounded-2xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-3">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-teal">Explanation</p>
          <p className="text-sm leading-relaxed text-brand-gray-600">
            {displayRevealExplanation}
          </p>
        </div>
      )}

      {(() => {
        const q = renderQuestion || activeRound?.question;
        if (!q || !q.questionType) return null;

        if (q.questionType === "MultipleChoice") {
          const rIdx = (latestReveal?.payload as any)?.roundIndex;
          const selectedForReveal = isInIntermission
            ? (userAnswersRef.current.get(rIdx) || undefined)
            : (submissionReview?.selectedOptionId || undefined);
          return (
            <div className="mt-4" key={renderedQuestionRoundKey}>
              <MultipleChoiceQuestion
                hideChrome
                stageIndex={isInIntermission ? (rIdx ?? 0) : (match?.currentRoundIndex ?? 0)}
                totalStages={match?.totalRounds ?? 0}
                topic={q.prompt}
                difficulty={mapDifficulty(q.difficulty)}
                question={q.prompt}
                options={q.options}
                correctId=""
                forceCorrectId={displayRevealCorrectId}
                userSelectedId={selectedForReveal}
                isLocked={isAnswerLocked}
                feedbackMsg={{ success: "", error: "", hint: "" }}
                onSelect={(id: string) => !showRevealMode && !isAnswerLocked && setSelectedOptionId(id)}
                onComplete={(id: string) => !showRevealMode && !isAnswerLocked && setSelectedOptionId(id)}
                onHintUse={async () => true}
              />
            </div>
          );
        }

        if (q.questionType === "MatchingPairs") {
          const rIdx = (latestReveal?.payload as any)?.roundIndex;
          return (
            <div className="mt-6" key={renderedQuestionRoundKey}>
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
                selectedLeftId={isInIntermission || isAnswerLocked ? null : selectedLeftId}
                selectedRightId={isInIntermission || isAnswerLocked ? null : selectedRightId}
                wrongPair={null}
                hintPairId={null}
                hintUsed={false}
                allMatched={showRevealMode ? true : allMatched}
                feedback={null}
                isRevealed={showRevealMode}
                onPickLeft={showRevealMode || isAnswerLocked ? () => {} : pickLeft}
                onPickRight={showRevealMode || isAnswerLocked ? () => {} : pickRight}
                onHint={showRevealMode || isAnswerLocked ? () => {} : () => void handleMatchingHint()}
                onSubmit={() => {}}
                onSkip={() => {}}
              />
            </div>
          );
        }

        if (q.questionType === "Ordering") {
          const rIdx = (latestReveal?.payload as any)?.roundIndex;
          return (
            <div className="mt-6" key={renderedQuestionRoundKey}>
              <OrderingQuestion
                hideChrome
                stageIndex={isInIntermission ? (rIdx ?? 0) : (match?.currentRoundIndex ?? 0)}
                totalStages={match?.totalRounds ?? 0}
                topic={q.prompt}
                difficulty={mapDifficulty(q.difficulty)}
                isRevealed={showRevealMode}
                stage={{
                  stageId: String(isInIntermission ? (rIdx ?? 0) : (displayRound?.roundId ?? 0)),
                  topic: q.prompt,
                  component: "Ordering",
                  config: {
                    data: { steps: q.options || [] },
                    initialState: { order: stableOrderedItems },
                  },
                  feedback: { success: "", error: "" }
                } as any}
                onSubmit={async (items: string[]) => {
                  if (!showRevealMode && !isAnswerLocked) setSelectedOptionId(JSON.stringify(items));
                }}
                onChange={(items: string[]) => !showRevealMode && !isAnswerLocked && setSelectedOptionId(JSON.stringify(items))}
                onContinue={() => {}}
                onSkip={() => {}}
              />
            </div>
          );
        }

        if (q.questionType === "FeynmanMirror") {
          const rIdx = (latestReveal?.payload as any)?.roundIndex;
          return (
            <div className="mt-6" key={renderedQuestionRoundKey}>
              <FeynmanQuestion
                hideChrome
                stageIndex={isInIntermission ? (rIdx ?? 0) : (match?.currentRoundIndex ?? 0)}
                totalStages={match?.totalRounds ?? 0}
                topic={q.prompt}
                difficulty={mapDifficulty(q.difficulty)}
                prompt={q.prompt}
                sampleAnswer={(q as any).sampleAnswer || displayRevealExplanation || displayRevealCorrectId || ""}
                courseId={match?.publicCourseId ?? 0}
                maxRounds={1}
                feedbackMsg={{ success: "", error: "", hint: "Keep it simple." }}
                isRevealed={showRevealMode}
                onSubmit={async (answer: string) => {
                  if (!showRevealMode && !isAnswerLocked) {
                    setSelectedOptionId(answer);
                    return { result: "correct", feedback: "Captured explanation." };
                  }
                  return { result: "correct", feedback: "" };
                }}
                onChange={(answer: string) => !showRevealMode && !isAnswerLocked && setSelectedOptionId(answer)}
                onContinue={() => {}}
                onHintUse={async () => true}
              />
            </div>
          );
        }

        if (q.questionType === "ExplainerMedia") {
          const rIdx = (latestReveal?.payload as any)?.roundIndex;
          return (
            <div className="mt-6" key={renderedQuestionRoundKey}>
              <ExplainerMediaCard
                hideChrome
                stageIndex={isInIntermission ? (rIdx ?? 0) : (match?.currentRoundIndex ?? 0)}
                totalStages={match?.totalRounds ?? 0}
                topic={q.prompt}
                difficulty={mapDifficulty(q.difficulty)}
                title={q.prompt}
                explanation={(q as any).explanation || "Read this carefully."}
                bullets={q.options?.map((o: any) => o.text || o) || []}
                onContinue={() => !showRevealMode && !isAnswerLocked && setSelectedOptionId("acknowledged")}
                onMount={() => !showRevealMode && !isAnswerLocked && setSelectedOptionId("acknowledged")}
              />
            </div>
          );
        }

        return (
          <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center shadow-inner">
            <FiZap className="mx-auto mb-3 h-8 w-8 text-rose-400 opacity-60" />
            <h3 className="font-heading text-lg font-bold text-rose-800">Unsupported App Version</h3>
            <p className="mt-2 text-sm font-medium text-rose-600">
              The pool has provided a {"'"}{q.questionType}{"'"} component but this Arena Client does not support it.
            </p>
          </div>
        );
      })()}

      <GameButton
        className="mt-6 w-full py-4 text-lg"
        onClick={() => void handleSubmit()}
        disabled={!selectedOptionId || submitting || (activeRound?.hasSubmitted ?? false) || isInIntermission || isQuestionLoading || isFinalReveal}
      >
        {isQuestionLoading
          ? "Loading question..."
          : isInIntermission
          ? `Next Round in ${intermissionSeconds}s`
          : isSelfRevealVisible
          ? `${submissionReview?.isCorrect ? "Correct" : "Incorrect"} · ${submissionReview?.scoreAwarded ?? 0} pts`
          : isFinalReveal
          ? "Calculating results..."
          : (activeRound?.hasSubmitted ? "Answer Locked ✓" : "Submit Challenge")}
      </GameButton>
        </>
        )
      )}
    </div>
  ) : (
    <div className="rounded-[28px] border border-white/70 bg-white/74 p-6 text-sm text-brand-gray-500">
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
  );

  return (
    <div className="min-h-screen app-shared-bg">
      <TopStatsBar
        backHref="/home"
        pageTitle="Arena Match"
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
      <main className="mx-auto max-w-[1180px] px-3 pt-2 pb-4 md:px-6">
        <DeepGlassCard className="px-4 pt-0 pb-4 md:px-6 md:pt-0 md:pb-6">
          {connectionStatus !== "connected" || isRecovering ? (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-900">
              {connectionStatus === "reconnecting" || isRecovering
                ? "Connection interrupted. Re-syncing the match state now..."
                : "Connecting to the live Arena event stream..."}
            </div>
          ) : null}

          {allPlayers.length >= 2 ? (
            <div className="mt-0 p-3">
              <div className="mb-3 grid grid-cols-3 items-start gap-2 sm:gap-3 md:grid-cols-[140px_1fr_220px] lg:grid-cols-[140px_1fr_240px]">
                {/* Yourself (Column 1 - Left) */}
                <div className="mx-auto w-full max-w-[140px] md:order-1">
                  <div className="flex w-full flex-col items-center justify-center text-center">
                    <img
                      src={allPlayers[0].avatarUrl}
                      alt={allPlayers[0].displayName}
                      className="h-14 w-14 rounded-full border-4 border-[#c7deec] bg-white object-cover shadow-[0_0_0_4px_rgba(226,241,248,0.9)] sm:h-16 sm:w-16 md:h-20 md:w-20"
                      onError={(event) => {
                        event.currentTarget.src = "/avatar/chicken.png";
                      }}
                    />
                    <p className="mt-2 w-full truncate text-center font-heading text-xs font-bold text-[#0a5d9a] sm:text-sm md:text-lg">
                      {allPlayers[0].displayName}
                    </p>
                    {/* Mobile-only compact score (vertical bars are hidden on phones) */}
                    <div className="mt-1 w-full md:hidden">
                      <p className="font-heading text-sm font-black leading-none text-brand-gray-700">
                        {allPlayers[0].score}<span className="ml-0.5">pts</span>
                      </p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#2f3840]/15">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#6ed3b2] to-[#f4efb4]" style={{ width: `${allPlayers[0].fillPercent}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Round info & Timer (Column 2 - Middle) */}
                <div className="mx-auto flex w-full max-w-[140px] flex-col items-center justify-center text-center md:order-2">
                  <div className="relative flex h-16 w-16 items-center justify-center md:h-20 md:w-20">
                    <div className="absolute inset-0 rounded-full border-[5px] border-[#d2e8f2] md:border-[6px]" />
                    <div className="absolute inset-[10px] rounded-full border-[3px] border-[#94b9c9] border-dashed md:inset-[12px]" />
                    <p className="relative z-10 font-heading text-2xl font-light leading-none text-[#2f404c] md:text-3xl">
                      {activeRound
                        ? (isQuestionLoading ? "..." : displaySeconds)
                        : (match?.status === "finished"
                            ? (showFinalSummary ? "✓" : (finalSummarySeconds > 0 ? finalSummarySeconds : "✓"))
                            : "--")}
                    </p>
                  </div>
                  <p className="mt-2 w-full text-center text-[11px] font-bold text-brand-teal sm:text-sm">
                    Round {(match?.currentRoundIndex ?? 0) + 1} / {match?.totalRounds ?? 0}
                  </p>
                </div>

                {/* Others info (Column 3 - Right) */}
                <div className="mx-auto w-full max-w-[220px] lg:max-w-[240px] md:order-3">
                  {allPlayers.length === 2 ? (
                    <div className="flex w-full flex-col items-center justify-center text-center">
                      <img
                        src={allPlayers[1].avatarUrl}
                        alt={allPlayers[1].displayName}
                        className="h-14 w-14 rounded-full border-4 border-[#c7deec] bg-white object-cover shadow-[0_0_0_4px_rgba(226,241,248,0.9)] sm:h-16 sm:w-16 md:h-20 md:w-20"
                        onError={(event) => {
                          event.currentTarget.src = "/avatar/chicken.png";
                        }}
                      />
                      <p className="mt-2 w-full truncate text-center font-heading text-xs font-bold text-[#0a5d9a] sm:text-sm md:text-lg">
                        {allPlayers[1].displayName}
                      </p>
                      {/* Mobile-only compact score (vertical bars are hidden on phones) */}
                      <div className="mt-1 w-full md:hidden">
                        <p className="font-heading text-sm font-black leading-none text-brand-gray-700">
                          {allPlayers[1].score}<span className="ml-0.5">pts</span>
                        </p>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#2f3840]/15">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#6ed3b2] to-[#f4efb4]" style={{ width: `${allPlayers[1].fillPercent}%` }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Mobile: show the highest-scoring opponent in the top row */}
                      <div className="flex w-full flex-col items-center justify-center text-center md:hidden">
                        <img
                          src={allPlayers[1].avatarUrl}
                          alt={allPlayers[1].displayName}
                          className="h-14 w-14 rounded-full border-4 border-[#c7deec] bg-white object-cover shadow-[0_0_0_4px_rgba(226,241,248,0.9)] sm:h-16 sm:w-16"
                          onError={(event) => {
                            event.currentTarget.src = "/avatar/chicken.png";
                          }}
                        />
                        <p className="mt-2 w-full truncate text-center font-heading text-xs font-bold text-[#0a5d9a] sm:text-sm">
                          {allPlayers[1].displayName}
                        </p>
                        <div className="mt-1 w-full">
                          <p className="font-heading text-sm font-black leading-none text-brand-gray-700">
                            {allPlayers[1].score}<span className="ml-0.5">pts</span>
                          </p>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#2f3840]/15">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#6ed3b2] to-[#f4efb4]" style={{ width: `${allPlayers[1].fillPercent}%` }} />
                          </div>
                        </div>
                      </div>
                      {/* Desktop: opponents count label */}
                      <div className="mb-1.5 hidden items-center justify-between text-center md:flex md:text-left">
                        <p className="font-heading text-xs font-extrabold text-[#0a5d9a] sm:text-sm">
                          Opponents ({allPlayers.length - 1})
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid items-stretch gap-3 md:grid-cols-[140px_1fr_220px] lg:grid-cols-[140px_1fr_240px]">
                {/* Your score bar (Column 1 - Left) — vertical bar is desktop-only */}
                <div className="mx-auto hidden h-full w-full max-w-[140px] rounded-[28px] border-[3px] border-[#78b7cf] bg-[#eef7ff]/85 p-2.5 shadow-md md:order-1 md:block">
                  <div className="flex h-full flex-col items-center justify-between py-2">
                    <div className="text-center">
                      <p className="font-heading text-5xl font-bold leading-none text-[#2b3f4d]">
                        {allPlayers[0].score}
                      </p>
                    </div>
                    <div className="my-2 flex min-h-[230px] flex-1 w-16 items-end justify-center rounded-[14px] bg-transparent p-1.5">
                      <div className="relative h-full w-8 overflow-hidden rounded-[10px] bg-[#2f3840]">
                        <div
                          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#f4efb4] to-[#6ed3b2] transition-all duration-700 ease-out"
                          style={{ height: `${allPlayers[0].fillPercent}%`, transition: "height 700ms ease-out" }}
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-gray-500">Your Score</p>
                      <p className="font-heading text-2xl font-bold text-brand-gray-700">{Math.round(allPlayers[0].fillPercent)}%</p>
                    </div>
                  </div>
                </div>

                {/* Question area (Column 2 - Middle) */}
                <div className="flex w-full flex-col justify-center md:order-2">
                  <div className="w-full">{questionArea}</div>
                </div>

                {/* Other score bars (Column 3 - Right) */}
                <div className="mx-auto h-full w-full max-w-full md:order-3 md:max-w-[220px] lg:max-w-[240px]">
                  {allPlayers.length === 2 ? (
                    <div className="mx-auto hidden h-full w-full max-w-[140px] rounded-[28px] border-[3px] border-[#78b7cf] bg-[#eef7ff]/85 p-2.5 shadow-md md:block">
                      <div className="flex h-full flex-col items-center justify-between py-2">
                        <div className="text-center">
                          <p className="font-heading text-5xl font-bold leading-none text-[#2b3f4d]">
                            {allPlayers[1].score}
                          </p>
                        </div>
                        <div className="my-2 flex min-h-[230px] flex-1 w-16 items-end justify-center rounded-[14px] bg-transparent p-1.5">
                          <div className="relative h-full w-8 overflow-hidden rounded-[10px] bg-[#2f3840]">
                            <div
                              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#f4efb4] to-[#6ed3b2] transition-all duration-700 ease-out"
                              style={{ height: `${allPlayers[1].fillPercent}%`, transition: "height 700ms ease-out" }}
                            />
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-gray-500">Score Bar</p>
                          <p className="font-heading text-2xl font-bold text-brand-gray-700">{Math.round(allPlayers[1].fillPercent)}%</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Mobile: remaining opponents (top one is already in the header) — compact vertical card, 3 per row */}
                      <div className="flex flex-wrap justify-center gap-2 md:hidden">
                        {allPlayers.slice(2).map((player) => (
                          <div
                            key={player.userId}
                            className="flex flex-col items-center gap-1 rounded-2xl border-2 border-[#78b7cf] bg-[#eef7ff]/85 p-2 text-center shadow-sm"
                            style={{ width: "calc((100% - 1rem) / 3)" }}
                          >
                            <img
                              src={player.avatarUrl}
                              alt={player.displayName}
                              className="h-11 w-11 flex-none rounded-full border-2 border-[#c7deec] bg-white object-cover"
                              onError={(event) => {
                                event.currentTarget.src = "/avatar/chicken.png";
                              }}
                            />
                            <p className="w-full truncate font-heading text-sm font-bold leading-tight text-[#0a5d9a]">
                              {player.displayName}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-500 leading-tight">
                              Rank #{player.rank}
                            </p>
                            <p className="font-heading text-base font-black leading-none text-brand-gray-700">
                              {player.score}<span className="ml-0.5 font-sans text-[10px] font-normal text-brand-gray-400">pts</span>
                            </p>
                            <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-[#2f3840]/15">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#6ed3b2] to-[#f4efb4]" style={{ width: `${player.fillPercent}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop: full opponent list in the right column */}
                      <div className="hidden h-full max-h-[380px] overflow-y-auto pr-1 space-y-2 md:block">
                        {allPlayers.slice(1).map((player) => (
                          <div
                            key={player.userId}
                            className="flex items-center justify-between gap-2 p-2.5 bg-[#eef7ff]/85 border-2 border-[#78b7cf] rounded-[20px] shadow-sm transition hover:bg-white/80"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={player.avatarUrl}
                                alt={player.displayName}
                                className="h-11 w-11 flex-none rounded-full border-2 border-[#c7deec] bg-white object-cover"
                                onError={(event) => {
                                  event.currentTarget.src = "/avatar/chicken.png";
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-heading text-sm font-bold text-[#0a5d9a] truncate leading-tight">
                                  {player.displayName}
                                </p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-500 mt-0.5">
                                  Rank #{player.rank}
                                </p>
                                <p className="font-heading text-base font-black text-brand-gray-700 mt-1">
                                  {player.score} <span className="text-[10px] font-normal font-sans text-brand-gray-400">pts</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-center flex-none">
                              <div className="relative h-14 w-4 overflow-hidden rounded-[6px] bg-[#2f3840]">
                                <div
                                  className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#f4efb4] to-[#6ed3b2] transition-all duration-700 ease-out"
                                  style={{ height: `${player.fillPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6">{questionArea}</div>
          )}
        </DeepGlassCard>
      </main>
    </div>
  );
}
