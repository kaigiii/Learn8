"use client";

import FeynmanQuestion from "@/components/lesson-session/FeynmanQuestion";
import { getFeynmanSubmitResult } from "../../renderers/shared";
import { createLessonStagePlugin } from "../../renderers/types";
import type { LessonStageRenderContext } from "../../renderers/types";

export interface ParsedFeynmanStageData {
  prompt: string;
  sampleAnswer: string;
  maxRounds?: number;
}

export function parseFeynmanStage(
  stage: LessonStageRenderContext["stage"]
): ParsedFeynmanStageData {
  return {
    prompt: String(
      (stage.config.data as { prompt?: string }).prompt || stage.topic
    ),
    sampleAnswer: String(
      (stage.config.data as { sampleAnswer?: string }).sampleAnswer || ""
    ),
    maxRounds: (stage.config.data as { maxRounds?: number }).maxRounds,
  };
}

export function FeynmanStageRenderer({
  stage,
  lesson,
  actions,
}: LessonStageRenderContext) {
  const parsedStage = parseFeynmanStage(stage);

  return (
    <FeynmanQuestion
      key={`backend-feynman-${stage.stageId}`}
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
      difficulty={stage.difficulty}
      recommendedDurationMinutes={stage.recommendedDurationMinutes}
      courseId={lesson.courseId}
      description={lesson.nodeDescription}
      prompt={parsedStage.prompt}
      sampleAnswer={parsedStage.sampleAnswer}
      maxRounds={parsedStage.maxRounds}
      feedbackMsg={{
        success: stage.feedback.success,
        error: stage.feedback.error,
        hint: "Explain the concept as if the listener knows none of the jargon.",
      }}
      onSubmit={async (answer, history) =>
        getFeynmanSubmitResult(
          await actions.submitStage(stage, { explanation: answer, history })
        )
      }
      onContinue={actions.continueStage}
      onSkip={() => void actions.skipStage(stage)}
      onHintUse={actions.useHint}
    />
  );
}

export const feynmanPlugin = createLessonStagePlugin(
  "FeynmanMirror",
  FeynmanStageRenderer,
  {
    displayName: "Feynman Mirror",
    capabilities: {
      supportsHint: true,
      supportsSkip: true,
      usesFeedbackOverlay: false,
    },
  },
  parseFeynmanStage
);
