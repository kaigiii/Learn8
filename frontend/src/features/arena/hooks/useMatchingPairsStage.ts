"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface MatchPair {
  left: string;
  right: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface UseMatchingPairsStageParams {
  pairs: MatchPair[];
  enabled: boolean;
  onCorrectStageComplete: (matchedPairs: Record<string, string>) => void;
  onHintUse: () => boolean;
}

export function useMatchingPairsStage({
  pairs,
  enabled,
  onCorrectStageComplete,
  onHintUse,
}: UseMatchingPairsStageParams) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [hintUsed, setHintUsed] = useState(false);
  const [hintPair, setHintPair] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [shuffledRight, setShuffledRight] = useState<string[]>(() =>
    pairs.map((p) => p.right)
  );

  useEffect(() => {
    setSelectedLeft(null);
    setSelectedRight(null);
    setMatchedPairs({});
    setHintUsed(false);
    setHintPair(null);
    setFeedback(null);
    setShowConfetti(false);
    setShuffledRight(enabled ? shuffle(pairs.map((p) => p.right)) : []);
  }, [enabled, pairs]);

  const matched = useMemo(
    () => Object.keys(matchedPairs),
    [matchedPairs]
  );

  const allMatched = useMemo(
    () => enabled && matched.length === pairs.length,
    [enabled, matched.length, pairs.length]
  );

  const pickLeft = useCallback(
    (word: string) => {
      if (!enabled || matched.includes(word) || feedback) return;
      setSelectedLeft(word);
    },
    [enabled, feedback, matched]
  );

  const pickRight = useCallback(
    (word: string) => {
      if (!enabled || feedback || !selectedLeft) return;
      setSelectedRight(word);
      setMatchedPairs((prev) => {
        const nextEntries = Object.entries(prev).filter(
          ([left, right]) => left !== selectedLeft && right !== word
        );
        return {
          ...Object.fromEntries(nextEntries),
          [selectedLeft]: word,
        };
      });
      setSelectedLeft(null);
      setTimeout(() => {
        setSelectedRight(null);
      }, 120);
    },
    [enabled, feedback, selectedLeft]
  );

  const handleCheck = useCallback(() => {
    if (!enabled) return;
    if (!allMatched) return;
    onCorrectStageComplete(matchedPairs);
  }, [
    allMatched,
    enabled,
    matchedPairs,
    onCorrectStageComplete,
  ]);

  const markCorrectFeedback = useCallback(() => {
    setFeedback("correct");
    setShowConfetti(true);
  }, []);

  const markIncorrectFeedback = useCallback(() => {
    setFeedback("incorrect");
  }, []);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
    setShowConfetti(false);
  }, []);

  const handleHint = useCallback(() => {
    if (!enabled || hintUsed || allMatched) return;
    const canAfford = onHintUse();
    if (!canAfford) return;

    const unmatched = pairs.filter((p) => !matched.includes(p.left));
    if (unmatched.length > 0) {
      const pair = unmatched[0];
      setHintPair(pair.left);
      setMatchedPairs((prev) => ({
        ...prev,
        [pair.left]: pair.right,
      }));
      setHintUsed(true);
      setTimeout(() => {
        setSelectedLeft(null);
        setSelectedRight(null);
        setHintPair(null);
      }, 1200);
    }
  }, [allMatched, enabled, hintUsed, matched, onHintUse, pairs]);

  return {
    selectedLeft,
    selectedRight,
    matched,
    matchedPairs,
    wrongPair: null,
    hintUsed,
    hintPair,
    feedback,
    showConfetti,
    shuffledRight,
    allMatched,
    pickLeft,
    pickRight,
    handleCheck,
    handleHint,
    markCorrectFeedback,
    markIncorrectFeedback,
    clearFeedback,
  };
}
