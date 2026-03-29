"use client";

import OrderingQuestion from "@/components/arena/OrderingQuestion";
import { createArenaStagePlugin } from "../../renderers/types";
import type { ArenaStageRenderContext } from "../../renderers/types";

export interface ParsedOrderingStageData {
  stage: ArenaStageRenderContext["stage"];
}

export function parseOrderingStage(
  stage: ArenaStageRenderContext["stage"]
): ParsedOrderingStageData {
  return {
    stage,
  };
}

export function OrderingStageRenderer({
  stage,
  lesson,
  actions,
}: ArenaStageRenderContext) {
  return (
    <OrderingQuestion
      key={`backend-order-${lesson.stageIdx}`}
      stage={stage}
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
      onSubmit={(input) => actions.submitStage(stage, { order: input })}
      onContinue={actions.continueStage}
      onSkip={() => void actions.skipStage(stage)}
    />
  );
}

export const orderingPlugin = createArenaStagePlugin(
  "Ordering",
  OrderingStageRenderer,
  {
    displayName: "Ordering",
    capabilities: {
      supportsHint: false,
      supportsSkip: true,
      usesFeedbackOverlay: false,
    },
  },
  parseOrderingStage
);
