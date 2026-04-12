"use client";

import { API_BASE_URL, getAuthToken } from "@/lib/apiClient";
import type { ArenaEventEnvelope } from "@/lib/apiTypes";

export type ArenaRealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

interface WatchArenaEventsOptions {
  initialCursor?: number;
  streamPath: string;
  onEvents: (events: ArenaEventEnvelope[]) => void | Promise<void>;
  onStatusChange?: (status: ArenaRealtimeStatus) => void;
  onResync?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
}

function buildArenaStreamUrl(path: string, afterCursor: number): string {
  const token = getAuthToken();
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  url.searchParams.set("after_cursor", String(Math.max(0, afterCursor)));
  if (token) {
    url.searchParams.set("access_token", token);
  }
  return url.toString();
}

export function watchArenaEvents({
  initialCursor = 0,
  streamPath,
  onEvents,
  onStatusChange,
  onResync,
  onError,
}: WatchArenaEventsOptions) {
  let disposed = false;
  let cursor = Math.max(0, initialCursor);
  let source: EventSource | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempts = 0;
  let hasOpened = false;

  const setStatus = (status: ArenaRealtimeStatus) => {
    onStatusChange?.(status);
  };

  const closeSource = () => {
    if (source) {
      source.close();
      source = null;
    }
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (disposed) {
      return;
    }
    closeSource();
    clearReconnectTimer();
    reconnectAttempts += 1;
    setStatus("reconnecting");
    const delay = Math.min(1000 * Math.max(reconnectAttempts, 1), 5000);
    reconnectTimer = window.setTimeout(() => {
      void connect(true);
    }, delay);
  };

  const connect = async (isReconnect: boolean) => {
    if (disposed) {
      return;
    }
    closeSource();
    clearReconnectTimer();
    setStatus(isReconnect || hasOpened ? "reconnecting" : "connecting");
    if (isReconnect || hasOpened) {
      await onResync?.();
    }

    source = new EventSource(buildArenaStreamUrl(streamPath, cursor));
    source.onopen = () => {
      reconnectAttempts = 0;
      hasOpened = true;
      setStatus("connected");
    };
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ArenaEventEnvelope;
        cursor = Math.max(cursor, payload.cursor);
        void onEvents([payload]);
      } catch (error) {
        onError?.(error);
      }
    };
    source.onerror = (event) => {
      onError?.(event);
      scheduleReconnect();
    };
  };

  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    setStatus("offline");
    onError?.(new Error("EventSource is not available in this browser"));
    return {
      close() {
        disposed = true;
      },
    };
  }

  void connect(false);

  return {
    close() {
      disposed = true;
      clearReconnectTimer();
      closeSource();
      setStatus("idle");
    },
  };
}
