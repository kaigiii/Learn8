"use client";

import { useCallback, useEffect } from "react";
import { fetchArenaRoom } from "@/lib/arena/api";
import { arenaWsClient } from "@/lib/arena/realtimeClient";
import { useArenaLobbyStore } from "@/stores/arena/useArenaLobbyStore";

export function useArenaRoomEvents(roomCode: string | null) {
  const room = useArenaLobbyStore((state) => state.room);
  const setRoom = useArenaLobbyStore((state) => state.setRoom);
  const appendEvents = useArenaLobbyStore((state) => state.appendEvents);
  const setConnectionStatus = useArenaLobbyStore((state) => state.setConnectionStatus);

  const refetch = useCallback(async () => {
    if (!roomCode) return;
    try {
      const refreshedRoom = await fetchArenaRoom(roomCode.toUpperCase());
      setRoom(refreshedRoom);
    } catch (err) {
      console.error("Manual room refetch failed:", err);
    }
  }, [roomCode, setRoom]);

  useEffect(() => {
    if (!roomCode) return;
    const normalizedRoomCode = roomCode.toUpperCase();

    let cancelled = false;
    void fetchArenaRoom(normalizedRoomCode)
      .then((data) => {
        if (!cancelled) setRoom(data);
      })
      .catch(() => undefined);

    arenaWsClient.subscribeRoom(normalizedRoomCode);

    const unsubscribeStatus = arenaWsClient.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubscribeEvents = arenaWsClient.onEvents(async (events) => {
      const roomEvents = events.filter(
        (e) => (e.roomCode || "").toUpperCase() === normalizedRoomCode
      );
      if (roomEvents.length > 0) {
        appendEvents(roomEvents);
        try {
          const refreshedRoom = await fetchArenaRoom(normalizedRoomCode);
          if (!cancelled) setRoom(refreshedRoom);
        } catch {
          // Keep current room state; fallback polling will retry.
        }
      }
    });

    const sendHeartbeat = () => arenaWsClient.sendAction("heartbeat", { roomCode: normalizedRoomCode });
    
    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, 5000);

    const fallbackPollId = window.setInterval(async () => {
      if (cancelled) return;
      try {
        const refreshedRoom = await fetchArenaRoom(normalizedRoomCode);
        if (!cancelled) setRoom(refreshedRoom);
      } catch {
        // Ignore transient polling failures.
      }
    }, 3000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
        void fetchArenaRoom(normalizedRoomCode)
          .then((refreshedRoom) => {
            if (!cancelled) setRoom(refreshedRoom);
          })
          .catch(() => undefined);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      unsubscribeStatus();
      unsubscribeEvents();
      arenaWsClient.unsubscribeRoom(normalizedRoomCode);
      window.clearInterval(intervalId);
      window.clearInterval(fallbackPollId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [roomCode, appendEvents, setConnectionStatus, setRoom]);

  return { room, refetch };
}
