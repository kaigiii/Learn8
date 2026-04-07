"use client";

import FeynmanQuestion from "@/components/lesson-session/FeynmanQuestion";
import { getFeynmanSubmitResult } from "./shared";
import type { LessonStageRenderContext } from "./types";

export function renderUnsupportedStage({
  stage,
  lesson,
  actions,
}: LessonStageRenderContext) {
  return (
    <FeynmanQuestion
      key={`backend-stage-${lesson.stageIdx}`}
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
      difficulty={stage.difficulty}
      recommendedDurationMinutes={stage.recommendedDurationMinutes}
      description={lesson.nodeDescription}
      prompt={String((stage.config.data as { prompt?: string }).prompt || stage.topic)}
      sampleAnswer={String((stage.config.data as { sampleAnswer?: string }).sampleAnswer || "")}
      feedbackMsg={{
        success: stage.feedback.success,
        error: stage.feedback.error,
        hint: "Explain the concept as if the listener knows none of the jargon.",
      }}
      onSubmit={async (answer) =>
        getFeynmanSubmitResult(
          await actions.submitStage(stage, { explanation: answer })
        )
      }
      onContinue={actions.continueStage}
      onHintUse={actions.useHint}
    />
  );
}
