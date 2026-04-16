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
  appendEvents: (newEvents) =>
    set((state) => {
      const existingIds = new Set(state.events.map((e) => e.eventId));
      const filtered = newEvents.filter((e) => !existingIds.has(e.eventId));
      if (filtered.length === 0) return state;

      const updatedEvents = [...state.events, ...filtered].slice(-150);
      return {
        events: updatedEvents,
        lastCursor: Math.max(state.lastCursor, ...filtered.map((e) => e.cursor)),
      };
    }),
  setLastCursor: (lastCursor) => set({ lastCursor }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setRecovering: (isRecovering) => set({ isRecovering }),
  setSelectedOptionId: (selectedOptionId) => set({ selectedOptionId }),
  setSubmitting: (submitting) => set({ submitting }),
  patchMatch: (partial) =>
    set((state) => {
      if (!state.match) return { match: partial as ArenaMatchState };
      
      // Basic shallow check to avoid redundant patches
      const hasChange = Object.entries(partial).some(
        ([key, value]) => (state.match as any)[key] !== value
      );
      if (!hasChange) return state;

      return {
        match: { ...state.match, ...partial },
      };
    }),
  reset: () => set(INITIAL_STATE),
}));
