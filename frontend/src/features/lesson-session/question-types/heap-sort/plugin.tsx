"use client";

import HeapSortSimulator from "@/components/lesson-session/HeapSortSimulator";
import { createLessonStagePlugin } from "../../renderers/types";
import type { LessonStageRenderContext } from "../../renderers/types";

// --- Types ---
export interface HeapSortSimulatorConfig {
  initialArray: number[];
  title: string;
  explanation: string;
}

// --- Main Renderer ---
export function HeapSortStageRenderer({
  stage,
  lesson,
  actions,
}: LessonStageRenderContext) {
  const config = stage.config.data as HeapSortSimulatorConfig;

  return (
    <HeapSortSimulator
      key={`heap-sort-${stage.stageId}`}
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
      difficulty={stage.difficulty}
      recommendedDurationMinutes={stage.recommendedDurationMinutes}
      initialArray={config.initialArray || [12, 11, 13, 5, 6, 7]}
      title={config.title || "Heap Sort: Interactive Walkthrough"}
      explanation={config.explanation || "學習 Heap Sort 的核心邏輯與二元堆積結構。"}
      onContinue={async () => {
        const isFinalStage = lesson.stageIdx >= lesson.totalStages - 1;
        if (isFinalStage) {
          await actions.submitStage(stage, { completed: true });
        } else {
          void actions.submitStage(stage, { completed: true });
        }
        actions.continueStage();
      }}
      onSkip={() => void actions.skipStage(stage)}
    />
  );
}

export function parseHeapSortStage(stage: any): HeapSortSimulatorConfig {
  return stage.config.data as HeapSortSimulatorConfig;
}

// --- Plugin Definition ---
export const heapSortPlugin = createLessonStagePlugin(
  "HeapSortSimulator",
  HeapSortStageRenderer,
  {
    displayName: "Heap Sort Simulator",
    capabilities: {
      supportsHint: false,
      supportsSkip: true,
      usesFeedbackOverlay: false,
    },
  },
  parseHeapSortStage
);
