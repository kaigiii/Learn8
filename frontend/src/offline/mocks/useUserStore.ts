import { create } from "zustand";

export const useUserStore = create((set) => ({
  clientOnly: {
    preferences: {
      preferredLanguage: "zh-TW",
      soundOn: true,
      darkGlass: false,
      difficulty: 2,
    },
    navigation: {
      lastActiveCourseId: null,
      lastActiveNodeId: null,
    }
  },
  serverBacked: {
    identity: {
      name: "離線學習者",
      title: "學習大師",
    },
    progression: {
      xp: 0,
      level: 1,
      xpToNextLevel: 100,
    },
    wallet: {
      credits: 999,
    }
  },
  setPreferences: () => {},
  setLastActiveCourse: () => {},
  setLastActiveNode: () => {},
}));

export function selectUserName(state: any) {
  return state.serverBacked.identity.name;
}

export function selectUserTitle(state: any) {
  return state.serverBacked.identity.title;
}

export function selectUserXp(state: any) {
  return state.serverBacked.progression.xp;
}

export function selectUserLevel(state: any) {
  return state.serverBacked.progression.level;
}

export function selectUserXpToNextLevel(state: any) {
  return state.serverBacked.progression.xpToNextLevel;
}

export function selectAvailableCredits(state: any) {
  return state.serverBacked.wallet.credits;
}

export function selectUserPreferences(state: any) {
  return state.clientOnly.preferences;
}

export function selectLastActiveNodeId(state: any) {
  return state.clientOnly.navigation?.lastActiveNodeId;
}

export function selectUserProgression(state: any) {
  return state.serverBacked.progression;
}

export default useUserStore;
