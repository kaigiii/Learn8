"use client";

import React, { useState } from "react";
import OrderingQuestion from "@/components/lesson-session/OrderingQuestion";
import type { LessonStage, SubmissionResponse } from "@/lib/apiTypes";

const mockStage: LessonStage = {
  stageId: "mock-ordering-stage",
  topic: "PDCA 階段流程排序",
  component: "Ordering",
  skin: "Classic",
  difficulty: "medium",
  recommendedDurationMinutes: 5,
  config: {
    data: {
      steps: [
        "Plan (規劃)：設定目標與行動方案",
        "Do (執行)：實地實施與落實工作",
        "Check (檢核)：評估執行成效與數據",
        "Act (行動)：修正偏差並標準化流程",
      ],
    },
    initialState: {
      order: null, // this will force shuffle
    },
  },
  validation: {
    type: "exact",
    condition: {},
  },
  feedback: {
    success: "恭喜！您排出了正確的 PDCA 循環流程。",
    error: "順序有誤。標準 PDCA 是 規劃(Plan) ➔ 執行(Do) ➔ 檢核(Check) ➔ 行動(Act)。",
  },
};

export default function OrderingPreviewPage() {
  const [key, setKey] = useState(0); // For resetting component state
  const [lastSubmission, setLastSubmission] = useState<string[] | null>(null);

  const handleSubmit = async (orderedItems: string[]): Promise<SubmissionResponse> => {
    setLastSubmission(orderedItems);
    
    // Check if the order is correct
    const correctOrder = mockStage.config.data.steps as string[];
    const isCorrect = 
      orderedItems.length === correctOrder.length &&
      orderedItems.every((val, idx) => val === correctOrder[idx]);

    return {
      result: isCorrect ? "correct" : "incorrect",
      message: isCorrect ? mockStage.feedback.success : mockStage.feedback.error,
      nextAction: isCorrect ? "proceed" : "review_later",
      recordedFailure: !isCorrect,
      evaluation: {},
    };
  };

  const handleReset = () => {
    setKey((prev) => prev + 1);
    setLastSubmission(null);
  };

  return (
    <div className="relative min-h-dvh app-shared-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_20px_50px_rgba(97,163,184,0.15)] rounded-[2.5rem] p-6 md:p-8 flex flex-col min-h-[500px]">
        
        {/* Preview Title */}
        <div className="mb-6 border-b border-brand-gray-100 pb-4 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">
              Component Developer Sandbox
            </span>
            <h1 className="text-xl font-black text-brand-gray-700 font-heading">
              OrderingQuestion Preview
            </h1>
          </div>
          <button
            onClick={handleReset}
            className="rounded-xl px-4 py-2 border border-brand-teal/30 bg-brand-teal/5 text-brand-teal text-xs font-bold hover:bg-brand-teal hover:text-white transition-all shadow-sm"
          >
            Reset Stage
          </button>
        </div>

        {/* The Component Frame */}
        <div className="flex-1 flex flex-col min-h-0">
          <OrderingQuestion
            key={key}
            stage={mockStage}
            stageIndex={0}
            totalStages={1}
            stageLabel="排序練習"
            topic={mockStage.topic}
            difficulty={mockStage.difficulty}
            recommendedDurationMinutes={mockStage.recommendedDurationMinutes}
            onSubmit={handleSubmit}
            onContinue={handleReset}
            onSkip={() => alert("Skipped!")}
          />
        </div>

        {/* Debug Logger */}
        {lastSubmission && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-white/5 font-mono text-[10px] text-slate-300">
            <span className="text-brand-teal font-black block mb-1">Developer Data Log:</span>
            <span>Current Order: {JSON.stringify(lastSubmission, null, 2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
