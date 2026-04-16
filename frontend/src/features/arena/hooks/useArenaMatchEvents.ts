"use client";

import { useEffect } from "react";
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

  useEffect(() => {
    if (!matchId) return;

    let cancelled = false;
    void fetchArenaMatch(matchId)
      .then((data) => {
        if (!cancelled) setMatch(data);
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
        // Optimization: if we already see it's finished, we don't need to do much more
        
        if (payload && payload.activeRound) {
          patchMatch({ activeRound: payload.activeRound as ArenaRoundState });
          needsFetch = false;
        }
        if (payload && payload.standings) {
          patchMatch({ standings: payload.standings as ArenaStandingEntry[] });
          needsFetch = false;
        }
        if (envelope.eventType === "match.finished") {
          patchMatch({ status: "finished" });
          needsFetch = false;
        }
      }

      // If match is finished, we usually get a final data dump, so fetch once if needed
      if (!needsFetch) return;

      try {
        const refreshedMatch = await fetchArenaMatch(matchId);
        if (!cancelled && refreshedMatch.matchId === matchId) {
          setMatch(refreshedMatch);
        }
      } catch (err) {
        console.error("Failed to refresh match on event:", err);
      }
    });

    const sendHeartbeat = () => {
       if (cancelled) return;
       arenaWsClient.sendAction("heartbeat", { matchId });
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, 5000);

    const matchFallbackInterval = window.setInterval(async () => {
      // Don't poll if match is already finished or we are currently connected
      if (cancelled || arenaWsClient.getStatus() === "connected") return;
      
      try {
        const refreshedMatch = await fetchArenaMatch(matchId);
        if (!cancelled && refreshedMatch.matchId === matchId) {
          setMatch(refreshedMatch);
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

  return match;
}
