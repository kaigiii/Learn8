"use client";

import FeynmanQuestion from "@/components/arena/FeynmanQuestion";
import { getFeynmanSubmitResult } from "./shared";
import type { ArenaStageRenderContext } from "./types";

export function renderUnsupportedStage({
  stage,
  lesson,
  actions,
}: ArenaStageRenderContext) {
  return (
    <FeynmanQuestion
      key={`backend-stage-${lesson.stageIdx}`}
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
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
