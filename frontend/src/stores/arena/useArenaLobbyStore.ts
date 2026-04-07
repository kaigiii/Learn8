import { create } from "zustand";

import type { ArenaEventEnvelope, ArenaRoom } from "@/lib/apiTypes";
import type { ArenaRealtimeStatus } from "@/lib/arena/realtimeClient";

interface ArenaLobbyState {
  room: ArenaRoom | null;
  events: ArenaEventEnvelope[];
  lastCursor: number;
  connectionStatus: ArenaRealtimeStatus;
  isRecovering: boolean;
  setRoom: (room: ArenaRoom | null) => void;
  appendEvents: (events: ArenaEventEnvelope[]) => void;
  setLastCursor: (cursor: number) => void;
  setConnectionStatus: (status: ArenaRealtimeStatus) => void;
  setRecovering: (isRecovering: boolean) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  room: null,
  events: [],
  lastCursor: 0,
  connectionStatus: "idle" as ArenaRealtimeStatus,
  isRecovering: false,
};

export const useArenaLobbyStore = create<ArenaLobbyState>()((set) => ({
  ...INITIAL_STATE,
  setRoom: (room) => set({ room }),
  appendEvents: (events) =>
    set((state) => ({
      events: [...state.events, ...events].slice(-100),
      lastCursor: events.length > 0 ? events[events.length - 1].cursor : state.lastCursor,
    })),
  setLastCursor: (lastCursor) => set({ lastCursor }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setRecovering: (isRecovering) => set({ isRecovering }),
  reset: () => set(INITIAL_STATE),
}));
