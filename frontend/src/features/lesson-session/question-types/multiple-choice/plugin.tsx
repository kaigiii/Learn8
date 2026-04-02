"use client";

import MultipleChoiceQuestion from "@/components/lesson-session/MultipleChoiceQuestion";
import { getCorrectOptionId, normalizeChoiceOptions } from "../../renderers/shared";
import { createLessonStagePlugin } from "../../renderers/types";
import type { LessonStageRenderContext } from "../../renderers/types";

export interface ParsedMultipleChoiceStageData {
  question: string;
  options: { id: string; text: string }[];
  correctId: string;
}

export function parseMultipleChoiceStage(
  stage: LessonStageRenderContext["stage"]
): ParsedMultipleChoiceStageData {
  return {
    question: String(
      (stage.config.data as { question?: string }).question || stage.topic
    ),
    options: normalizeChoiceOptions(stage),
    correctId: getCorrectOptionId(stage),
  };
}

export function MultipleChoiceStageRenderer({
  stage,
  lesson,
  actions,
}: LessonStageRenderContext) {
  const parsedStage = parseMultipleChoiceStage(stage);

  return (
    <MultipleChoiceQuestion
      key={`backend-mcq-${stage.stageId}`}
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
      description={lesson.nodeDescription}
      question={parsedStage.question}
      options={parsedStage.options}
      correctId={parsedStage.correctId}
      feedbackMsg={{
        success: stage.feedback.success,
        error: stage.feedback.error,
        hint: "Eliminate the least likely options first.",
      }}
      onComplete={(selectedOptionId) =>
        void actions.submitStage(stage, { selectedOptionId })
      }
      onError={(selectedOptionId) =>
        void actions.submitStage(stage, { selectedOptionId })
      }
      onCorrectAdvance={actions.continueStage}
      onWrongAdvance={actions.continueStage}
      onSkip={() => void actions.skipStage(stage)}
      onHintUse={actions.useHint}
    />
  );
}

export const multipleChoicePlugin = createLessonStagePlugin(
  "MultipleChoice",
  MultipleChoiceStageRenderer,
  {
    displayName: "Multiple Choice",
    capabilities: {
      supportsHint: true,
      supportsSkip: true,
      usesFeedbackOverlay: false,
    },
  },
  parseMultipleChoiceStage
);
