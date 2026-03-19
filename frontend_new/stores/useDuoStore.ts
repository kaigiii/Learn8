import { create } from "zustand";

/* ═══════════════════ Types ═══════════════════ */

export interface DuoState {
  /* ── Connection ── */
  phase: "idle" | "waiting" | "matched" | "playing" | "revealing" | "finished";
  roomId: string | null;
  opponentName: string | null;

  /* ── Question ── */
  questionIndex: number;
  totalQuestions: number;
  currentQuestion: { prompt: string; options: string[] } | null;
  timeLeft: number;
  timeLimit: number;
  isLastQuestion: boolean;

  /* ── Scores ── */
  playerScore: number;
  opponentScore: number;

  /* ── Round state ── */
  playerChoice: number | null;
  opponentChoice: number | null;
  correctAnswerIndex: number | null;
  playerGain: number;
  opponentGain: number;
  answerFx: "correct" | "wrong" | null;
  opponentAnswered: boolean;

  /* ── Outcome ── */
  winner: "player" | "opponent" | "draw" | null;
  opponentDisconnected: boolean;

  /* ── Actions ── */
  reset: () => void;
}

const INITIAL: Omit<DuoState, "reset"> = {
  phase: "idle",
  roomId: null,
  opponentName: null,
  questionIndex: 0,
  totalQuestions: 0,
  currentQuestion: null,
  timeLeft: 0,
  timeLimit: 10,
  isLastQuestion: false,
  playerScore: 0,
  opponentScore: 0,
  playerChoice: null,
  opponentChoice: null,
  correctAnswerIndex: null,
  playerGain: 0,
  opponentGain: 0,
  answerFx: null,
  opponentAnswered: false,
  winner: null,
  opponentDisconnected: false,
};

export const useDuoStore = create<DuoState>((set) => ({
  ...INITIAL,
  reset: () => set({ ...INITIAL }),
}));
