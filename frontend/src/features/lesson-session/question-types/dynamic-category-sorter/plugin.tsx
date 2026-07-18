"use client";

import type { LessonStagePlugin } from "../../renderers/types";
import type { LessonStage } from "@/lib/apiTypes";
import DynamicCategorySorter from "@/components/lesson-session/DynamicCategorySorter";

export const dynamicCategorySorterPlugin: LessonStagePlugin = {
  component: "DynamicCategorySorter",
  meta: {
    displayName: "分類拖曳挑戰",
    capabilities: {
      supportsHint: false,
      supportsSkip: true,
      usesFeedbackOverlay: false,
    },
  },
  Renderer: function DynamicCategorySorterRenderer({ stage, lesson, actions }) {
    const { config } = stage;
    const data = (config.data || {}) as any;

    return (
      <DynamicCategorySorter
        stage={stage}
        stageIndex={lesson.stageIdx}
        totalStages={lesson.totalStages}
        stageLabel={lesson.stageLabel || "SORTER"}
        topic={stage.topic}
        difficulty={stage.difficulty || "medium"}
        recommendedDurationMinutes={stage.recommendedDurationMinutes || 5}
        title={data.title || "概念分類挑戰"}
        categories={Array.isArray(data.categories) ? data.categories : []}
        cards={Array.isArray(data.cards) ? data.cards : []}
        instruction={data.instruction}
        hints={data.hints || []}
        onSubmit={async (results) => {
          return await actions.submitStage(stage, {
            completed: results.completed,
            errorCount: results.errorCount,
            wrongMatches: results.wrongMatches,
          });
        }}
        onContinue={() => actions.continueStage()}
        onSkip={() => void actions.skipStage(stage)}
      />
    );
  },
  parseStage(stage: LessonStage) {
    return stage;
  },
};
