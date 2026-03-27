"use client";

import dynamic from "next/dynamic";
import { getFeynmanSubmitResult, StageComponentLoading } from "./shared";
import type { ArenaStagePlugin, ArenaStageRendererProps } from "./types";

const FeynmanQuestion = dynamic(
  () => import("@/components/arena/FeynmanQuestion"),
  { loading: () => <StageComponentLoading /> }
);

export function renderFeynmanStage({
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
    <FeynmanQuestion
      key={`backend-feynman-${stageIdx}`}
      stageIndex={stageIdx}
      totalStages={totalStages}
      topic={stage.topic}
      description={nodeDescription}
      prompt={String((stage.config.data as { prompt?: string }).prompt || stage.topic)}
      sampleAnswer={String((stage.config.data as { sampleAnswer?: string }).sampleAnswer || "")}
      feedbackMsg={{
        success: stage.feedback.success,
        error: stage.feedback.error,
        hint: "Explain the concept as if the listener knows none of the jargon.",
      }}
      onSubmit={async (answer) =>
        getFeynmanSubmitResult(
          await onSubmitStage(stage, { explanation: answer })
        )
      }
      onContinue={onContinue}
      onSkip={() => void onSkipStage(stage)}
      onHintUse={onHintUse}
    />
  );
}

export function renderUnsupportedStage({
  stage,
  stageIdx,
  totalStages,
  nodeDescription,
  onSubmitStage,
  onContinue,
  onHintUse,
}: ArenaStageRendererProps) {
  return (
    <FeynmanQuestion
      key={`backend-stage-${stageIdx}`}
      stageIndex={stageIdx}
      totalStages={totalStages}
      topic={stage.topic}
      description={nodeDescription}
      prompt={String((stage.config.data as { prompt?: string }).prompt || stage.topic)}
      sampleAnswer={String((stage.config.data as { sampleAnswer?: string }).sampleAnswer || "")}
      feedbackMsg={{
        success: stage.feedback.success,
        error: stage.feedback.error,
        hint: "Explain the concept as if the listener knows none of the jargon.",
      }}
      onSubmit={async (answer) =>
        getFeynmanSubmitResult(
          await onSubmitStage(stage, { explanation: answer })
        )
      }
      onContinue={onContinue}
      onHintUse={onHintUse}
    />
  );
}

export const feynmanPlugin: ArenaStagePlugin = {
  component: "FeynmanMirror",
  render: renderFeynmanStage,
};
