"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import GameButton from "@/components/ui/GameButton";

export function ArenaFeedbackOverlay({
  type,
  onContinue,
  showConfetti,
}: {
  type: "correct" | "incorrect";
  onContinue: () => void;
  showConfetti: boolean;
}) {
  const isCorrect = type === "correct";

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 z-50"
    >
      {showConfetti && <ConfettiParticles />}

      <div
        className={`relative rounded-t-3xl px-6 pt-6 pb-8 shadow-2xl ${
          isCorrect
            ? "bg-gradient-to-br from-[#e8fce8] to-[#c9f5c9]"
            : "bg-gradient-to-br from-[#fde8e8] to-[#f5c9c9]"
        }`}
      >
        <div className="mb-5 flex items-center gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              isCorrect ? "bg-brand-green" : "bg-brand-coral"
            }`}
          >
            {isCorrect ? (
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            )}
          </div>

          <div>
            <h3
              className={`font-heading text-2xl font-extrabold ${
                isCorrect ? "text-green-700" : "text-red-600"
              }`}
            >
              {isCorrect ? "Excellent!" : "Not quite right"}
            </h3>
            <p className={`text-sm ${isCorrect ? "text-green-600" : "text-red-500"}`}>
              {isCorrect
                ? "You matched all pairs correctly!"
                : "Review the pairs and try again."}
            </p>
          </div>
        </div>

        <GameButton
          variant={isCorrect ? "primary" : "secondary"}
          onClick={onContinue}
          className="w-full"
        >
          {isCorrect ? "CONTINUE" : "GOT IT"}
        </GameButton>
      </div>
    </motion.div>
  );
}

function ConfettiParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 1.5 + Math.random() * 1.5,
        color: ["#58CC02", "#FFD700", "#E8734A", "#7AC7C4", "#FF6BA8", "#4FC3F7"][
          i % 6
        ],
        size: 4 + Math.random() * 6,
        rotation: Math.random() * 360,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ y: -20, x: `${particle.x}vw`, opacity: 1, rotate: 0 }}
          animate={{
            y: "100vh",
            rotate: particle.rotation + 720,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: "easeIn",
          }}
          className="absolute top-0"
          style={{
            width: particle.size,
            height: particle.size,
            borderRadius: particle.size > 7 ? "2px" : "50%",
            backgroundColor: particle.color,
          }}
        />
      ))}
    </div>
  );
}
