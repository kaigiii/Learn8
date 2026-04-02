import { create } from "zustand";

/* ═══════════════════ Types ═══════════════════ */

export interface LessonSessionState {
  /* ── Session ── */
  nodeId: string | null;
  courseId: string | null;
  totalStages: number;
  rewardEligible: boolean;
  resumedSession: boolean;
  currentStageIndex: number;
  /* ── Stage state ── */
  isCorrect: boolean | null;
  showFeedback: boolean;
  /* ── Score tracking ── */
  correctCount: number;
  incorrectCount: number;
  hintsUsed: number;
  /* ── Timing ── */
  startTime: number | null;
  endTime: number | null;
  /* ── Animation triggers ── */
  showConfetti: boolean;
  shakeScreen: boolean;
}

export interface LessonSessionActions {
  /* ── Session lifecycle ── */
  startSession: (opts: {
    nodeId: string;
    courseId: string;
    totalStages: number;
    rewardEligible?: boolean;
    resumedSession?: boolean;
  }) => void;
  endSession: () => void;
  /* ── Stage progression ── */
  nextStage: () => void;
  /* ── Answer evaluation ── */
  markCorrect: () => void;
  markIncorrect: () => void;
  /* ── Feedback ── */
  showFeedbackPanel: () => void;
  hideFeedbackPanel: () => void;
  /* ── Hints ── */
  useHint: () => void;
  /* ── Animation triggers ── */
  triggerConfetti: () => void;
  triggerShake: () => void;
  clearAnimations: () => void;
  /* ── Reset ── */
  resetLessonSession: () => void;
}

/* ═══════════════════ Initial State ═══════════════════ */

const INITIAL_STATE: LessonSessionState = {
  nodeId: null,
  courseId: null,
  totalStages: 0,
  rewardEligible: true,
  resumedSession: false,
  currentStageIndex: 0,
  isCorrect: null,
  showFeedback: false,
  correctCount: 0,
  incorrectCount: 0,
  hintsUsed: 0,
  startTime: null,
  endTime: null,
  showConfetti: false,
  shakeScreen: false,
};

/* ═══════════════════ Store ═══════════════════ */

const useLessonSessionStore = create<LessonSessionState & LessonSessionActions>()((set) => ({
  ...INITIAL_STATE,

  /* ── Session lifecycle ── */
  startSession: ({
    nodeId,
    courseId,
    totalStages,
    rewardEligible = true,
    resumedSession = false,
  }) =>
    set({
      ...INITIAL_STATE,
      nodeId,
      courseId,
      totalStages,
      rewardEligible,
      resumedSession,
      startTime: Date.now(),
    }),

  endSession: () =>
    set({
      endTime: Date.now(),
    }),

  /* ── Stage progression ── */
  nextStage: () =>
    set((s) => ({
      currentStageIndex: Math.min(s.currentStageIndex + 1, s.totalStages - 1),
      isCorrect: null,
      showFeedback: false,
      showConfetti: false,
      shakeScreen: false,
    })),

  /* ── Answer evaluation ── */
  markCorrect: () =>
    set((s) => ({
      isCorrect: true,
      correctCount: s.correctCount + 1,
    })),

  markIncorrect: () =>
    set((s) => ({
      isCorrect: false,
      incorrectCount: s.incorrectCount + 1,
    })),

  /* ── Feedback ── */
  showFeedbackPanel: () => set({ showFeedback: true }),
  hideFeedbackPanel: () => set({ showFeedback: false }),

  /* ── Hints ── */
  useHint: () => set((s) => ({ hintsUsed: s.hintsUsed + 1 })),

  /* ── Animation triggers ── */
  triggerConfetti: () => set({ showConfetti: true }),
  triggerShake: () => {
    set({ shakeScreen: true });
    setTimeout(() => set({ shakeScreen: false }), 500);
  },
  clearAnimations: () => set({ showConfetti: false, shakeScreen: false }),

  /* ── Reset ── */
  resetLessonSession: () => set(INITIAL_STATE),
}));

/** Derived: compute accuracy percentage */
export function getAccuracy(state: LessonSessionState): number {
  const total = state.correctCount + state.incorrectCount;
  if (total === 0) return 100;
  return Math.round((state.correctCount / total) * 100);
}

/** Derived: compute elapsed time string (e.g. "2m 14s") */
export function getElapsedTime(state: LessonSessionState): string {
  const start = state.startTime ?? Date.now();
  const end = state.endTime ?? Date.now();
  const secs = Math.floor((end - start) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** Derived: compute XP gained */
export function getXpGained(state: LessonSessionState): number {
  if (!state.rewardEligible) return 0;
  const accuracy = getAccuracy(state);
  const baseXp = 30;
  const bonus = Math.floor((accuracy / 100) * 20);
  const hintPenalty = state.hintsUsed * 5;
  return Math.max(10, baseXp + bonus - hintPenalty);
}

export function selectLessonSessionIdentity(state: LessonSessionState) {
  return {
    courseId: state.courseId,
    nodeId: state.nodeId,
    totalStages: state.totalStages,
    rewardEligible: state.rewardEligible,
    resumedSession: state.resumedSession,
    startTime: state.startTime,
    endTime: state.endTime,
  };
}

export function selectLessonSessionScoreState(state: LessonSessionState) {
  return {
    correctCount: state.correctCount,
    incorrectCount: state.incorrectCount,
    hintsUsed: state.hintsUsed,
  };
}

export default useLessonSessionStore;
