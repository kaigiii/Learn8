"use client";

import { motion } from "framer-motion";

interface QuestionStageHeaderProps {
  stageIndex: number;
  totalStages: number;
  stageLabel?: string;
  topic: string;
  difficulty?: "low" | "medium" | "high" | null;
  recommendedDurationMinutes?: number | null;
  accentClassName: string;
  accentTextClassName: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}

export function QuestionStageHeader({
  stageIndex,
  totalStages,
  stageLabel = "Stage",
  topic,
  difficulty,
  recommendedDurationMinutes,
  accentClassName,
  accentTextClassName,
  subtitle,
  rightSlot,
}: QuestionStageHeaderProps) {
  const difficultyLabel =
    difficulty === "high" ? "高" : difficulty === "medium" ? "中" : difficulty === "low" ? "低" : null;
  const durationLabel =
    typeof recommendedDurationMinutes === "number" && Number.isFinite(recommendedDurationMinutes)
      ? `${recommendedDurationMinutes} 分鐘`
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 mb-6 flex items-center gap-4"
    >
      <div
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl shadow-md ${accentClassName}`}
      >
        <span className="font-heading text-base font-extrabold text-white">
          {stageIndex + 1}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`mb-0.5 text-[11px] font-bold uppercase tracking-wider ${accentTextClassName}`}
        >
          {stageLabel} {stageIndex + 1} of {totalStages}
          {subtitle ? ` ${subtitle}` : ""}
        </p>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-lg font-bold leading-snug text-brand-gray-700">
            {topic}
          </h2>
          {rightSlot}
        </div>
        {difficultyLabel || durationLabel ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {difficultyLabel ? (
              <span className="rounded-full border border-white/80 bg-white/72 px-2.5 py-1 text-[11px] font-bold tracking-[0.14em] text-brand-gray-600">
                難易度 {difficultyLabel}
              </span>
            ) : null}
            {durationLabel ? (
              <span className="rounded-full border border-white/80 bg-white/72 px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] text-brand-gray-600">
                建議 {durationLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
