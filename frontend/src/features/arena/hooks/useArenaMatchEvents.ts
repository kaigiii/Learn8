"use client";

import { useEffect, useRef } from "react";
import { fetchArenaMatch } from "@/lib/arena/api";
import { arenaWsClient } from "@/lib/arena/realtimeClient";
import { ArenaRoundState, ArenaStandingEntry } from "@/lib/apiTypes";
import { useArenaMatchStore } from "@/stores/arena/useArenaMatchStore";

export function useArenaMatchEvents(matchId: number | null) {
  const match = useArenaMatchStore((state) => state.match);
  const setMatch = useArenaMatchStore((state) => state.setMatch);
  const appendEvents = useArenaMatchStore((state) => state.appendEvents);
  const patchMatch = useArenaMatchStore((state) => state.patchMatch);
  const setConnectionStatus = useArenaMatchStore((state) => state.setConnectionStatus);

  const applyStandingsDelta = (userId: number, scoreAwarded: number | null | undefined, isCorrect: boolean | null | undefined) => {
    const currentMatch = useArenaMatchStore.getState().match;
    if (!currentMatch?.standings?.length) return;

    const delta = Number(scoreAwarded ?? 0);
    const nextStandings = currentMatch.standings.map((entry) => {
      if (entry.userId !== userId) return entry;

      return {
        ...entry,
        score: entry.score + delta,
        answeredCount: entry.answeredCount + 1,
        correctCount: entry.correctCount + (isCorrect ? 1 : 0),
        incorrectCount: entry.incorrectCount + (isCorrect ? 0 : 1),
      };
    });

    nextStandings.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      const correctDiff = b.correctCount - a.correctCount;
      if (correctDiff !== 0) return correctDiff;
      const responseDiff = (a.averageResponseMs ?? 10 ** 9) - (b.averageResponseMs ?? 10 ** 9);
      if (responseDiff !== 0) return responseDiff;
      return a.displayName.localeCompare(b.displayName);
    });

    nextStandings.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    const currentUserId = useArenaMatchStore.getState().match?.currentPlayerResult?.userId;
    const currentPlayerResult = currentUserId
      ? nextStandings.find((entry) => entry.userId === currentUserId) ?? null
      : currentMatch.currentPlayerResult ?? null;

    patchMatch({
      standings: nextStandings,
      currentPlayerResult,
    });
  };

  const refetch = async () => {
    if (!matchId) return;
    try {
      const refreshedMatch = await fetchArenaMatch(matchId);
      setMatch(refreshedMatch);
    } catch (err) {
      console.error("Manual match refetch failed:", err);
    }
  };

  // Track whether the match is finished so we can stop heartbeat/polling
  const matchFinishedRef = useRef(false);

  // Keep the ref in sync with the store's match status
  useEffect(() => {
    if (match?.status === "finished") {
      matchFinishedRef.current = true;
    }
  }, [match?.status]);

  useEffect(() => {
    if (!matchId) return;

    let cancelled = false;
    matchFinishedRef.current = false;

    void fetchArenaMatch(matchId)
      .then((data) => {
        if (!cancelled) {
          setMatch(data);
          if (data.status === "finished") matchFinishedRef.current = true;
        }
      })
      .catch(() => undefined);

    arenaWsClient.subscribeMatch(matchId);

    const unsubscribeStatus = arenaWsClient.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubscribeEvents = arenaWsClient.onEvents(async (events) => {
      const matchEvents = events.filter((e) => e.matchId === matchId);
      if (matchEvents.length === 0 || cancelled) return;

      appendEvents(matchEvents);

      let needsFetch = true;
      for (const envelope of matchEvents) {
        const payload = envelope.payload as any;

        if (payload && payload.activeRound) {
          patchMatch({ activeRound: payload.activeRound as ArenaRoundState });
          needsFetch = false;
        }
        if (envelope.eventType === "round.answer_received") {
          applyStandingsDelta(
            Number(payload?.userId ?? 0),
            payload?.scoreAwarded,
            payload?.isCorrect
          );
          needsFetch = false;
        }
        if (payload && payload.standings) {
          patchMatch({ standings: payload.standings as ArenaStandingEntry[] });
          needsFetch = false;
        }
        if (envelope.eventType === "match.finished") {
          patchMatch({ status: "finished" });
          matchFinishedRef.current = true;
          needsFetch = false;
        }
      }

      // Stop fetching for finished matches — the result page will do a one-time load
      if (matchFinishedRef.current || !needsFetch) return;

      try {
        const refreshedMatch = await fetchArenaMatch(matchId);
        if (!cancelled && refreshedMatch.matchId === matchId) {
          setMatch(refreshedMatch);
          if (refreshedMatch.status === "finished") matchFinishedRef.current = true;
        }
      } catch (err) {
        console.error("Failed to refresh match on event:", err);
      }
    });

    const sendHeartbeat = () => {
      // Stop heartbeating for finished matches
      if (cancelled || matchFinishedRef.current) return;
      arenaWsClient.sendAction("heartbeat", { matchId });
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, 5000);

    const matchFallbackInterval = window.setInterval(async () => {
      // Don't poll if match is finished, cancelled, or connected via WS
      if (cancelled || matchFinishedRef.current || arenaWsClient.getStatus() === "connected") return;

      try {
        const refreshedMatch = await fetchArenaMatch(matchId);
        if (!cancelled && refreshedMatch.matchId === matchId) {
          setMatch(refreshedMatch);
          if (refreshedMatch.status === "finished") matchFinishedRef.current = true;
        }
      } catch (err) {
        console.error("Match fallback poll failed:", err);
      }
    }, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      unsubscribeStatus();
      unsubscribeEvents();
      arenaWsClient.unsubscribeMatch(matchId);
      window.clearInterval(intervalId);
      window.clearInterval(matchFallbackInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [matchId, appendEvents, patchMatch, setConnectionStatus, setMatch]);

  // During an active match, run a short-interval state sync.
  // This keeps score bars aligned even when WS event delivery is delayed.
  useEffect(() => {
    if (!matchId) return;
    if (match?.status !== "in_progress") return;

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const refreshedMatch = await fetchArenaMatch(matchId);
        if (!cancelled && refreshedMatch.matchId === matchId) {
          setMatch(refreshedMatch);
        }
      } catch {
        // Ignore transient sync errors; regular WS/poll paths continue.
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [matchId, match?.status, setMatch]);

  return { match, refetch };
}
