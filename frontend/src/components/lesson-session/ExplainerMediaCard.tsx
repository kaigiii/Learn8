"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiMaximize2 } from "react-icons/fi";
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

function renderSvg(svg: string | undefined, onClick?: () => void) {
  if (!svg) return null;
  const trimmed = svg.trim();
  if (!trimmed.startsWith("<svg")) return null;
  return (
    <div
      onClick={onClick}
      className={`w-full max-w-3xl h-full flex justify-center items-center overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-2 shadow-sm [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:max-w-full [&>svg]:h-auto ${
        onClick ? "cursor-zoom-in hover:opacity-95 transition-opacity" : ""
      }`}
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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const showSvg = mediaType === "svg";
  const showImage = mediaType === "image";
  const svgBlock = showSvg ? renderSvg(mediaSvg, () => setIsLightboxOpen(true)) : null;
  const hasImage = Boolean(mediaUrl);
  const hasMedia = (showSvg && !!mediaSvg) || (showImage && hasImage);

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

        <div className={`flex-1 min-h-0 flex flex-col gap-4 mb-4 ${hasMedia ? "md:landscape:flex-row" : ""}`}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border border-white/60 bg-white/75 px-6 py-5 shadow-sm backdrop-blur lesson-session-scroll overflow-y-auto ${
              hasMedia
                ? "flex-shrink-0 md:landscape:flex-1 max-h-[35%] md:landscape:max-h-full"
                : "flex-1"
            }`}
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
            <div className="flex-1 min-h-0 flex justify-center items-center overflow-hidden">
              <div className="relative w-full max-w-3xl h-full group">
                {svgBlock}
                <button
                  onClick={() => setIsLightboxOpen(true)}
                  className="absolute bottom-5 right-5 bg-black/50 hover:bg-black/75 text-white p-2 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md flex items-center justify-center cursor-zoom-in"
                  title="Zoom SVG"
                >
                  <FiMaximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}

          {showImage && hasImage ? (
            <div className="flex-1 min-h-0 flex justify-center items-center overflow-hidden">
              <div className="w-full max-w-3xl h-full flex flex-col justify-center items-center overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-2 shadow-sm">
                <div className="relative max-h-full max-w-full flex items-center justify-center group">
                  <img
                    src={mediaUrl}
                    alt={mediaDescription || title}
                    className="max-h-full max-w-full object-contain rounded-xl cursor-zoom-in hover:opacity-90 transition-opacity"
                    onClick={() => setIsLightboxOpen(true)}
                  />
                  <button
                    onClick={() => setIsLightboxOpen(true)}
                    className="absolute bottom-3 right-3 bg-black/50 hover:bg-black/75 text-white p-2 rounded-xl backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-md flex items-center justify-center cursor-zoom-in"
                    title="Zoom image"
                  >
                    <FiMaximize2 className="w-4 h-4" />
                  </button>
                </div>
                {mediaDescription ? (
                  <p className="mt-2 text-xs font-medium text-brand-gray-500 flex-shrink-0">
                    {mediaDescription}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {!hideChrome && (
        <div className="flex-shrink-0">
          <QuestionActionBar onContinue={onContinue} />
        </div>
      )}

      {/* Lightbox / Zoom Overlay */}
      <AnimatePresence>
        {isLightboxOpen && hasMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out"
            onClick={() => setIsLightboxOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-5xl max-h-[90vh] flex flex-col items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 bg-white/10 hover:bg-white/20 p-2 rounded-full transition"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              
              {showImage && (
                <img
                  src={mediaUrl}
                  alt={mediaDescription || title}
                  className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/10"
                />
              )}
              
              {showSvg && mediaSvg && (
                <div
                  className="w-[90vw] max-w-4xl h-[70vh] flex justify-center items-center overflow-hidden rounded-2xl bg-white p-6 shadow-2xl [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:max-w-full [&>svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: mediaSvg.trim() }}
                />
              )}

              {mediaDescription ? (
                <p className="mt-4 text-sm font-medium text-white/95 bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">
                  {mediaDescription}
                </p>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
