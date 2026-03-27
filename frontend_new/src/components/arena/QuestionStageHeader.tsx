"use client";

import { motion } from "framer-motion";

interface QuestionStageHeaderProps {
  stageIndex: number;
  totalStages: number;
  topic: string;
  accentClassName: string;
  accentTextClassName: string;
  subtitle?: string;
}

export function QuestionStageHeader({
  stageIndex,
  totalStages,
  topic,
  accentClassName,
  accentTextClassName,
  subtitle,
}: QuestionStageHeaderProps) {
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
      <div>
        <p
          className={`mb-0.5 text-[11px] font-bold uppercase tracking-wider ${accentTextClassName}`}
        >
          Stage {stageIndex + 1} of {totalStages}
          {subtitle ? ` ${subtitle}` : ""}
        </p>
        <h2 className="font-heading text-lg font-bold leading-snug text-brand-gray-700">
          {topic}
        </h2>
      </div>
    </motion.div>
  );
}
