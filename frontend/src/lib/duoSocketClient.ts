import { io, Socket } from "socket.io-client";
import { useDuoStore } from "@/stores/session/useDuoStore";

// In production (GitHub Pages), connect to the deployed Render server.
// In development, fall back to localhost:3001.
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://ui-duo-server.onrender.com"
    : "http://localhost:3001");

let socket: Socket | null = null;
let listenersAttached = false;

/* ═══════════════════ Socket Singleton ═══════════════════ */

function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: false });
  }
  if (!listenersAttached) {
    attachListeners(socket);
    listenersAttached = true;
  }
  return socket;
}

/* ═══════════════════ Event Listeners ═══════════════════ */

function attachListeners(s: Socket) {
  const set = useDuoStore.setState;

  s.on("matched", ({ roomId, opponentName }: { roomId: string; opponentName: string }) => {
    set({ roomId, opponentName, phase: "matched" });
  });

  s.on(
    "question",
    ({
      questionIndex,
      prompt,
      options,
      totalQuestions,
      timeLimit,
      isLastQuestion,
    }: {
      questionIndex: number;
      prompt: string;
      options: string[];
      totalQuestions: number;
      timeLimit: number;
      isLastQuestion: boolean;
    }) => {
      set({
        phase: "playing",
        questionIndex,
        currentQuestion: { prompt, options },
        totalQuestions,
        timeLeft: timeLimit,
        timeLimit,
        isLastQuestion,
        playerChoice: null,
        opponentChoice: null,
        correctAnswerIndex: null,
        playerGain: 0,
        opponentGain: 0,
        answerFx: null,
        opponentAnswered: false,
      });
    },
  );

  s.on("tick", ({ timeLeft }: { timeLeft: number }) => {
    set({ timeLeft });
  });

  s.on(
    "roundResult",
    ({
      correctAnswerIndex,
      playerCorrect,
      playerScore,
      opponentScore,
      playerGain,
      opponentGain,
      playerChoice,
      opponentChoice,
    }: {
      correctAnswerIndex: number;
      playerCorrect: boolean;
      opponentCorrect: boolean;
      playerScore: number;
      opponentScore: number;
      playerGain: number;
      opponentGain: number;
      playerChoice: number | null;
      opponentChoice: number | null;
    }) => {
      set({
        phase: "revealing",
        correctAnswerIndex,
        playerScore,
        opponentScore,
        playerGain,
        opponentGain,
        playerChoice,
        opponentChoice,
        answerFx: playerCorrect ? "correct" : "wrong",
      });
    },
  );

  s.on(
    "gameOver",
    ({
      playerScore,
      opponentScore,
      winner,
    }: {
      playerScore: number;
      opponentScore: number;
      winner: "player" | "opponent" | "draw";
    }) => {
      set({ phase: "finished", playerScore, opponentScore, winner });
    },
  );

  s.on(
    "opponentDisconnected",
    ({ playerScore, opponentScore }: { playerScore: number; opponentScore: number }) => {
      set({
        phase: "finished",
        playerScore,
        opponentScore,
        winner: "player",
        opponentDisconnected: true,
      });
    },
  );

  s.on("opponentAnswered", () => {
    set({ opponentAnswered: true });
  });
}

/* ═══════════════════ Public API ═══════════════════ */

export function connectAndJoinQueue(playerName: string) {
  const s = getSocket();
  useDuoStore.setState({ phase: "waiting" });

  if (!s.connected) {
    s.connect();
    s.once("connect", () => {
      s.emit("joinQueue", { playerName });
    });
  } else {
    s.emit("joinQueue", { playerName });
  }
}

export function leaveQueue() {
  if (socket?.connected) {
    socket.emit("leaveQueue");
  }
}

export function submitAnswer(optionIndex: number) {
  if (socket?.connected) {
    socket.emit("submitAnswer", { optionIndex });
  }
}

export function disconnectDuo() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    listenersAttached = false;
  }
  useDuoStore.getState().reset();
}
