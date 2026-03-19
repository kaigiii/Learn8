const http = require("http");
const { Server } = require("socket.io");

// HTTP health-check endpoint (required by Render / Railway)
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Socket.IO server is running");
});

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

/* ═══════════════════ Config ═══════════════════ */

const QUESTION_TIME = 10; // seconds per question
const REVEAL_DELAY = 2500; // ms to show results before next question
const PRE_GAME_DELAY = 3000; // ms after match before first question

/* ═══════════════════ Question Bank ═══════════════════ */

const QUESTIONS = [
  {
    prompt: "哪個關鍵字可以定義 Python 函式？",
    options: ["func", "def", "lambda", "function"],
    answerIndex: 1,
  },
  {
    prompt: "以下哪個型別是可變（mutable）？",
    options: ["tuple", "str", "list", "int"],
    answerIndex: 2,
  },
  {
    prompt: "要輸出變數 x 的內容，正確語法是？",
    options: ["echo(x)", "console.log(x)", "print(x)", "printf(x)"],
    answerIndex: 2,
  },
  {
    prompt: "哪個符號在 Python 代表指數運算？",
    options: ["^", "**", "//", "%%"],
    answerIndex: 1,
  },
  {
    prompt: "哪個方法可把字串全部轉成小寫？",
    options: ["toLower()", "lower()", "smallcase()", "down()"],
    answerIndex: 1,
  },
];

/* ═══════════════════ State ═══════════════════ */

const waitingQueue = []; // { socketId, playerName }
const rooms = new Map(); // roomId → room

/* ═══════════════════ Helpers ═══════════════════ */

function generateRoomId() {
  return "room-" + Math.random().toString(36).substring(2, 8);
}

function calcScore(timeLeft, isLastQuestion) {
  const base = 40 + timeLeft * 8;
  return isLastQuestion ? base * 2 : base;
}

/* ═══════════════════ Room Logic ═══════════════════ */

function createRoom(player1, player2) {
  const roomId = generateRoomId();
  const questions = [...QUESTIONS];

  const room = {
    roomId,
    players: {
      [player1.socketId]: {
        socketId: player1.socketId,
        name: player1.playerName,
        score: 0,
        currentAnswer: null, // { optionIndex, timeLeft }
      },
      [player2.socketId]: {
        socketId: player2.socketId,
        name: player2.playerName,
        score: 0,
        currentAnswer: null,
      },
    },
    questions,
    currentQuestionIndex: -1,
    totalQuestions: questions.length,
    timer: null,
    timeLeft: 0,
    phase: "waiting", // waiting | playing | revealing | finished
  };

  rooms.set(roomId, room);

  const s1 = io.sockets.sockets.get(player1.socketId);
  const s2 = io.sockets.sockets.get(player2.socketId);
  if (s1) {
    s1.join(roomId);
    s1.data.roomId = roomId;
  }
  if (s2) {
    s2.join(roomId);
    s2.data.roomId = roomId;
  }

  return room;
}

function sendQuestion(room) {
  if (!rooms.has(room.roomId)) return;

  room.currentQuestionIndex++;
  const qi = room.currentQuestionIndex;
  const q = room.questions[qi];
  const isLast = qi === room.totalQuestions - 1;

  // Reset answers for new round
  for (const p of Object.values(room.players)) {
    p.currentAnswer = null;
  }

  room.phase = "playing";
  room.timeLeft = QUESTION_TIME;

  // Send question (WITHOUT answerIndex for anti-cheat)
  io.to(room.roomId).emit("question", {
    questionIndex: qi,
    prompt: q.prompt,
    options: q.options,
    totalQuestions: room.totalQuestions,
    timeLimit: QUESTION_TIME,
    isLastQuestion: isLast,
  });

  startTimer(room);
}

function startTimer(room) {
  if (room.timer) clearInterval(room.timer);

  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(room.roomId).emit("tick", { timeLeft: room.timeLeft });

    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      resolveRound(room);
    }
  }, 1000);
}

