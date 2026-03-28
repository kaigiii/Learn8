"use client";

import { useEffect, useMemo, useState } from "react";
import { Reorder } from "framer-motion";
import GameButton from "@/components/ui/GameButton";
import type { LessonStage } from "@/lib/apiTypes";
import { QuestionActionBar } from "./QuestionActionBar";
import { QuestionStageHeader } from "./QuestionStageHeader";
import type { QuestionStageMeta } from "./questionSharedTypes";

export interface OrderingQuestionProps extends QuestionStageMeta {
  stage: LessonStage;
  onSubmit: (input: string[]) => void;
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
  onSubmit,
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

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 arena-scroll">
        <QuestionStageHeader
          stageIndex={stageIndex}
          totalStages={totalStages}
          topic={stage.topic}
          accentClassName="bg-gradient-to-br from-brand-teal to-[#5fb3af] shadow-teal-300/30"
          accentTextClassName="text-brand-teal"
        />

        <Reorder.Group
          axis="y"
          values={items}
          onReorder={setItems}
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
      </div>

      <QuestionActionBar
        justify="end"
        rightSlot={
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
              onClick={() => onSubmit(items.map((item) => item.content))}
              className="min-w-[160px]"
            >
              CHECK ORDER
            </GameButton>
          </>
        }
      />
    </div>
  );
}
