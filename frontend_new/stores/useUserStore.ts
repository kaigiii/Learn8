import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "@/lib/types";

/* ═══════════════════ Types ═══════════════════ */

export interface UserPreferences {
  soundOn: boolean;
  darkGlass: boolean;
  difficulty: number; // 0-100
}

export interface UserState {
  /* ── Identity ── */
  name: string;
  title: string;
  /* ── Progression ── */
  xp: number;
  level: number;
  xpToNextLevel: number;
  streak: number;
  longestStreak: number;
  gems: number;
  coursesCompleted: number;
  /* ── Navigation ── */
  lastActiveCourseId: string | null;
  lastActiveNodeId: string | null;
  /* ── Preferences ── */
  preferences: UserPreferences;
  /* ── Onboarding ── */
  onboarded: boolean;
  selectedTopics: string[];
  dailyGoal: string;
}

export interface UserActions {
  /* ── Identity ── */
  setName: (name: string) => void;
  setTitle: (title: string) => void;
  /* ── XP & Leveling ── */
  addXp: (amount: number) => void;
  /* ── Gems ── */
  addGems: (amount: number) => void;
  spendGems: (amount: number) => boolean; // returns false if insufficient
  /* ── Streak ── */
  incrementStreak: () => void;
  resetStreak: () => void;
  /* ── Courses ── */
  incrementCoursesCompleted: () => void;
  /* ── Navigation ── */
  setLastActiveCourse: (courseId: string) => void;
  setLastActiveNode: (nodeId: string) => void;
  /* ── Preferences ── */
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  /* ── Onboarding ── */
  completeOnboarding: (data: {
    name: string;
    topics: string[];
    goal: string;
  }) => void;
  syncFromProfile: (profile: UserProfile) => void;
  /* ── Reset ── */
  logout: () => void;
}

/* ═══════════════════ Helpers ═══════════════════ */

/** XP required for a given level */
function xpForLevel(level: number): number {
  return 100 + (level - 1) * 50; // Level 1 = 100, Level 2 = 150, etc.
}

const INITIAL_STATE: UserState = {
  name: "Explorer",
  title: "Novice Learner",
  xp: 0,
  level: 1,
  xpToNextLevel: xpForLevel(1),
  streak: 12,
  longestStreak: 28,
  gems: 1500,
  coursesCompleted: 3,
  lastActiveCourseId: null,
  lastActiveNodeId: null,
  preferences: {
    soundOn: true,
    darkGlass: true,
    difficulty: 50,
  },
  onboarded: false,
  selectedTopics: [],
  dailyGoal: "",
};

/* ═══════════════════ Store ═══════════════════ */

const useUserStore = create<UserState & UserActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      /* ── Identity ── */
      setName: (name) => set({ name }),
      setTitle: (title) => set({ title }),

      /* ── XP & Leveling ── */
      addXp: (amount) => {
        const state = get();
        let newXp = state.xp + amount;
        let newLevel = state.level;
        let xpNeeded = state.xpToNextLevel;
        let newTitle = state.title;

        // Level-up loop (handle multi-level jumps)
        while (newXp >= xpNeeded) {
          newXp -= xpNeeded;
          newLevel += 1;
          xpNeeded = xpForLevel(newLevel);
          // Update title based on level
          if (newLevel >= 20) newTitle = "Grandmaster Scholar";
          else if (newLevel >= 15) newTitle = "Master Scholar";
          else if (newLevel >= 10) newTitle = "Expert Scholar";
          else if (newLevel >= 5) newTitle = "Quantum Scholar";
          else if (newLevel >= 3) newTitle = "Apprentice Scholar";
          else newTitle = "Novice Learner";
        }

        set({
          xp: newXp,
          level: newLevel,
          xpToNextLevel: xpNeeded,
          title: newTitle,
        });
      },

      /* ── Gems ── */
      addGems: (amount) => set((s) => ({ gems: s.gems + amount })),
      spendGems: (amount) => {
        const state = get();
        if (state.gems < amount) return false;
        set({ gems: state.gems - amount });
        return true;
      },

      /* ── Streak ── */
      incrementStreak: () =>
        set((s) => ({
          streak: s.streak + 1,
          longestStreak: Math.max(s.longestStreak, s.streak + 1),
        })),
      resetStreak: () => set({ streak: 0 }),

      /* ── Courses ── */
      incrementCoursesCompleted: () =>
        set((s) => ({ coursesCompleted: s.coursesCompleted + 1 })),

      /* ── Navigation ── */
      setLastActiveCourse: (courseId) =>
        set({ lastActiveCourseId: courseId }),
      setLastActiveNode: (nodeId) => set({ lastActiveNodeId: nodeId }),

      /* ── Preferences ── */
      setPreferences: (prefs) =>
        set((s) => ({
          preferences: { ...s.preferences, ...prefs },
        })),

      /* ── Onboarding ── */
      completeOnboarding: ({ name, topics, goal }) =>
        set({
          name,
          selectedTopics: topics,
          dailyGoal: goal,
          onboarded: true,
        }),

      syncFromProfile: (profile) =>
        set((state) => ({
          name:
            profile.full_name?.trim() ||
            profile.email.split("@")[0] ||
            state.name,
          title: profile.job_title?.trim() || state.title,
          gems: profile.credits,
        })),

      /* ── Reset ── */
      logout: () => set(INITIAL_STATE),
    }),
    {
      name: "learn8-user",
    }
  )
);

export default useUserStore;
