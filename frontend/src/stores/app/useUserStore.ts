import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "@/lib/apiTypes";
import { deriveOnboardingStateFromProfile } from "@/lib/auth/onboarding";

export interface UserPreferences {
  soundOn: boolean;
  darkGlass: boolean;
  difficulty: number;
}

export interface UserIdentityState {
  name: string;
  title: string;
}

export interface UserProgressionState {
  xp: number;
  level: number;
  xpToNextLevel: number;
  streak: number;
  longestStreak: number;
  coursesCompleted: number;
}

export interface UserWalletState {
  credits: number;
  localSpentCredits: number;
}

export interface UserNavigationState {
  lastActiveCourseId: string | null;
  lastActiveNodeId: string | null;
}

export interface UserOnboardingState {
  onboarded: boolean;
  selectedTopics: string[];
  dailyGoal: string;
}

export interface UserState {
  identity: UserIdentityState;
  progression: UserProgressionState;
  wallet: UserWalletState;
  navigation: UserNavigationState;
  preferences: UserPreferences;
  onboarding: UserOnboardingState;
}

export interface UserActions {
  setName: (name: string) => void;
  setTitle: (title: string) => void;
  addXp: (amount: number) => void;
  addCredits: (amount: number) => void;
  spendCredits: (amount: number) => boolean;
  incrementStreak: () => void;
  resetStreak: () => void;
  incrementCoursesCompleted: () => void;
  setLastActiveCourse: (courseId: string) => void;
  setLastActiveNode: (nodeId: string) => void;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  completeOnboarding: (data: {
    name: string;
    topics: string[];
    goal: string;
  }) => void;
  syncFromProfile: (profile: UserProfile) => void;
  logout: () => void;
}

function xpForLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

function titleForLevel(level: number) {
  if (level >= 20) return "Grandmaster Scholar";
  if (level >= 15) return "Master Scholar";
  if (level >= 10) return "Expert Scholar";
  if (level >= 5) return "Quantum Scholar";
  if (level >= 3) return "Apprentice Scholar";
  return "Novice Learner";
}

function getEffectiveCredits(wallet: UserWalletState) {
  return Math.max(0, wallet.credits - wallet.localSpentCredits);
}

const INITIAL_STATE: UserState = {
  identity: {
    name: "Explorer",
    title: "Novice Learner",
  },
  progression: {
    xp: 0,
    level: 1,
    xpToNextLevel: xpForLevel(1),
    streak: 0,
    longestStreak: 0,
    coursesCompleted: 0,
  },
  wallet: {
    credits: 0,
    localSpentCredits: 0,
  },
  navigation: {
    lastActiveCourseId: null,
    lastActiveNodeId: null,
  },
  preferences: {
    soundOn: true,
    darkGlass: true,
    difficulty: 50,
  },
  onboarding: {
    onboarded: false,
    selectedTopics: [],
    dailyGoal: "",
  },
};

function migratePersistedState(persistedState: unknown): UserState {
  if (!persistedState || typeof persistedState !== "object") {
    return INITIAL_STATE;
  }

  const raw = persistedState as Record<string, unknown>;
  return {
    ...INITIAL_STATE,
    ...raw,
    identity: {
      ...INITIAL_STATE.identity,
      ...(raw.identity as Partial<UserIdentityState> | undefined),
    },
    progression: {
      ...INITIAL_STATE.progression,
      ...(raw.progression as Partial<UserProgressionState> | undefined),
    },
    wallet: {
      ...INITIAL_STATE.wallet,
      ...(raw.wallet as Partial<UserWalletState> | undefined),
    },
    navigation: {
      ...INITIAL_STATE.navigation,
      ...(raw.navigation as Partial<UserNavigationState> | undefined),
    },
    preferences: {
      ...INITIAL_STATE.preferences,
      ...(raw.preferences as Partial<UserPreferences> | undefined),
    },
    onboarding: {
      ...INITIAL_STATE.onboarding,
      ...(raw.onboarding as Partial<UserOnboardingState> | undefined),
    },
  };
}

const useUserStore = create<UserState & UserActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      setName: (name) =>
        set((state) => ({
          identity: { ...state.identity, name },
        })),

      setTitle: (title) =>
        set((state) => ({
          identity: { ...state.identity, title },
        })),

      addXp: (amount) => {
        const state = get();
        let newXp = state.progression.xp + amount;
        let newLevel = state.progression.level;
        let xpNeeded = state.progression.xpToNextLevel;

        while (newXp >= xpNeeded) {
          newXp -= xpNeeded;
          newLevel += 1;
          xpNeeded = xpForLevel(newLevel);
        }

        set((current) => ({
          identity: {
            ...current.identity,
            title: titleForLevel(newLevel),
          },
          progression: {
            ...current.progression,
            xp: newXp,
            level: newLevel,
            xpToNextLevel: xpNeeded,
          },
        }));
      },

      addCredits: (amount) =>
        set((state) => ({
          wallet: {
            credits: state.wallet.credits + amount,
            localSpentCredits: state.wallet.localSpentCredits,
          },
        })),

      spendCredits: (amount) => {
        const state = get();
        if (getEffectiveCredits(state.wallet) < amount) {
          return false;
        }
        set((current) => ({
          wallet: {
            ...current.wallet,
            localSpentCredits: current.wallet.localSpentCredits + amount,
          },
        }));
        return true;
      },

      incrementStreak: () =>
        set((state) => ({
          progression: {
            ...state.progression,
            streak: state.progression.streak + 1,
            longestStreak: Math.max(
              state.progression.longestStreak,
              state.progression.streak + 1
            ),
          },
        })),

      resetStreak: () =>
        set((state) => ({
          progression: {
            ...state.progression,
            streak: 0,
          },
        })),

      incrementCoursesCompleted: () =>
        set((state) => ({
          progression: {
            ...state.progression,
            coursesCompleted: state.progression.coursesCompleted + 1,
          },
        })),

      setLastActiveCourse: (courseId) =>
        set((state) => ({
          navigation: {
            ...state.navigation,
            lastActiveCourseId: courseId,
          },
        })),

      setLastActiveNode: (nodeId) =>
        set((state) => ({
          navigation: {
            ...state.navigation,
            lastActiveNodeId: nodeId,
          },
        })),

      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),

      completeOnboarding: ({ name, topics, goal }) =>
        set((state) => ({
          identity: {
            ...state.identity,
            name,
          },
          onboarding: {
            onboarded: true,
            selectedTopics: topics,
            dailyGoal: goal,
          },
        })),

      syncFromProfile: (profile) =>
        set((state) => ({
          identity: {
            name:
              profile.full_name?.trim() ||
              profile.email.split("@")[0] ||
              state.identity.name,
            title: profile.job_title?.trim() || state.identity.title,
          },
          onboarding: deriveOnboardingStateFromProfile(profile),
          wallet: {
            credits: profile.credits,
            localSpentCredits: 0,
          },
        })),

      logout: () => set(INITIAL_STATE),
    }),
    {
      name: "learn8-user",
      version: 3,
      migrate: (persistedState) => migratePersistedState(persistedState),
    }
  )
);

export function selectUserName(state: UserState) {
  return state.identity.name;
}

export function selectUserTitle(state: UserState) {
  return state.identity.title;
}

export function selectUserXp(state: UserState) {
  return state.progression.xp;
}

export function selectUserLevel(state: UserState) {
  return state.progression.level;
}

export function selectUserXpToNextLevel(state: UserState) {
  return state.progression.xpToNextLevel;
}

export function selectAvailableCredits(state: UserState) {
  return getEffectiveCredits(state.wallet);
}

export default useUserStore;
