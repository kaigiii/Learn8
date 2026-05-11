"use client";

import BloodFlowSimulator from "@/components/lesson-session/BloodFlowSimulator";
import { createLessonStagePlugin } from "../../renderers/types";
import type { LessonStageRenderContext } from "../../renderers/types";

export interface ParsedBloodFlowStageData {
  stage: LessonStageRenderContext["stage"];
}

export function parseBloodFlowStage(
  stage: LessonStageRenderContext["stage"]
): ParsedBloodFlowStageData {
  return {
    stage,
  };
}

export function BloodFlowStageRenderer({
  stage,
  actions,
}: LessonStageRenderContext) {
  return (
    <BloodFlowSimulator
      key={`blood-flow-${stage.stageId}`}
      stage={stage}
      onSubmit={(input) => actions.submitStage(stage, { path: input })}
      onContinue={actions.continueStage}
    />
  );
}

export const bloodFlowSimulatorPlugin = createLessonStagePlugin(
  "BloodFlowSimulator",
  BloodFlowStageRenderer,
  {
    displayName: "Blood Flow Simulator",
    capabilities: {
      supportsHint: false,
      supportsSkip: true,
      usesFeedbackOverlay: false,
    },
  },
  parseBloodFlowStage
);
