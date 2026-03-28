"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useUserStore, {
  selectUserLevel,
  selectUserXp,
  selectUserXpToNextLevel,
} from "@/stores/app/useUserStore";

interface UseLessonRewardAnimationParams {
  enabled: boolean;
  rewardAmount: number;
  rewardKey: string | null;
  endSession: () => void;
}

export function useLessonRewardAnimation({
  enabled,
  rewardAmount,
  rewardKey,
  endSession,
}: UseLessonRewardAnimationParams) {
  const addXp = useUserStore((s) => s.addXp);
  const currentXp = useUserStore(selectUserXp);
  const currentLevel = useUserStore(selectUserLevel);
  const currentXpToNext = useUserStore(selectUserXpToNextLevel);

  const [rewarded, setRewarded] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [xpBarWidth, setXpBarWidth] = useState(0);
  const [barDuration, setBarDuration] = useState(0);
  const [displayLevel, setDisplayLevel] = useState(1);

  const prevUserRef = useRef<{ xp: number; level: number; xpToNext: number } | null>(
    null
  );
  const animStarted = useRef(false);

  const rewardStorageKey = useMemo(() => {
    if (!rewardKey) {
      return null;
    }
    return `learn8_rewarded_result:${rewardKey}`;
  }, [rewardKey]);

  useEffect(() => {
    if (!enabled || rewarded) {
      return;
    }

    if (rewardStorageKey && typeof window !== "undefined") {
      if (window.sessionStorage.getItem(rewardStorageKey) === "1") {
        setRewarded(true);
        return;
      }
    }

    const snap = useUserStore.getState();
    prevUserRef.current = {
      xp: snap.progression.xp,
      level: snap.progression.level,
      xpToNext: snap.progression.xpToNextLevel,
    };

    endSession();
    if (rewardAmount > 0) {
      addXp(rewardAmount);
    }

    if (rewardStorageKey && typeof window !== "undefined") {
      window.sessionStorage.setItem(rewardStorageKey, "1");
    }

    setRewarded(true);
  }, [addXp, enabled, endSession, rewardAmount, rewarded, rewardStorageKey]);

  useEffect(() => {
    if (!rewarded || animStarted.current || !prevUserRef.current) {
      return;
    }
    animStarted.current = true;

    const prev = prevUserRef.current;
    const post = useUserStore.getState();
    const leveled = post.progression.level > prev.level;
    const startPct = prev.xpToNext > 0 ? (prev.xp / prev.xpToNext) * 100 : 0;
    const endPct =
      post.progression.xpToNextLevel > 0
        ? (post.progression.xp / post.progression.xpToNextLevel) * 100
        : 0;

    setDisplayLevel(prev.level);
    setBarDuration(0);
    setXpBarWidth(startPct);

    if (leveled) {
      const t1 = window.setTimeout(() => {
        setBarDuration(1.0);
        setXpBarWidth(100);
      }, 1800);
      const t2 = window.setTimeout(() => setShowLevelUp(true), 3000);
      const t3 = window.setTimeout(() => {
        setBarDuration(0);
        setXpBarWidth(0);
        setDisplayLevel(post.progression.level);
      }, 3600);
      const t4 = window.setTimeout(() => {
        setBarDuration(0.8);
        setXpBarWidth(endPct);
      }, 3750);

      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);
        window.clearTimeout(t4);
      };
    }

    const t = window.setTimeout(() => {
      setBarDuration(1.2);
      setXpBarWidth(endPct);
    }, 1800);

    return () => window.clearTimeout(t);
  }, [rewarded]);

  useEffect(() => {
    if (enabled || rewarded) {
      return;
    }
    setDisplayLevel(currentLevel);
    setBarDuration(0);
    setXpBarWidth(currentXpToNext > 0 ? (currentXp / currentXpToNext) * 100 : 0);
  }, [currentLevel, currentXp, currentXpToNext, enabled, rewarded]);

  return {
    rewarded,
    showLevelUp,
    xpBarWidth,
    barDuration,
    displayLevel,
    currentXp,
    currentLevel,
    currentXpToNext,
  };
}
