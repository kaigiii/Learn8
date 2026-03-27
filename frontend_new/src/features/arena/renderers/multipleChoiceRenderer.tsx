"use client";

import dynamic from "next/dynamic";
import { StageComponentLoading, getCorrectOptionId, normalizeChoiceOptions } from "./shared";
import type { ArenaStagePlugin, ArenaStageRendererProps } from "./types";

const MultipleChoiceQuestion = dynamic(
  () => import("@/components/arena/MultipleChoiceQuestion"),
  { loading: () => <StageComponentLoading /> }
);

export function renderMultipleChoiceStage({
  stage,
  stageIdx,
  totalStages,
  nodeDescription,
  onSubmitStage,
  onSkipStage,
  onContinue,
  onHintUse,
}: ArenaStageRendererProps) {
  return (
    <MultipleChoiceQuestion
      key={`backend-mcq-${stageIdx}`}
      stageIndex={stageIdx}
      totalStages={totalStages}
      topic={stage.topic}
      description={nodeDescription}
      question={String((stage.config.data as { question?: string }).question || stage.topic)}
      options={normalizeChoiceOptions(stage)}
      correctId={getCorrectOptionId(stage)}
      feedbackMsg={{
        success: stage.feedback.success,
        error: stage.feedback.error,
        hint: "Eliminate the least likely options first.",
      }}
      onComplete={(selectedOptionId) =>
        void onSubmitStage(stage, { selectedOptionId })
      }
      onError={(selectedOptionId) =>
        void onSubmitStage(stage, { selectedOptionId })
      }
      onWrongAdvance={onContinue}
      onSkip={() => void onSkipStage(stage)}
      onHintUse={onHintUse}
    />
  );
}

export const multipleChoicePlugin: ArenaStagePlugin = {
  component: "MultipleChoice",
  render: renderMultipleChoiceStage,
};
