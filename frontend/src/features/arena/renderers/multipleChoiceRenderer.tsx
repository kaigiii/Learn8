"use client";

import MultipleChoiceQuestion from "@/components/arena/MultipleChoiceQuestion";
import { getCorrectOptionId, normalizeChoiceOptions } from "./shared";
import type { ArenaStagePlugin, ArenaStageRendererProps } from "./types";

export function renderMultipleChoiceStage({
  stage,
  lesson,
  actions,
}: ArenaStageRendererProps) {
  return (
    <MultipleChoiceQuestion
      key={`backend-mcq-${lesson.stageIdx}`}
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
      description={lesson.nodeDescription}
      question={String((stage.config.data as { question?: string }).question || stage.topic)}
      options={normalizeChoiceOptions(stage)}
      correctId={getCorrectOptionId(stage)}
      feedbackMsg={{
        success: stage.feedback.success,
        error: stage.feedback.error,
        hint: "Eliminate the least likely options first.",
      }}
      onComplete={(selectedOptionId) =>
        void actions.onSubmitStage(stage, { selectedOptionId })
      }
      onError={(selectedOptionId) =>
        void actions.onSubmitStage(stage, { selectedOptionId })
      }
      onCorrectAdvance={actions.onContinue}
      onWrongAdvance={actions.onContinue}
      onSkip={() => void actions.onSkipStage(stage)}
      onHintUse={actions.onHintUse}
    />
  );
}

export const multipleChoicePlugin: ArenaStagePlugin = {
  component: "MultipleChoice",
  render: renderMultipleChoiceStage,
};
