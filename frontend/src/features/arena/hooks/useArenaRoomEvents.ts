"use client";

import { useEffect } from "react";

import {
  buildArenaRoomStreamPath,
  fetchArenaRoom,
  heartbeatArenaRoomPresence,
} from "@/lib/arena/api";
import { watchArenaEvents } from "@/lib/arena/realtimeClient";
import { useArenaLobbyStore } from "@/stores/arena/useArenaLobbyStore";

function getCursorStorageKey(roomCode: string) {
  return `arena:room:${roomCode.toUpperCase()}:cursor`;
}

function readStoredCursor(roomCode: string): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.sessionStorage.getItem(getCursorStorageKey(roomCode));
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function writeStoredCursor(roomCode: string, cursor: number) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(getCursorStorageKey(roomCode), String(Math.max(0, cursor)));
}

export function useArenaRoomEvents(roomCode: string | null) {
  const room = useArenaLobbyStore((state) => state.room);
  const setRoom = useArenaLobbyStore((state) => state.setRoom);
  const appendEvents = useArenaLobbyStore((state) => state.appendEvents);
  const lastCursor = useArenaLobbyStore((state) => state.lastCursor);
  const setLastCursor = useArenaLobbyStore((state) => state.setLastCursor);
  const setConnectionStatus = useArenaLobbyStore((state) => state.setConnectionStatus);
  const setRecovering = useArenaLobbyStore((state) => state.setRecovering);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    let cancelled = false;
    const initialCursor = Math.max(lastCursor, readStoredCursor(roomCode));
    setLastCursor(initialCursor);

    void fetchArenaRoom(roomCode)
      .then((data) => {
        if (!cancelled) {
          setRoom(data);
          setRecovering(false);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [roomCode, setLastCursor, setRecovering, setRoom]);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    const initialCursor = Math.max(lastCursor, readStoredCursor(roomCode));
    setLastCursor(initialCursor);

    const watcher = watchArenaEvents({
      initialCursor,
      streamPath: buildArenaRoomStreamPath(roomCode),
      onEvents: async (events) => {
        appendEvents(events);
        const newestCursor = events[events.length - 1]?.cursor;
        if (newestCursor) {
          writeStoredCursor(roomCode, newestCursor);
          setLastCursor(newestCursor);
        }
        const refreshedRoom = await fetchArenaRoom(roomCode);
        setRoom(refreshedRoom);
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);
      },
      onResync: async () => {
        setRecovering(true);
        const refreshedRoom = await fetchArenaRoom(roomCode);
        setRoom(refreshedRoom);
        setRecovering(false);
      },
      onError: () => {
        setRecovering(true);
      },
    });

    return () => watcher.close();
  }, [
    appendEvents,
    roomCode,
    setConnectionStatus,
    setLastCursor,
    setRecovering,
    setRoom,
  ]);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    let cancelled = false;
    const sendHeartbeat = async () => {
      try {
        await heartbeatArenaRoomPresence(roomCode);
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
  }, [roomCode, setRecovering]);

  return room;
}
