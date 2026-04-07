"use client";

import OrderingQuestion from "@/components/lesson-session/OrderingQuestion";
import { createLessonStagePlugin } from "../../renderers/types";
import type { LessonStageRenderContext } from "../../renderers/types";

export interface ParsedOrderingStageData {
  stage: LessonStageRenderContext["stage"];
}

export function parseOrderingStage(
  stage: LessonStageRenderContext["stage"]
): ParsedOrderingStageData {
  return {
    stage,
  };
}

export function OrderingStageRenderer({
  stage,
  lesson,
  actions,
}: LessonStageRenderContext) {
  return (
    <OrderingQuestion
      key={`backend-order-${stage.stageId}`}
      stage={stage}
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
      difficulty={stage.difficulty}
      recommendedDurationMinutes={stage.recommendedDurationMinutes}
      onSubmit={(input) => actions.submitStage(stage, { order: input })}
      onContinue={actions.continueStage}
      onSkip={() => void actions.skipStage(stage)}
    />
  );
}

export const orderingPlugin = createLessonStagePlugin(
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
