"use client";

import type { LessonStagePlugin } from "../../renderers/types";
import type { LessonStage } from "@/lib/apiTypes";
import GanttLogicScheduler from "@/components/lesson-session/GanttLogicScheduler";

export const ganttLogicSchedulerPlugin: LessonStagePlugin = {
  component: "GanttLogicScheduler",
  meta: {
    displayName: "甘特圖邏輯排程",
    capabilities: {
      supportsHint: false,
      supportsSkip: true,
      usesFeedbackOverlay: false,
    },
  },
  Renderer: function GanttLogicSchedulerRenderer({ stage, lesson, actions }) {
    const { config } = stage;
    const data = (config.data || {}) as any;

    return (
      <GanttLogicScheduler
        stage={stage}
        stageIndex={lesson.stageIdx}
        totalStages={lesson.totalStages}
        stageLabel={lesson.stageLabel || "GANTT"}
        topic={stage.topic}
        difficulty={stage.difficulty || "medium"}
        recommendedDurationMinutes={stage.recommendedDurationMinutes || 8}
        title={data.title || "甘特圖排程規劃"}
        tasks={Array.isArray(data.tasks) ? data.tasks : []}
        timeLimit={typeof data.timeLimit === "number" ? data.timeLimit : 10}
        dependencies={Array.isArray(data.dependencies) ? data.dependencies : []}
        instruction={data.instruction}
        onSubmit={async (results) => {
          return await actions.submitStage(stage, {
            completed: results.completed,
            logicErrors: results.logicErrors,
            durationUsed: results.durationUsed,
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
