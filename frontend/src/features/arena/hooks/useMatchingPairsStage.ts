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
  onHintUse: () => Promise<boolean>;
}

export function useMatchingPairsStage({
  pairs,
  enabled,
  onCorrectStageComplete,
  onHintUse,
}: UseMatchingPairsStageParams) {
  const pairsKey = useMemo(
    () => pairs.map((pair) => `${pair.left}::${pair.right}`).join("|"),
    [pairs]
  );
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
  }, [enabled, pairsKey]);

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
      if (!enabled || feedback) return;
      if (matchedPairs[word]) {
        setMatchedPairs((prev) => {
          const next = { ...prev };
          delete next[word];
          return next;
        });
        setSelectedLeft(null);
        setSelectedRight(null);
        return;
      }
      if (selectedLeft === word) {
        setSelectedLeft(null);
        return;
      }
      if (selectedRight) {
        setMatchedPairs((prev) => {
          const nextEntries = Object.entries(prev).filter(
            ([left, right]) => left !== word && right !== selectedRight
          );
          return {
            ...Object.fromEntries(nextEntries),
            [word]: selectedRight,
          };
        });
        setSelectedRight(null);
        setTimeout(() => {
          setSelectedLeft(null);
        }, 120);
        return;
      }
      setSelectedLeft(word);
    },
    [enabled, feedback, matchedPairs, selectedLeft, selectedRight]
  );

  const pickRight = useCallback(
    (word: string) => {
      if (!enabled || feedback) return;
      const linkedLeft = Object.entries(matchedPairs).find(
        ([, right]) => right === word
      )?.[0];
      if (linkedLeft) {
        setMatchedPairs((prev) => {
          const next = { ...prev };
          delete next[linkedLeft];
          return next;
        });
        setSelectedLeft(null);
        setSelectedRight(null);
        return;
      }
      if (selectedRight === word) {
        setSelectedRight(null);
        return;
      }
      if (!selectedLeft) {
        setSelectedRight(word);
        return;
      }

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
    [enabled, feedback, matchedPairs, selectedLeft]
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

  const handleHint = useCallback(async () => {
    if (!enabled || hintUsed || allMatched) return;
    const canAfford = await onHintUse();
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
