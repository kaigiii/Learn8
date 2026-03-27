"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import TopStatsBar from "@/components/layout/TopStatsBar";
import GameButton from "@/components/ui/GameButton";
import { useDuoStore } from "@/stores/session/useDuoStore";
import { connectAndJoinQueue, leaveQueue, disconnectDuo } from "@/lib/duoSocketClient";
import useUserStore from "@/stores/app/useUserStore";

export default function DuoWaitingPage() {
  const router = useRouter();
  const phase = useDuoStore((s) => s.phase);
  const opponentName = useDuoStore((s) => s.opponentName);
  const playerName = useUserStore((s) => s.name);

  // Connect to socket server and join matchmaking queue
  useEffect(() => {
    connectAndJoinQueue(playerName);

    return () => {
      // Only leave queue if we haven't matched yet
      if (useDuoStore.getState().phase === "waiting") {
        leaveQueue();
      }
    };
  }, [playerName]);

  // Navigate to battle page once matched
  useEffect(() => {
    if (phase !== "matched") return;
    const next = window.setTimeout(() => {
      router.push("/duo/battle");
    }, 1500);
    return () => window.clearTimeout(next);
  }, [phase, router]);

  const handleCancel = () => {
    disconnectDuo();
    router.push("/duo");
  };

  const matched = phase === "matched";

  return (
    <div className="min-h-screen">
      <TopStatsBar />

      <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <h1 className="text-center font-heading text-3xl font-extrabold text-brand-gray-700 md:text-5xl">
          Find Your Match: Duel
        </h1>

        <section className="mt-8 grid grid-cols-1 items-center gap-6 md:mt-10 md:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-[2rem] border border-white/70 bg-white/45 p-4 shadow-xl backdrop-blur-md">
            <div className="flex h-[260px] items-center justify-center rounded-3xl bg-brand-teal/10 shadow-inner md:h-[320px]">
              <div className="text-[130px] leading-none md:text-[160px]">🐵</div>
            </div>
            <div className="mt-4 rounded-xl bg-white/50 py-3 text-center font-heading text-3xl font-bold text-brand-gray-700 md:text-4xl">
              {playerName}
            </div>
          </div>

          <div className="text-center font-heading text-7xl font-extrabold text-brand-gray-600 drop-shadow md:text-8xl">VS</div>

          <motion.div
            className="rounded-[2rem] border border-white/70 bg-white/45 p-4 shadow-xl backdrop-blur-md"
            animate={matched ? { scale: [1, 1.03, 1] } : { scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex h-[260px] items-center justify-center rounded-3xl bg-brand-teal/10 shadow-inner md:h-[320px]">
              <AnimatePresence mode="wait">
                {matched ? (
                  <motion.div
                    key="found"
                    initial={{ opacity: 0, scale: 0.7, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[130px] leading-none md:text-[160px]"
                  >
                    🐯
                  </motion.div>
                ) : (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-20 w-20 rounded-full border-[7px] border-brand-teal/20 border-t-brand-teal/70 animate-spin"
                  />
                )}
              </AnimatePresence>
            </div>
            <GameButton className="mt-4 w-full text-2xl" disabled>
              {matched ? `對手：${opponentName}` : "尋找對手中..."}
            </GameButton>
          </motion.div>
        </section>

        {!matched && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-xl border border-brand-gray-300 bg-white/70 px-6 py-3 font-heading text-lg font-bold text-brand-gray-600 shadow-sm transition hover:bg-white"
            >
              取消配對
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
