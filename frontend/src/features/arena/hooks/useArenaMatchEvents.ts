"use client";

import { useEffect } from "react";

import {
  buildArenaMatchStreamPath,
  fetchArenaMatch,
  heartbeatArenaMatchPresence,
} from "@/lib/arena/api";
import { watchArenaEvents } from "@/lib/arena/realtimeClient";
import { useArenaMatchStore } from "@/stores/arena/useArenaMatchStore";

function getCursorStorageKey(matchId: number) {
  return `arena:match:${matchId}:cursor`;
}

function readStoredCursor(matchId: number): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.sessionStorage.getItem(getCursorStorageKey(matchId));
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function writeStoredCursor(matchId: number, cursor: number) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(getCursorStorageKey(matchId), String(Math.max(0, cursor)));
}

export function useArenaMatchEvents(matchId: number | null) {
  const match = useArenaMatchStore((state) => state.match);
  const setMatch = useArenaMatchStore((state) => state.setMatch);
  const appendEvents = useArenaMatchStore((state) => state.appendEvents);
  const lastCursor = useArenaMatchStore((state) => state.lastCursor);
  const setLastCursor = useArenaMatchStore((state) => state.setLastCursor);
  const setConnectionStatus = useArenaMatchStore((state) => state.setConnectionStatus);
  const setRecovering = useArenaMatchStore((state) => state.setRecovering);

  useEffect(() => {
    if (!matchId) {
      return;
    }

    let cancelled = false;
    const initialCursor = Math.max(lastCursor, readStoredCursor(matchId));
    setLastCursor(initialCursor);

    void fetchArenaMatch(matchId)
      .then((data) => {
        if (!cancelled) {
          setMatch(data);
          setRecovering(false);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [matchId, setLastCursor, setMatch, setRecovering]);

  useEffect(() => {
    if (!matchId) {
      return;
    }

    const initialCursor = Math.max(lastCursor, readStoredCursor(matchId));
    setLastCursor(initialCursor);

    const watcher = watchArenaEvents({
      initialCursor,
      streamPath: buildArenaMatchStreamPath(matchId),
      onEvents: async (events) => {
        appendEvents(events);
        const newestCursor = events[events.length - 1]?.cursor;
        if (newestCursor) {
          writeStoredCursor(matchId, newestCursor);
          setLastCursor(newestCursor);
        }
        const refreshedMatch = await fetchArenaMatch(matchId);
        setMatch(refreshedMatch);
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
      },
      onResync: async () => {
        setRecovering(true);
        const refreshedMatch = await fetchArenaMatch(matchId);
        setMatch(refreshedMatch);
        setRecovering(false);
      },
      onError: () => {
        setRecovering(true);
      },
    });

    return () => watcher.close();
  }, [
    appendEvents,
    matchId,
    setConnectionStatus,
    setLastCursor,
    setMatch,
    setRecovering,
  ]);

  useEffect(() => {
    if (!matchId) {
      return;
    }

    let cancelled = false;
    const sendHeartbeat = async () => {
      try {
        await heartbeatArenaMatchPresence(matchId);
      } catch {
        if (!cancelled) {
          setRecovering(true);
        }
      }
    };

    void sendHeartbeat();
    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sendHeartbeat();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [matchId, setRecovering]);

  return match;
}