function resolveRound(room) {
  if (room.phase !== "playing") return;
  room.phase = "revealing";

  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }

  const qi = room.currentQuestionIndex;
  const q = room.questions[qi];
  const isLast = qi === room.totalQuestions - 1;
  const players = Object.values(room.players);

  // Calculate scores
  for (const p of players) {
    if (p.currentAnswer && p.currentAnswer.optionIndex === q.answerIndex) {
      const gain = calcScore(p.currentAnswer.timeLeft, isLast);
      p.score += gain;
      p.lastGain = gain;
      p.lastCorrect = true;
    } else {
      p.lastGain = 0;
      p.lastCorrect = false;
    }
  }

  const [p1, p2] = players;

  // Send personalised results to each player
  const s1 = io.sockets.sockets.get(p1.socketId);
  if (s1) {
    s1.emit("roundResult", {
      correctAnswerIndex: q.answerIndex,
      playerCorrect: p1.lastCorrect,
      opponentCorrect: p2.lastCorrect,
      playerScore: p1.score,
      opponentScore: p2.score,
      playerGain: p1.lastGain,
      opponentGain: p2.lastGain,
      playerChoice: p1.currentAnswer?.optionIndex ?? null,
      opponentChoice: p2.currentAnswer?.optionIndex ?? null,
    });
  }

  const s2 = io.sockets.sockets.get(p2.socketId);
  if (s2) {
    s2.emit("roundResult", {
      correctAnswerIndex: q.answerIndex,
      playerCorrect: p2.lastCorrect,
      opponentCorrect: p1.lastCorrect,
      playerScore: p2.score,
      opponentScore: p1.score,
      playerGain: p2.lastGain,
      opponentGain: p1.lastGain,
      playerChoice: p2.currentAnswer?.optionIndex ?? null,
      opponentChoice: p1.currentAnswer?.optionIndex ?? null,
    });
  }

  // Next question or game over
  if (isLast) {
    setTimeout(() => {
      if (!rooms.has(room.roomId)) return;
      room.phase = "finished";

      let winner1, winner2;
      if (p1.score > p2.score) {
        winner1 = "player";
        winner2 = "opponent";
      } else if (p2.score > p1.score) {
        winner1 = "opponent";
        winner2 = "player";
      } else {
        winner1 = "draw";
        winner2 = "draw";
      }

      const gs1 = io.sockets.sockets.get(p1.socketId);
      if (gs1) {
        gs1.emit("gameOver", {
          playerScore: p1.score,
          opponentScore: p2.score,
          winner: winner1,
        });
      }
      const gs2 = io.sockets.sockets.get(p2.socketId);
      if (gs2) {
        gs2.emit("gameOver", {
          playerScore: p2.score,
          opponentScore: p1.score,
          winner: winner2,
        });
      }

      rooms.delete(room.roomId);
    }, REVEAL_DELAY);
  } else {
    setTimeout(() => {
      if (rooms.has(room.roomId) && room.phase === "revealing") {
        sendQuestion(room);
      }
    }, REVEAL_DELAY);
  }
}

function checkBothAnswered(room) {
  const players = Object.values(room.players);
  if (players.every((p) => p.currentAnswer !== null)) {
    resolveRound(room);
  }
}

/* ═══════════════════ Socket Events ═══════════════════ */

io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  /* ── Matchmaking ── */
  socket.on("joinQueue", ({ playerName }) => {
    console.log(`[queue] ${playerName} (${socket.id})`);

    // Prevent duplicate entries
    const idx = waitingQueue.findIndex((w) => w.socketId === socket.id);
    if (idx !== -1) waitingQueue.splice(idx, 1);

    waitingQueue.push({ socketId: socket.id, playerName });

    if (waitingQueue.length >= 2) {
      const p1 = waitingQueue.shift();
      const p2 = waitingQueue.shift();
      const room = createRoom(p1, p2);

      const s1 = io.sockets.sockets.get(p1.socketId);
      const s2 = io.sockets.sockets.get(p2.socketId);

      if (s1) s1.emit("matched", { roomId: room.roomId, opponentName: p2.playerName });
      if (s2) s2.emit("matched", { roomId: room.roomId, opponentName: p1.playerName });

      // Start game after a short delay
      setTimeout(() => {
        if (rooms.has(room.roomId)) sendQuestion(room);
      }, PRE_GAME_DELAY);
    }
  });

  socket.on("leaveQueue", () => {
    const idx = waitingQueue.findIndex((w) => w.socketId === socket.id);
    if (idx !== -1) {
      waitingQueue.splice(idx, 1);
      console.log(`[leaveQueue] ${socket.id}`);
    }
  });

  /* ── Gameplay ── */
  socket.on("submitAnswer", ({ optionIndex }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room || room.phase !== "playing") return;

    const player = room.players[socket.id];
    if (!player || player.currentAnswer !== null) return; // already answered

    player.currentAnswer = {
      optionIndex,
      timeLeft: room.timeLeft,
    };

    console.log(`[answer] ${player.name} chose ${optionIndex} (${room.timeLeft}s left)`);

    // Notify opponent that this player has answered
    const opponentId = Object.keys(room.players).find((id) => id !== socket.id);
    if (opponentId) {
      const opponentSocket = io.sockets.sockets.get(opponentId);
      if (opponentSocket) opponentSocket.emit("opponentAnswered");
    }

    checkBothAnswered(room);
  });

  /* ── Disconnect ── */
  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);

    // Remove from queue
    const qIdx = waitingQueue.findIndex((w) => w.socketId === socket.id);
    if (qIdx !== -1) waitingQueue.splice(qIdx, 1);

    // Handle active room
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }

    // Award win to the remaining player
    const remainingId = Object.keys(room.players).find((id) => id !== socket.id);
    if (remainingId) {
      const remainingSocket = io.sockets.sockets.get(remainingId);
      if (remainingSocket) {
        remainingSocket.emit("opponentDisconnected", {
          playerScore: room.players[remainingId].score,
          opponentScore: room.players[socket.id].score,
        });
      }
    }

    rooms.delete(roomId);
  });
});

/* ═══════════════════ Start ═══════════════════ */

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
