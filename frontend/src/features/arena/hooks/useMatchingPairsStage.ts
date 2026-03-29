"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export interface MatchPair {
  id: string;
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
    () => pairs.map((pair) => `${pair.id}::${pair.left}::${pair.right}`).join("|"),
    [pairs]
  );
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedRightId, setSelectedRightId] = useState<string | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Record<string, string>>({});
  const [hintUsed, setHintUsed] = useState(false);
  const [hintPairId, setHintPairId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [shuffledRightIds, setShuffledRightIds] = useState<string[]>(() =>
    pairs.map((p) => p.id)
  );

  useEffect(() => {
    setSelectedLeftId(null);
    setSelectedRightId(null);
    setMatchedPairs({});
    setHintUsed(false);
    setHintPairId(null);
    setFeedback(null);
    setShowConfetti(false);
    setShuffledRightIds(enabled ? shuffle(pairs.map((p) => p.id)) : []);
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
    (pairId: string) => {
      if (!enabled || feedback) return;
      if (matchedPairs[pairId]) {
        setMatchedPairs((prev) => {
          const next = { ...prev };
          delete next[pairId];
          return next;
        });
        setSelectedLeftId(null);
        setSelectedRightId(null);
        return;
      }
      if (selectedLeftId === pairId) {
        setSelectedLeftId(null);
        return;
      }
      if (selectedRightId) {
        setMatchedPairs((prev) => {
          const nextEntries = Object.entries(prev).filter(
            ([leftId, rightId]) => leftId !== pairId && rightId !== selectedRightId
          );
          return {
            ...Object.fromEntries(nextEntries),
            [pairId]: selectedRightId,
          };
        });
        setSelectedRightId(null);
        setTimeout(() => {
          setSelectedLeftId(null);
        }, 120);
        return;
      }
      setSelectedLeftId(pairId);
    },
    [enabled, feedback, matchedPairs, selectedLeftId, selectedRightId]
  );

  const pickRight = useCallback(
    (pairId: string) => {
      if (!enabled || feedback) return;
      const linkedLeft = Object.entries(matchedPairs).find(
        ([, rightId]) => rightId === pairId
      )?.[0];
      if (linkedLeft) {
        setMatchedPairs((prev) => {
          const next = { ...prev };
          delete next[linkedLeft];
          return next;
        });
        setSelectedLeftId(null);
        setSelectedRightId(null);
        return;
      }
      if (selectedRightId === pairId) {
        setSelectedRightId(null);
        return;
      }
      if (!selectedLeftId) {
        setSelectedRightId(pairId);
        return;
      }

      setSelectedRightId(pairId);
      setMatchedPairs((prev) => {
        const nextEntries = Object.entries(prev).filter(
          ([leftId, rightId]) => leftId !== selectedLeftId && rightId !== pairId
        );
        return {
          ...Object.fromEntries(nextEntries),
          [selectedLeftId]: pairId,
        };
      });
      setSelectedLeftId(null);
      setTimeout(() => {
        setSelectedRightId(null);
      }, 120);
    },
    [enabled, feedback, matchedPairs, selectedLeftId, selectedRightId]
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

    const unmatched = pairs.filter((p) => !matched.includes(p.id));
    if (unmatched.length > 0) {
      const pair = unmatched[0];
      setHintPairId(pair.id);
      setMatchedPairs((prev) => ({
        ...prev,
        [pair.id]: pair.id,
      }));
      setHintUsed(true);
      setTimeout(() => {
        setSelectedLeftId(null);
        setSelectedRightId(null);
        setHintPairId(null);
      }, 1200);
    }
  }, [allMatched, enabled, hintUsed, matched, onHintUse, pairs]);

  return {
    selectedLeftId,
    selectedRightId,
    matched,
    matchedPairs,
    wrongPair: null,
    hintUsed,
    hintPairId,
    feedback,
    showConfetti,
    shuffledRightIds,
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
