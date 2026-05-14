"use client";

import type { LessonStagePlugin } from "../../renderers/types";
import type { LessonStage } from "@/lib/apiTypes";
import HeapSortExercise from "@/components/lesson-session/HeapSortExercise";

export const heapSortExercisePlugin: LessonStagePlugin = {
  component: "HeapSortExercise",
  meta: {
    displayName: "Heap Sort 實戰練習",
    capabilities: {
      supportsHint: false,
      supportsSkip: true,
      usesFeedbackOverlay: false,
    },
  },
  Renderer: function HeapSortExerciseRenderer({ stage, lesson, actions }) {
    const { config } = stage;
    const data = (config.data || {}) as any;

    return (
      <HeapSortExercise
        stageIndex={lesson.stageIdx}
        totalStages={lesson.totalStages}
        stageLabel={lesson.stageLabel || "EXERCISE"}
        topic={stage.topic}
        difficulty="medium"
        recommendedDurationMinutes={5}
        initialArray={Array.isArray(data.initialArray) ? data.initialArray : [10, 5, 8, 2, 4]}
        title={typeof data.title === "string" ? data.title : "堆積排序實戰"}
        explanation={typeof data.explanation === "string" ? data.explanation : "請根據堆積排序的規則，手動完成排序。"}
        messages={data.messages}
        hints={data.hints || []}
        onHintUse={actions.useHint}
        onContinue={async (results) => {
          await actions.submitStage(stage, { 
            completed: true, 
            errorCount: results.errorCount 
          });
          actions.continueStage();
        }}
        onSkip={() => void actions.skipStage(stage)}
      />
    );
  },
  parseStage(stage: LessonStage) {
    return stage;
  },
};
