import { create } from "zustand";

import type { ArenaEventEnvelope, ArenaMatchState } from "@/lib/apiTypes";
import type { ArenaRealtimeStatus } from "@/lib/arena/realtimeClient";

interface ArenaMatchStoreState {
  match: ArenaMatchState | null;
  events: ArenaEventEnvelope[];
  lastCursor: number;
  connectionStatus: ArenaRealtimeStatus;
  isRecovering: boolean;
  selectedOptionId: string | null;
  submitting: boolean;
  setMatch: (match: ArenaMatchState | null) => void;
  appendEvents: (events: ArenaEventEnvelope[]) => void;
  setLastCursor: (cursor: number) => void;
  setConnectionStatus: (status: ArenaRealtimeStatus) => void;
  setRecovering: (isRecovering: boolean) => void;
  setSelectedOptionId: (optionId: string | null) => void;
  setSubmitting: (submitting: boolean) => void;
  patchMatch: (partial: Partial<ArenaMatchState>) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  match: null,
  events: [],
  lastCursor: 0,
  connectionStatus: "idle" as ArenaRealtimeStatus,
  isRecovering: false,
  selectedOptionId: null,
  submitting: false,
};

export const useArenaMatchStore = create<ArenaMatchStoreState>()((set) => ({
  ...INITIAL_STATE,
  setMatch: (match) => set({ match }),
  appendEvents: (events) =>
    set((state) => ({
      events: [...state.events, ...events].slice(-150),
      lastCursor: events.length > 0 ? events[events.length - 1].cursor : state.lastCursor,
    })),
  setLastCursor: (lastCursor) => set({ lastCursor }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setRecovering: (isRecovering) => set({ isRecovering }),
  setSelectedOptionId: (selectedOptionId) => set({ selectedOptionId }),
  setSubmitting: (submitting) => set({ submitting }),
  patchMatch: (partial) =>
    set((state) => ({
      match: state.match ? { ...state.match, ...partial } : (partial as ArenaMatchState),
    })),
  reset: () => set(INITIAL_STATE),
}));
