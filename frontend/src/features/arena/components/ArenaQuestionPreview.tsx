"use client";

import React from "react";
import { 
  FiList, 
  FiHash, 
  FiLayers, 
  FiMessageSquare, 
  FiBookOpen,
  FiCheckCircle
} from "react-icons/fi";

interface ArenaQuestionPreviewProps {
  prompt: string;
  questionType?: string;
  options: any[];
  correctOptionId?: string;
  difficulty?: string;
  isCompact?: boolean;
}

export default function ArenaQuestionPreview({
  prompt,
  questionType = "MultipleChoice",
  options = [],
  correctOptionId,
  difficulty = "normal",
  isCompact = false,
}: ArenaQuestionPreviewProps) {
  const renderContent = () => {
    switch (questionType) {
      case "MultipleChoice":
        return (
          <div className="grid grid-cols-1 gap-1.5">
            {options.map((option, idx) => {
              const isCorrect = option.id === correctOptionId;
              return (
                <div
                  key={option.id || idx}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1 transition ${
                    isCorrect 
                      ? "border-emerald-200 bg-emerald-50/50 text-emerald-700" 
                      : "border-white/50 bg-white/20 text-brand-gray-500"
                  }`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px] font-extrabold ${
                    isCorrect ? "border-emerald-300 bg-emerald-100" : "border-brand-gray-200 bg-white/50"
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="truncate">{option.text}</span>
                  {isCorrect && <FiCheckCircle className="ml-auto h-3 w-3 text-emerald-500" />}
                </div>
              );
            })}
          </div>
        );

      case "MatchingPairs":
        return (
          <div className="space-y-1.5 mt-1">
            {options.slice(0, 3).map((pair, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[10px]">
                <div className="flex-1 rounded bg-brand-teal/5 border border-brand-teal/10 px-2 py-1 truncate text-brand-gray-600">
                  {pair.left}
                </div>
                <div className="text-brand-teal">↔</div>
                <div className="flex-1 rounded bg-brand-teal/5 border border-brand-teal/10 px-2 py-1 truncate text-brand-gray-600">
                  {pair.right}
                </div>
              </div>
            ))}
            {options.length > 3 && <p className="text-[9px] text-center text-brand-gray-400">+{options.length - 3} more pairs</p>}
          </div>
        );

      case "Ordering":
        return (
          <div className="space-y-1 mt-1">
            {options.slice(0, 3).map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded bg-white/40 border border-white/60 px-2 py-1 text-[10px] text-brand-gray-600">
                <span className="font-bold text-brand-teal">{idx + 1}.</span>
                <span className="truncate">{typeof step === 'string' ? step : step.text || step.content}</span>
              </div>
            ))}
            {options.length > 3 && <p className="text-[9px] text-center text-brand-gray-400">+{options.length - 3} more steps</p>}
          </div>
        );

      case "FeynmanMirror":
        return (
          <div className="mt-1 rounded bg-amber-50/50 border border-amber-100 p-2 text-[10px] italic text-amber-700">
            <p className="line-clamp-2">"Explain this simply in your own words..."</p>
          </div>
        );

      case "ExplainerMedia":
        return (
          <div className="mt-1 space-y-1.5">
            <div className="rounded bg-sky-50/50 border border-sky-100 p-2 text-[10px] text-sky-700 line-clamp-2">
              Instructional content and reading material.
            </div>
            {options[0]?.bullets && (
              <div className="flex flex-wrap gap-1">
                {options[0].bullets.slice(0, 2).map((b: string, i: number) => (
                  <span key={i} className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[8px] text-sky-600 uppercase font-bold tracking-wider">
                    • {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return <div className="text-brand-gray-400 italic">Preview not available</div>;
    }
  };

  const getIcon = () => {
    switch (questionType) {
      case "MultipleChoice": return <FiList />;
      case "MatchingPairs": return <FiHash />;
      case "Ordering": return <FiLayers />;
      case "FeynmanMirror": return <FiMessageSquare />;
      case "ExplainerMedia": return <FiBookOpen />;
      default: return <FiList />;
    }
  };

  const getTypeLabel = () => {
    switch (questionType) {
      case "MultipleChoice": return "Multiple Choice";
      case "MatchingPairs": return "Matching Pairs";
      case "Ordering": return "Ordering";
      case "FeynmanMirror": return "Feynman Mirror";
      case "ExplainerMedia": return "Instructional";
      default: return questionType;
    }
  };

  return (
    <div className={`rounded-xl border border-white/60 bg-white/40 p-3 shadow-inner ${isCompact ? "text-[10px]" : "text-xs"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-brand-teal text-[10px]">{getIcon()}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-teal/70">
              {getTypeLabel()}
            </span>
          </div>
          <span className="font-bold text-brand-gray-700 line-clamp-2 leading-tight">
            {prompt}
          </span>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider text-[8px] ${
          difficulty === "hard" ? "bg-rose-100 text-rose-600" : 
          difficulty === "medium" || difficulty === "intermediate" || difficulty === "high" ? "bg-amber-100 text-amber-600" : 
          "bg-emerald-100 text-emerald-600"
        }`}>
          {difficulty}
        </span>
      </div>

      {renderContent()}
    </div>
  );
}
