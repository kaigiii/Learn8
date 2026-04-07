"use client";

import { useEffect, useMemo, useState } from "react";
import { Reorder } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import type { SubmissionResponse } from "@/lib/apiTypes";
import type { LessonStage } from "@/lib/apiTypes";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import type { QuestionStageMeta } from "./questionSharedTypes";

export interface OrderingQuestionProps extends QuestionStageMeta {
  stage: LessonStage;
  onSubmit: (input: string[]) => Promise<SubmissionResponse | void>;
  onContinue: () => void;
  onSkip: () => void;
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
}: OrderingQuestionProps) {
  const initialItems = useMemo(() => {
    const rawSteps = Array.isArray(stage.config.data?.steps)
      ? stage.config.data.steps
      : [];
    const seeded = Array.isArray(stage.config.initialState?.order)
      ? stage.config.initialState.order
      : [...rawSteps].sort(() => Math.random() - 0.5);

    return seeded.map((step, index) => ({
      id: `step-${index}`,
      content: getLabel(step),
    }));
  }, [stage]);

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
  };

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 lesson-session-scroll">
        <QuestionStageHeader
          stageIndex={stageIndex}
          totalStages={totalStages}
          stageLabel={stageLabel}
          topic={stage.topic}
          difficulty={difficulty}
          recommendedDurationMinutes={recommendedDurationMinutes}
          accentClassName="bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-teal-300/30"
          accentTextClassName="text-brand-teal"
        />

        <Reorder.Group
          axis="y"
          values={items}
          onReorder={handleReorder}
          className="flex flex-col gap-3"
        >
          {items.map((item) => (
            <Reorder.Item key={item.id} value={item}>
              <div className="rounded-2xl border-2 border-b-4 border-brand-gray-200 bg-white px-5 py-4 font-heading font-bold text-brand-gray-700 shadow-sm">
                {item.content}
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        {phase === "feedback" && message ? (
          <p
            className={`mt-4 text-sm font-medium ${
              result === "correct" ? "text-brand-green" : "text-red-500"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>

      <QuestionActionBar
        justify="end"
        rightSlot={
          phase === "feedback" ? (
            <GameButton
              variant="primary"
              onClick={onContinue}
              className="min-w-[140px]"
            >
              CONTINUE
            </GameButton>
          ) : (
            <>
            <GameButton
              variant="secondary"
              onClick={onSkip}
              className="min-w-[120px]"
            >
              SKIP
            </GameButton>
            <GameButton
              variant="primary"
              onClick={() => void handleSubmit()}
              className="min-w-[160px]"
              disabled={phase === "submitting"}
            >
              {phase === "submitting" ? "CHECKING..." : "CHECK ORDER"}
            </GameButton>
            </>
          )
        }
      />
    </div>
  );
}
