"use client";

import FeynmanQuestion from "@/components/arena/FeynmanQuestion";
import { getFeynmanSubmitResult } from "./shared";
import type { ArenaStagePlugin, ArenaStageRendererProps } from "./types";

export function renderFeynmanStage({
  stage,
  lesson,
  actions,
}: ArenaStageRendererProps) {
  return (
    <FeynmanQuestion
      key={`backend-feynman-${lesson.stageIdx}`}
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
          await actions.onSubmitStage(stage, { explanation: answer })
        )
      }
      onContinue={actions.onContinue}
      onSkip={() => void actions.onSkipStage(stage)}
      onHintUse={actions.onHintUse}
    />
  );
}

export function renderUnsupportedStage({
  stage,
  lesson,
  actions,
}: ArenaStageRendererProps) {
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
          await actions.onSubmitStage(stage, { explanation: answer })
        )
      }
      onContinue={actions.onContinue}
      onHintUse={actions.onHintUse}
    />
  );
}

export const feynmanPlugin: ArenaStagePlugin = {
  component: "FeynmanMirror",
  render: renderFeynmanStage,
};
