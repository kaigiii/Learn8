"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import { QuestionVoiceReader } from "@/features/lesson-session/components/QuestionVoiceReader";
import type { QuestionStageMeta } from "./questionSharedTypes";

export interface ExplainerMediaCardProps extends QuestionStageMeta {
  title: string;
  explanation: string;
  bullets?: string[];
  mediaType?: "svg" | "image" | "none";
  mediaSvg?: string;
  mediaDescription?: string;
  mediaUrl?: string;
  onContinue: () => void;
  onMount?: () => void;
  hideChrome?: boolean;
}

function renderSvg(svg: string | undefined) {
  if (!svg) return null;
  const trimmed = svg.trim();
  if (!trimmed.startsWith("<svg")) return null;
  return (
    <div
      className="w-full max-w-3xl h-full flex justify-center items-center overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-2 shadow-sm [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:max-w-full [&>svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: trimmed }}
    />
  );
}

export default function ExplainerMediaCard({
  stageIndex,
  totalStages,
  stageLabel,
  topic,
  difficulty,
  recommendedDurationMinutes,
  title,
  explanation,
  bullets,
  mediaType = "none",
  mediaSvg,
  mediaDescription,
  mediaUrl,
  onContinue,
  onMount,
  hideChrome = false,
}: ExplainerMediaCardProps) {
  const showSvg = mediaType === "svg";
  const showImage = mediaType === "image";
  const svgBlock = showSvg ? renderSvg(mediaSvg) : null;
  const hasImage = Boolean(mediaUrl);

  useEffect(() => {
    onMount?.();
  }, [onMount]);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden pr-1">
        {!hideChrome && (
          <div className="flex-shrink-0">
            <QuestionStageHeader
              stageIndex={stageIndex}
              totalStages={totalStages}
              stageLabel={stageLabel}
              topic={topic}
              difficulty={difficulty}
              recommendedDurationMinutes={recommendedDurationMinutes}
              accentClassName="bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-teal-300/30"
              accentTextClassName="text-brand-teal"
              subtitle="Explainer"
            />
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0 mb-4 max-h-[35%] overflow-y-auto rounded-2xl border border-white/60 bg-white/75 px-6 py-5 shadow-sm backdrop-blur lesson-session-scroll"
        >
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-lg font-bold text-brand-gray-700">{title}</h3>
            <QuestionVoiceReader text={`${title}. ${explanation}`} />
          </div>
          <p className="mt-3 whitespace-pre-line text-sm font-medium leading-relaxed text-brand-gray-600">
            {explanation}
          </p>
          {Array.isArray(bullets) && bullets.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-brand-gray-600">
              {bullets.map((item, idx) => (
                <li key={`${idx}-${item}`} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-teal" />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </motion.div>

        {showSvg && svgBlock ? (
          <div className="flex-1 min-h-0 mb-4 flex justify-center items-center overflow-hidden">{svgBlock}</div>
        ) : null}

        {showImage && hasImage ? (
          <div className="flex-1 min-h-0 mb-4 flex justify-center items-center overflow-hidden">
            <div className="w-full max-w-3xl h-full flex flex-col justify-center items-center overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-2 shadow-sm">
              <img
                src={mediaUrl}
                alt={mediaDescription || title}
                className="max-h-full max-w-full object-contain rounded-xl"
              />
              {mediaDescription ? (
                <p className="mt-2 text-xs font-medium text-brand-gray-500 flex-shrink-0">
                  {mediaDescription}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {!hideChrome && (
        <div className="flex-shrink-0">
          <QuestionActionBar onContinue={onContinue} />
        </div>
      )}
    </div>
  );
}
