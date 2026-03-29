"use client";

import OrderingQuestion from "@/components/arena/OrderingQuestion";
import type { ArenaStagePlugin, ArenaStageRendererProps } from "./types";

export function renderOrderingStage({
  stage,
  lesson,
  actions,
}: ArenaStageRendererProps) {
  return (
    <OrderingQuestion
      key={`backend-order-${lesson.stageIdx}`}
      stage={stage}
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
      onSubmit={(input) => actions.onSubmitStage(stage, { order: input })}
      onContinue={actions.onContinue}
      onSkip={() => void actions.onSkipStage(stage)}
    />
  );
}

export const orderingPlugin: ArenaStagePlugin = {
  component: "Ordering",
  render: renderOrderingStage,
};
