import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "@/lib/apiTypes";
import { deriveOnboardingStateFromProfile } from "@/lib/auth/onboarding";
import {
  DEFAULT_LANGUAGE_LABEL,
  resolveLanguageLabel,
} from "@/lib/i18n/languages";

export interface UserPreferences {
  soundOn: boolean;
  darkGlass: boolean;
  difficulty: number;
  preferredLanguage: string;
  voiceAssistant?: string;
  autoPlaySpeech?: boolean;
}

export interface UserIdentityState {
  name: string;
  title: string;
}

export interface UserProgressionState {
  xp: number;
  level: number;
  xpToNextLevel: number;
}

export interface UserWalletState {
  credits: number;
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

export interface ServerBackedUserState {
  identity: UserIdentityState;
  progression: UserProgressionState;
  wallet: UserWalletState;
}

export interface ClientOnlyUserState {
  navigation: UserNavigationState;
  preferences: UserPreferences;
  onboarding: UserOnboardingState;
  metrics: {
    streak: number;
    longestStreak: number;
    coursesCompleted: number;
  };
}

export interface UserState {
  serverBacked: ServerBackedUserState;
  clientOnly: ClientOnlyUserState;
}

export interface UserActions {
  setName: (name: string) => void;
  setTitle: (title: string) => void;
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

function titleForLevel(level: number) {
  if (level >= 20) return "Grandmaster Scholar";
  if (level >= 15) return "Master Scholar";
  if (level >= 10) return "Expert Scholar";
  if (level >= 5) return "Quantum Scholar";
  if (level >= 3) return "Apprentice Scholar";
  return "Novice Learner";
}

const INITIAL_STATE: UserState = {
  serverBacked: {
    identity: {
      name: "Explorer",
      title: "Novice Learner",
    },
    progression: {
      xp: 0,
      level: 1,
      xpToNextLevel: 100,
    },
    wallet: {
      credits: 0,
    },
  },
  clientOnly: {
    navigation: {
      lastActiveCourseId: null,
      lastActiveNodeId: null,
    },
    preferences: {
      soundOn: true,
      darkGlass: true,
      difficulty: 50,
      preferredLanguage: DEFAULT_LANGUAGE_LABEL,
      voiceAssistant: "preset_01",
      autoPlaySpeech: false,
    },
    onboarding: {
      onboarded: false,
      selectedTopics: [],
      dailyGoal: "",
    },
    metrics: {
      streak: 0,
      longestStreak: 0,
      coursesCompleted: 0,
    },
  },
};

function migratePersistedState(persistedState: unknown): UserState {
  if (!persistedState || typeof persistedState !== "object") {
    return INITIAL_STATE;
  }

  const raw = persistedState as Record<string, unknown>;
  const legacyIdentity = raw.identity as Partial<UserIdentityState> | undefined;
  const legacyProgression = raw.progression as
    | (Partial<UserProgressionState> & {
        streak?: number;
        longestStreak?: number;
        coursesCompleted?: number;
      })
    | undefined;
  const legacyWallet = raw.wallet as Partial<UserWalletState> | undefined;
  const legacyNavigation = raw.navigation as Partial<UserNavigationState> | undefined;
  const legacyPreferences = raw.preferences as Partial<UserPreferences> | undefined;
  const legacyOnboarding = raw.onboarding as Partial<UserOnboardingState> | undefined;

  const serverBacked = raw.serverBacked as Partial<ServerBackedUserState> | undefined;
  const clientOnly = raw.clientOnly as Partial<ClientOnlyUserState> | undefined;

  const mergedPreferences: UserPreferences = {
    ...INITIAL_STATE.clientOnly.preferences,
    ...(legacyPreferences || {}),
    ...((clientOnly?.preferences as Partial<UserPreferences> | undefined) || {}),
  };

  mergedPreferences.preferredLanguage = resolveLanguageLabel(
    mergedPreferences.preferredLanguage
  );

  return {
    serverBacked: {
      identity: {
        ...INITIAL_STATE.serverBacked.identity,
        ...(legacyIdentity || {}),
        ...((serverBacked?.identity as Partial<UserIdentityState> | undefined) || {}),
      },
      progression: {
        ...INITIAL_STATE.serverBacked.progression,
        ...(legacyProgression || {}),
        ...((serverBacked?.progression as Partial<UserProgressionState> | undefined) || {}),
      },
      wallet: {
        ...INITIAL_STATE.serverBacked.wallet,
        ...(legacyWallet || {}),
        ...((serverBacked?.wallet as Partial<UserWalletState> | undefined) || {}),
      },
    },
    clientOnly: {
      navigation: {
        ...INITIAL_STATE.clientOnly.navigation,
        ...(legacyNavigation || {}),
        ...((clientOnly?.navigation as Partial<UserNavigationState> | undefined) || {}),
      },
      preferences: {
        ...mergedPreferences,
      },
      onboarding: {
        ...INITIAL_STATE.clientOnly.onboarding,
        ...(legacyOnboarding || {}),
        ...((clientOnly?.onboarding as Partial<UserOnboardingState> | undefined) || {}),
      },
      metrics: {
        ...INITIAL_STATE.clientOnly.metrics,
        streak:
          (clientOnly?.metrics as Partial<ClientOnlyUserState["metrics"]> | undefined)
            ?.streak ??
          legacyProgression?.streak ??
          INITIAL_STATE.clientOnly.metrics.streak,
        longestStreak:
          (clientOnly?.metrics as Partial<ClientOnlyUserState["metrics"]> | undefined)
            ?.longestStreak ??
          legacyProgression?.longestStreak ??
          INITIAL_STATE.clientOnly.metrics.longestStreak,
        coursesCompleted:
          (clientOnly?.metrics as Partial<ClientOnlyUserState["metrics"]> | undefined)
            ?.coursesCompleted ??
          legacyProgression?.coursesCompleted ??
          INITIAL_STATE.clientOnly.metrics.coursesCompleted,
      },
    },
  };
}

const useUserStore = create<UserState & UserActions>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setName: (name) =>
        set((state) => ({
          serverBacked: {
            ...state.serverBacked,
            identity: { ...state.serverBacked.identity, name },
          },
        })),

