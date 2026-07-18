"use client";

import type { LessonStagePlugin } from "../../renderers/types";
import type { LessonStage } from "@/lib/apiTypes";
import DocumentAnomalyDebugger from "@/components/lesson-session/DocumentAnomalyDebugger";

export const documentAnomalyDebuggerPlugin: LessonStagePlugin = {
  component: "DocumentAnomalyDebugger",
  meta: {
    displayName: "品質除錯審查",
    capabilities: {
      supportsHint: false,
      supportsSkip: true,
      usesFeedbackOverlay: false,
    },
  },
  Renderer: function DocumentAnomalyDebuggerRenderer({ stage, lesson, actions }) {
    const { config } = stage;
    const data = (config.data || {}) as any;

    return (
      <DocumentAnomalyDebugger
        stage={stage}
        stageIndex={lesson.stageIdx}
        totalStages={lesson.totalStages}
        stageLabel={lesson.stageLabel || "DEBUGGER"}
        topic={stage.topic}
        difficulty={stage.difficulty || "high"}
        recommendedDurationMinutes={stage.recommendedDurationMinutes || 10}
        title={data.title || "報表異常檢核"}
        documentHtml={data.documentHtml || ""}
        anomalies={Array.isArray(data.anomalies) ? data.anomalies : []}
        checklistOptions={Array.isArray(data.checklistOptions) ? data.checklistOptions : []}
        instruction={data.instruction}
        onSubmit={async (results) => {
          return await actions.submitStage(stage, {
            completed: results.completed,
            foundCount: results.foundCount,
            wrongClicks: results.wrongClicks,
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
