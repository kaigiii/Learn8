"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import TopStatsBar from "@/components/layout/TopStatsBar";
import { useDuoStore } from "@/stores/useDuoStore";
import { submitAnswer, disconnectDuo } from "@/lib/duoSocketClient";

const MAX_POSSIBLE_SCORE = 800;

export default function DuoBattlePage() {
  const router = useRouter();

  const phase = useDuoStore((s) => s.phase);
  const questionIndex = useDuoStore((s) => s.questionIndex);
  const totalQuestions = useDuoStore((s) => s.totalQuestions);
  const currentQuestion = useDuoStore((s) => s.currentQuestion);
  const timeLeft = useDuoStore((s) => s.timeLeft);
  const timeLimit = useDuoStore((s) => s.timeLimit);
  const isLastQuestion = useDuoStore((s) => s.isLastQuestion);
  const playerScore = useDuoStore((s) => s.playerScore);
  const opponentScore = useDuoStore((s) => s.opponentScore);
  const playerChoice = useDuoStore((s) => s.playerChoice);
  const correctAnswerIndex = useDuoStore((s) => s.correctAnswerIndex);
  const playerGain = useDuoStore((s) => s.playerGain);
  const answerFx = useDuoStore((s) => s.answerFx);
  const opponentAnswered = useDuoStore((s) => s.opponentAnswered);
  const winner = useDuoStore((s) => s.winner);
  const opponentDisconnected = useDuoStore((s) => s.opponentDisconnected);
  const opponentName = useDuoStore((s) => s.opponentName);

  // Redirect if not in a game
  useEffect(() => {
    if (useDuoStore.getState().phase === "idle") {
      router.replace("/duo");
    }
  }, [router]);

  const handleAnswer = (optionIndex: number) => {
    if (phase !== "playing" || playerChoice !== null) return;
    // Set locally for instant visual feedback
    useDuoStore.setState({ playerChoice: optionIndex });
    // Send to server (authoritative)
    submitAnswer(optionIndex);
  };

  const handleLeave = () => {
    disconnectDuo();
    router.push("/duo");
  };

  const progressPct = useMemo(() => {
    return Math.max(0, Math.round((timeLeft / timeLimit) * 100));
  }, [timeLeft, timeLimit]);

  const playerBarPct = useMemo(() => {
    return Math.min(100, Math.round((playerScore / MAX_POSSIBLE_SCORE) * 100));
  }, [playerScore]);

  const opponentBarPct = useMemo(() => {
    return Math.min(100, Math.round((opponentScore / MAX_POSSIBLE_SCORE) * 100));
  }, [opponentScore]);

  // Loading / waiting for first question
  if (!currentQuestion && phase !== "finished") {
    return (
      <div className="min-h-screen">
        <TopStatsBar backHref="/duo" pageTitle="Trivia Match: Two-player Game" />
        <main className="flex h-[calc(100vh-76px)] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full border-[6px] border-brand-teal/20 border-t-brand-teal/70 animate-spin" />
            <p className="mt-4 font-heading text-2xl font-bold text-brand-gray-600">準備開始...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopStatsBar backHref="/duo" pageTitle="Trivia Match: Two-player Game" />

      <main className="mx-auto h-[calc(100vh-76px)] w-full max-w-6xl overflow-hidden px-4 py-3 md:px-8 md:py-4">
        <section className="h-full rounded-3xl border border-white/70 bg-white/50 p-4 shadow-xl backdrop-blur-sm md:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
            <PlayerCard
              title="Player 1"
              name="You"
              score={playerScore}
              highlight={phase === "finished" && winner === "player"}
            />

            <div className="text-center">
              <div className="text-sm font-semibold text-brand-gray-500">剩餘時間</div>
              <div className="font-heading text-5xl font-extrabold text-brand-gray-700 md:text-6xl">{timeLeft}</div>
              <div className="mx-auto mt-2 h-3 w-full max-w-[220px] rounded-full bg-brand-gray-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-teal to-emerald-400 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-2 text-xs font-semibold text-brand-gray-500">
                第 {questionIndex + 1} / {totalQuestions} 題 {isLastQuestion ? "（本題雙倍）" : ""}
              </div>
              {opponentAnswered && phase === "playing" && playerChoice === null && (
                <div className="mt-1 text-xs font-bold text-amber-600">對手已作答！</div>
              )}
            </div>

            <PlayerCard
              title="Player 2"
              name={opponentName || "Opponent"}
              score={opponentScore}
              highlight={phase === "finished" && winner === "opponent"}
            />
          </div>

          {phase !== "finished" && currentQuestion ? (
            <>
              <div className={`relative mt-4 rounded-2xl p-1 ${answerFx === "wrong" ? "animate-shake" : ""}`}>
                <h2 className="text-center font-heading text-2xl font-extrabold leading-snug text-brand-gray-700 md:text-4xl">
                  {currentQuestion.prompt}
                </h2>

                {answerFx === "correct" && (
                  <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-full border border-emerald-300 bg-emerald-100 px-4 py-1 text-sm font-extrabold text-emerald-700 shadow-sm">
                    正確！+{playerGain} 分
                  </div>
                )}

                {answerFx === "wrong" && (
                  <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-full border border-rose-300 bg-rose-100 px-4 py-1 text-sm font-extrabold text-rose-700 shadow-sm">
                    錯誤，本題 +0
                  </div>
                )}

                {answerFx === "correct" && (
                  <>
                    <span className="pointer-events-none absolute left-6 top-8 h-3 w-3 rounded-full bg-emerald-400/80 animate-ping" />
                    <span className="pointer-events-none absolute right-8 top-10 h-2.5 w-2.5 rounded-full bg-teal-400/70 animate-ping" />
                    <span className="pointer-events-none absolute bottom-2 left-1/4 h-2 w-2 rounded-full bg-lime-400/70 animate-ping" />
                  </>
                )}
              </div>

              <div className="mt-2 grid grid-cols-[64px_1fr_64px] items-stretch gap-2 md:grid-cols-[74px_1fr_74px] md:gap-4">
                <VerticalScoreBar score={playerScore} fillPct={playerBarPct} />

                <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3">
                  {currentQuestion.options.map((option, idx) => {
                    const isCorrect = correctAnswerIndex !== null && idx === correctAnswerIndex;
                    const isSelected = playerChoice === idx;
                    const reveal = phase === "revealing";

                    let cls = "border-brand-gray-200 bg-white/70 hover:bg-white";
                    if (!reveal && isSelected) cls = "border-brand-teal bg-brand-teal/10";
                    if (reveal && isCorrect) cls = "border-emerald-500 bg-emerald-100";
                    if (reveal && isSelected && !isCorrect) cls = "border-rose-500 bg-rose-100";

                    return (
                      <button
                        key={option}
                        type="button"
                        disabled={phase !== "playing" || playerChoice !== null}
                        onClick={() => handleAnswer(idx)}
                        className={`rounded-2xl border px-4 py-3 text-left text-lg font-bold text-brand-gray-700 shadow-sm transition ${cls} disabled:cursor-not-allowed`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>

                <VerticalScoreBar score={opponentScore} fillPct={opponentBarPct} />
              </div>
            </>
          ) : (
            <div className="mt-10 rounded-2xl border border-white/70 bg-white/70 p-6 text-center shadow-md">
              {opponentDisconnected ? (
                <>
                  <h2 className="font-heading text-4xl font-extrabold text-brand-gray-700">
                    對手已斷線，你獲勝了！
                  </h2>
                  <p className="mt-3 text-lg text-brand-gray-600">
                    最終比分：你 {playerScore} : 對手 {opponentScore}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-heading text-4xl font-extrabold text-brand-gray-700">
                    {winner === "player" ? "你贏了！" : winner === "draw" ? "平手！" : "再挑戰一次！"}
                  </h2>
                  <p className="mt-3 text-lg text-brand-gray-600">
                    最終比分：你 {playerScore} : 對手 {opponentScore}
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={handleLeave}
                className="mt-6 rounded-xl bg-gradient-to-b from-[#58CC02] to-[#46a302] px-8 py-3 font-heading text-xl font-bold uppercase tracking-wide text-white shadow-lg"
              >
                返回大廳
              </button>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

function PlayerCard({
  title,
  name,
  score,
  highlight,
}: {
  title: string;
  name: string;
  score: number;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-white/70 p-4 shadow-sm ${highlight ? "border-emerald-400" : "border-brand-gray-200"}`}>
      <p className="text-center font-heading text-2xl font-extrabold text-brand-gray-700">{title}</p>
      <div className="mt-3 rounded-xl bg-brand-teal/10 py-4 text-center">
        <p className="text-base font-semibold text-brand-gray-600">{name}</p>
        <p className="mt-2 font-heading text-4xl font-extrabold text-brand-gray-700">{score}</p>
        <p className="text-xs font-semibold text-brand-gray-500">LIVE SCORE</p>
      </div>
    </div>
  );
}

function VerticalScoreBar({
  score,
  fillPct,
}: {
  score: number;
  fillPct: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mb-2 font-heading text-4xl font-extrabold leading-none text-brand-gray-700 md:text-6xl">
        {score}
      </div>
      <div className="w-9 rounded-xl border border-yellow-100 bg-[#f6f6c8] p-1.5 shadow-[0_0_14px_rgba(250,240,160,0.65)] md:w-11">
        <div className="relative h-[220px] overflow-hidden rounded-md bg-slate-700 md:h-[300px]">
          <div
            className="absolute bottom-0 left-0 w-full bg-[#f5ec98] transition-all duration-500"
            style={{ height: `${fillPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
