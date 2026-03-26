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
  onIncorrectSelection: () => void;
  onHintUse: () => boolean;
}

export function useMatchingPairsStage({
  pairs,
  enabled,
  onCorrectStageComplete,
  onIncorrectSelection,
  onHintUse,
}: UseMatchingPairsStageParams) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);
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
    setMatched([]);
    setMatchedPairs({});
    setWrongPair(null);
    setHintUsed(false);
    setHintPair(null);
    setFeedback(null);
    setShowConfetti(false);
    setShuffledRight(enabled ? shuffle(pairs.map((p) => p.right)) : []);
  }, [enabled, pairs]);

  const allMatched = useMemo(
    () => enabled && matched.length === pairs.length,
    [enabled, matched.length, pairs.length]
  );

  const pickLeft = useCallback(
    (word: string) => {
      if (!enabled || matched.includes(word) || feedback) return;
      setSelectedLeft(word);
      setWrongPair(null);
    },
    [enabled, feedback, matched]
  );

  const pickRight = useCallback(
    (word: string) => {
      if (!enabled || feedback || !selectedLeft) return;
      const alreadyMatched = pairs.find(
        (p) => p.right === word && matched.includes(p.left)
      );
      if (alreadyMatched) return;
      setSelectedRight(word);
    },
    [enabled, feedback, matched, pairs, selectedLeft]
  );

  const handleCheck = useCallback(() => {
    if (!enabled) return;
    if (allMatched) {
      onCorrectStageComplete(matchedPairs);
      return;
    }

    if (!selectedLeft || !selectedRight) return;

    const pair = pairs.find((p) => p.left === selectedLeft);
    if (pair && pair.right === selectedRight) {
      setMatched((prev) => [...prev, selectedLeft]);
      setMatchedPairs((prev) => ({ ...prev, [selectedLeft]: selectedRight }));
      setSelectedLeft(null);
      setSelectedRight(null);
      setWrongPair(null);
    } else {
      const correctRight = pair?.right ?? "";
      setWrongPair([selectedLeft, selectedRight]);
      onIncorrectSelection();
      setTimeout(() => {
        setMatched((prev) => [...prev, selectedLeft]);
        setMatchedPairs((prev) => ({ ...prev, [selectedLeft]: correctRight }));
        setWrongPair(null);
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 800);
    }
  }, [
    allMatched,
    enabled,
    matchedPairs,
    onCorrectStageComplete,
    onIncorrectSelection,
    pairs,
    selectedLeft,
    selectedRight,
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
      setSelectedLeft(pair.left);
      setSelectedRight(pair.right);
      setHintUsed(true);
      setTimeout(() => {
        setMatched((prev) => [...prev, pair.left]);
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
    wrongPair,
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
