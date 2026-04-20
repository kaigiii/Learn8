"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
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
      className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm"
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
    <div className="flex flex-1 flex-col min-h-0">
      <div className={`flex-1 min-h-0 overflow-y-auto pr-1 ${!hideChrome ? "lesson-session-scroll" : ""}`}>
        {!hideChrome && (
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
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-white/60 bg-white/75 px-6 py-5 shadow-sm backdrop-blur"
        >
          <h3 className="text-lg font-bold text-brand-gray-700">{title}</h3>
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
          <div className="mb-6 flex justify-center">{svgBlock}</div>
        ) : null}

        {showImage ? (
          <div className="mb-6 rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
            {hasImage ? (
              <img
                src={mediaUrl}
                alt={mediaDescription || title}
                className="w-full max-h-[300px] rounded-xl object-contain"
              />
            ) : (
              <div className="rounded-xl border border-dashed border-brand-gray-200 bg-brand-gray-50 px-4 py-6 text-center text-sm text-brand-gray-500">
                Image description only
              </div>
            )}
            {mediaDescription ? (
              <p className="mt-3 text-xs font-medium text-brand-gray-500">
                {mediaDescription}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {!hideChrome && (
        <QuestionActionBar
          justify="end"
          rightSlot={
            <GameButton variant="primary" onClick={onContinue} className="min-w-[160px]">
              CONTINUE
            </GameButton>
          }
        />
      )}
    </div>
  );
}
