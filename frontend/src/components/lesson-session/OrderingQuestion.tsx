"use client";

import { useEffect, useMemo, useState } from "react";
import { Reorder } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import type { SubmissionResponse } from "@/lib/apiTypes";
import type { LessonStage } from "@/lib/apiTypes";
import { useI18n } from "@/lib/i18n/useI18n";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import { QuestionVoiceReader } from "@/features/lesson-session/components/QuestionVoiceReader";
import type { QuestionStageMeta } from "./questionSharedTypes";
import { GripVertical, CheckCircle2, AlertCircle } from "lucide-react";

export interface OrderingQuestionProps extends QuestionStageMeta {
  stage: LessonStage;
  onSubmit: (input: string[]) => Promise<SubmissionResponse | void>;
  onContinue: () => void;
  onSkip: () => void;
  onChange?: (items: string[]) => void;
  hideChrome?: boolean;
  isRevealed?: boolean;
}

function getLabel(step: unknown) {
  if (typeof step === "string") return step;
  if (step && typeof step === "object") {
    const item = step as {
      text?: string;
      label?: string;
      content?: string;
      id?: string;
    };
    return item.text || item.label || item.content || item.id || "Step";
  }
  return String(step);
}

export default function OrderingQuestion({
  stage,
  stageIndex,
  totalStages,
  stageLabel,
  difficulty,
  recommendedDurationMinutes,
  onSubmit,
  onContinue,
  onSkip,
  onChange,
  hideChrome = false,
  isRevealed = false,
}: OrderingQuestionProps) {
  const { t } = useI18n();
  const stableDataSteps = JSON.stringify(stage.config.data?.steps || []);
  const stableInitialOrder = JSON.stringify(stage.config.initialState?.order || null);

  const initialItems = useMemo(() => {
    const rawSteps = Array.isArray(stage.config.data?.steps)
      ? stage.config.data.steps
      : [];
    
    // If revealed, use the rawSteps as the order
    const seeded = isRevealed 
      ? rawSteps 
      : (Array.isArray(stage.config.initialState?.order)
        ? stage.config.initialState.order
        : [...rawSteps].sort(() => Math.random() - 0.5));

    return seeded.map((step, index) => ({
      id: `step-${index}`,
      content: getLabel(step),
    }));
  }, [stableDataSteps, stableInitialOrder, stage.config.data?.steps, stage.config.initialState?.order, isRevealed]);

  const [items, setItems] = useState(initialItems);
  const [phase, setPhase] = useState<"editing" | "submitting" | "feedback">("editing");
  const [result, setResult] = useState<SubmissionResponse["result"] | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setItems(initialItems);
    setPhase("editing");
    setResult(null);
    setMessage("");
  }, [initialItems]);

  const handleSubmit = async () => {
    if (phase !== "editing") return;
    setPhase("submitting");
    const response = await onSubmit(items.map((item) => item.content));
    setResult(response?.result ?? null);
    setMessage(response?.message ?? "");
    setPhase("feedback");
  };

  const handleReorder = (nextItems: typeof items) => {
    if (phase !== "editing") return;
    setItems(nextItems);
    onChange?.(nextItems.map(i => i.content));
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className={`flex-1 min-h-0 overflow-y-auto pr-1 ${!hideChrome ? "lesson-session-scroll" : ""}`}>
        {!hideChrome && (
          <QuestionStageHeader
            stageIndex={stageIndex}
            totalStages={totalStages}
            stageLabel={stageLabel}
            topic={stage.topic}
            difficulty={difficulty}
            recommendedDurationMinutes={recommendedDurationMinutes}
            accentClassName="bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-teal-300/30"
            accentTextClassName="text-brand-teal"
            rightSlot={<QuestionVoiceReader text={stage.topic} />}
          />
        )}

        <Reorder.Group
          axis="y"
          values={items}
          onReorder={handleReorder}
          className="flex flex-col gap-3"
        >
          {items.map((item, index) => {
            const isCorrect = isRevealed || (phase === "feedback" && result === "correct");
            const isWrong = phase === "feedback" && result === "incorrect";

            return (
              <Reorder.Item 
                key={item.id} 
                value={item} 
                drag={!isRevealed && phase === "editing"}
                className="group cursor-grab active:cursor-grabbing"
              >
                <div className={`rounded-2xl border-2 border-b-4 px-5 py-4 font-heading font-bold shadow-sm transition-all duration-200 flex items-center justify-between gap-4 ${
                  isCorrect 
                    ? "border-brand-green bg-brand-green/5 text-brand-green" 
                    : isWrong
                      ? "border-brand-coral bg-brand-coral/5 text-brand-coral"
                      : "border-brand-gray-200 bg-white hover:border-brand-teal/50 hover:bg-brand-teal/5 text-brand-gray-700"
                }`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Number Badge */}
                    <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                      isCorrect
                        ? "bg-brand-green/10 border-brand-green/40 text-brand-green"
                        : isWrong
                          ? "bg-brand-coral/10 border-brand-coral/40 text-brand-coral"
                          : "bg-brand-teal/10 border-brand-teal/20 text-brand-teal group-hover:border-brand-teal/40"
                    }`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate pr-1">{item.content}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <QuestionVoiceReader text={item.content} mini />
                    {!isRevealed && phase === "editing" && (
                      <GripVertical className="w-4 h-4 text-brand-gray-300 group-hover:text-brand-teal transition-colors" />
                    )}
                  </div>
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        {phase === "feedback" && message ? (
          <div
            className={`mt-6 rounded-[2rem] p-5 flex items-start gap-3 border shadow-sm ${
              result === "correct"
                ? "bg-brand-green/5 border-brand-green/20 text-brand-green"
                : "bg-brand-coral/5 border-brand-coral/20 text-brand-coral"
            }`}
          >
            {result === "correct" ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-brand-green" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-brand-coral" />
            )}
            <div>
              <p className="text-sm font-bold">{message}</p>
            </div>
          </div>
        ) : null}
      </div>
      {!hideChrome && (
        <QuestionActionBar
          onSkip={onSkip}
          onContinue={phase === "feedback" ? onContinue : () => void handleSubmit()}
          continueLabel={
            phase === "feedback" 
              ? t("lesson.action.continue") 
              : phase === "submitting" 
              ? t("lesson.action.checking") 
              : t("lesson.action.checkOrder")
          }
          isContinueDisabled={phase === "submitting"}
        />
      )}
    </div>
  );
}
