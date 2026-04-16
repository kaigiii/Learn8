"use client";

import { useEffect } from "react";
import { fetchArenaRoom } from "@/lib/arena/api";
import { arenaWsClient } from "@/lib/arena/realtimeClient";
import { useArenaLobbyStore } from "@/stores/arena/useArenaLobbyStore";

export function useArenaRoomEvents(roomCode: string | null) {
  const room = useArenaLobbyStore((state) => state.room);
  const setRoom = useArenaLobbyStore((state) => state.setRoom);
  const appendEvents = useArenaLobbyStore((state) => state.appendEvents);
  const setConnectionStatus = useArenaLobbyStore((state) => state.setConnectionStatus);

  useEffect(() => {
    if (!roomCode) return;

    let cancelled = false;
    void fetchArenaRoom(roomCode)
      .then((data) => {
        if (!cancelled) setRoom(data);
      })
      .catch(() => undefined);

    arenaWsClient.subscribeRoom(roomCode);

    const unsubscribeStatus = arenaWsClient.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubscribeEvents = arenaWsClient.onEvents(async (events) => {
      const roomEvents = events.filter(e => e.roomCode === roomCode);
      if (roomEvents.length > 0) {
        appendEvents(roomEvents);
        const refreshedRoom = await fetchArenaRoom(roomCode);
        setRoom(refreshedRoom);
      }
    });

    const sendHeartbeat = () => arenaWsClient.sendAction("heartbeat", { roomCode });
    
    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      unsubscribeStatus();
      unsubscribeEvents();
      arenaWsClient.unsubscribeRoom(roomCode);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [roomCode, appendEvents, setConnectionStatus, setRoom]);

  return room;
}