      setTitle: (title) =>
        set((state) => ({
          serverBacked: {
            ...state.serverBacked,
            identity: { ...state.serverBacked.identity, title },
          },
        })),

      incrementStreak: () =>
        set((state) => ({
          clientOnly: {
            ...state.clientOnly,
            metrics: {
              ...state.clientOnly.metrics,
              streak: state.clientOnly.metrics.streak + 1,
              longestStreak: Math.max(
                state.clientOnly.metrics.longestStreak,
                state.clientOnly.metrics.streak + 1
              ),
            },
          },
        })),

      resetStreak: () =>
        set((state) => ({
          clientOnly: {
            ...state.clientOnly,
            metrics: {
              ...state.clientOnly.metrics,
              streak: 0,
            },
          },
        })),

      incrementCoursesCompleted: () =>
        set((state) => ({
          clientOnly: {
            ...state.clientOnly,
            metrics: {
              ...state.clientOnly.metrics,
              coursesCompleted: state.clientOnly.metrics.coursesCompleted + 1,
            },
          },
        })),

      setLastActiveCourse: (courseId) =>
        set((state) => ({
          clientOnly: {
            ...state.clientOnly,
            navigation: {
              ...state.clientOnly.navigation,
              lastActiveCourseId: courseId,
            },
          },
        })),

      setLastActiveNode: (nodeId) =>
        set((state) => ({
          clientOnly: {
            ...state.clientOnly,
            navigation: {
              ...state.clientOnly.navigation,
              lastActiveNodeId: nodeId,
            },
          },
        })),

      setPreferences: (prefs) =>
        set((state) => ({
          clientOnly: {
            ...state.clientOnly,
            preferences: { ...state.clientOnly.preferences, ...prefs },
          },
        })),

      completeOnboarding: ({ name, topics, goal }) =>
        set((state) => ({
          serverBacked: {
            ...state.serverBacked,
            identity: {
              ...state.serverBacked.identity,
              name,
            },
          },
          clientOnly: {
            ...state.clientOnly,
            onboarding: {
              onboarded: true,
              selectedTopics: topics,
              dailyGoal: goal,
            },
          },
        })),

      syncFromProfile: (profile) =>
        set((state) => ({
          serverBacked: {
            identity: {
              name:
                profile.full_name?.trim() ||
                profile.email.split("@")[0] ||
                state.serverBacked.identity.name,
              title: profile.job_title?.trim() || titleForLevel(profile.level),
            },
            progression: {
              xp: profile.xp,
              level: profile.level,
              xpToNextLevel: profile.xp_to_next_level,
            },
            wallet: {
              credits: profile.credits,
            },
          },
          clientOnly: {
            ...state.clientOnly,
            preferences: {
              ...state.clientOnly.preferences,
              preferredLanguage: resolveLanguageLabel(profile.preferred_language),
            },
            onboarding: deriveOnboardingStateFromProfile(profile),
          },
        })),

      logout: () => set(INITIAL_STATE),
    }),
    {
      name: "learn8-user",
      version: 6,
      migrate: (persistedState) => migratePersistedState(persistedState),
    }
  )
);

export function selectUserName(state: UserState) {
  return state.serverBacked.identity.name;
}

export function selectUserTitle(state: UserState) {
  return state.serverBacked.identity.title;
}

export function selectUserXp(state: UserState) {
  return state.serverBacked.progression.xp;
}

export function selectUserLevel(state: UserState) {
  return state.serverBacked.progression.level;
}

export function selectUserXpToNextLevel(state: UserState) {
  return state.serverBacked.progression.xpToNextLevel;
}

export function selectAvailableCredits(state: UserState) {
  return state.serverBacked.wallet.credits;
}

export function selectUserPreferences(state: UserState) {
  return state.clientOnly.preferences;
}

export function selectLastActiveNodeId(state: UserState) {
  return state.clientOnly.navigation.lastActiveNodeId;
}

export function selectUserProgression(state: UserState) {
  return state.serverBacked.progression;
}

export default useUserStore;
