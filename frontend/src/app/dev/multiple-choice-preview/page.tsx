"use client";

import React, { useState } from "react";
import MultipleChoiceQuestion from "@/components/lesson-session/MultipleChoiceQuestion";
import type { QuestionFeedbackMessages } from "@/components/lesson-session/questionSharedTypes";

const mockOptions = [
  { id: "opt-1", text: "Don't Repeat Yourself (不要重複自己)" },
  { id: "opt-2", text: "Do Repeat Yourself (請重複自己)" },
  { id: "opt-3", text: "Design Reliable Yields (設計可靠產值)" },
];

const mockFeedback: QuestionFeedbackMessages = {
  success: "恭喜！DRY 原則確實是 Don't Repeat Yourself，避免重複程式碼以降低維護成本。",
  error: "答錯囉！請再想一想，DRY 原則主要是為了解決重複寫相同邏輯程式碼的問題。",
  hint: "提示：DRY 的第一個人稱代名詞是 'Yourself'，而 D 代表否定詞 'Don't'。",
};

export default function MultipleChoicePreviewPage() {
  const [key, setKey] = useState(0); // For resetting component state
  const [lastSelected, setLastSelected] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);

  const handleComplete = (selectedId: string) => {
    setLastSelected(selectedId);
    setIsDone(true);
    alert("作答正確！已觸發 onComplete");
  };

  const handleError = (selectedId: string) => {
    setLastSelected(selectedId);
    setIsDone(false);
  };

  const handleHintUse = async (): Promise<boolean> => {
    alert("已使用提示！排除兩個錯誤選項。");
    return true;
  };

  const handleReset = () => {
    setKey((prev) => prev + 1);
    setLastSelected(null);
    setIsDone(false);
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
              MultipleChoiceQuestion Preview
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
          <MultipleChoiceQuestion
            key={key}
            stageIndex={0}
            totalStages={1}
            stageLabel="觀念選擇"
            topic="軟體設計原則挑戰"
            difficulty="low"
            recommendedDurationMinutes={3}
            question="程式開發中，常聽到的「DRY 原則」指的是什麼？"
            options={mockOptions}
            correctId="opt-1"
            feedbackMsg={mockFeedback}
            onComplete={handleComplete}
            onError={handleError}
            onCorrectAdvance={handleReset}
            onWrongAdvance={() => alert("點擊了「我知道了」")}
            onHintUse={handleHintUse}
            onSkip={() => alert("跳過此關！")}
          />
        </div>

        {/* Debug Logger */}
        {lastSelected && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-white/5 font-mono text-[10px] text-slate-300">
            <span className="text-brand-teal font-black block mb-1">Developer Data Log:</span>
            <span>User Selected Option ID: {lastSelected} ({isDone ? "Correct" : "Incorrect"})</span>
          </div>
        )}
      </div>
    </div>
  );
}
