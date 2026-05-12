"use client";

import ExplainerMediaCard from "@/components/lesson-session/ExplainerMediaCard";
import { createLessonStagePlugin } from "../../renderers/types";
import type { LessonStageRenderContext } from "../../renderers/types";

export interface ParsedExplainerMediaStageData {
  title: string;
  explanation: string;
  bullets: string[];
  mediaType: "svg" | "image" | "none";
  mediaSvg?: string;
  mediaDescription?: string;
  mediaUrl?: string;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

export function parseExplainerMediaStage(
  stage: LessonStageRenderContext["stage"]
): ParsedExplainerMediaStageData {
  const data = (stage.config.data || {}) as Record<string, unknown>;
  const mediaType = String(data.mediaType || "none") as ParsedExplainerMediaStageData["mediaType"];

  return {
    title: String(data.title || stage.topic),
    explanation: String(data.explanation || ""),
    bullets: parseStringArray(data.bullets),
    mediaType: mediaType === "svg" || mediaType === "image" ? mediaType : "none",
    mediaSvg: typeof data.mediaSvg === "string" ? data.mediaSvg : undefined,
    mediaDescription: typeof data.mediaDescription === "string" ? data.mediaDescription : undefined,
    mediaUrl: typeof data.mediaUrl === "string" ? data.mediaUrl : undefined,
  };
}

export function ExplainerMediaStageRenderer({
  stage,
  lesson,
  actions,
}: LessonStageRenderContext) {
  const parsedStage = parseExplainerMediaStage(stage);

  return (
    <ExplainerMediaCard
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
      difficulty={stage.difficulty}
      recommendedDurationMinutes={stage.recommendedDurationMinutes}
      title={parsedStage.title}
      explanation={parsedStage.explanation}
      bullets={parsedStage.bullets}
      mediaType={parsedStage.mediaType}
      mediaSvg={parsedStage.mediaSvg}
      mediaDescription={parsedStage.mediaDescription}
      mediaUrl={parsedStage.mediaUrl}
      onContinue={async () => {
        const isFinalStage = lesson.stageIdx >= lesson.totalStages - 1;
        if (isFinalStage) {
          // Final stage triggers phase completion — make sure the submission
          // is recorded before complete-primary fires.
          await actions.submitStage(stage, { acknowledged: true });
        } else {
          // Non-final stage: fire-and-forget so the next stage renders instantly.
          void actions.submitStage(stage, { acknowledged: true });
        }
        actions.continueStage();
      }}
    />
  );
}

export const explainerMediaPlugin = createLessonStagePlugin(
  "ExplainerMedia",
  ExplainerMediaStageRenderer,
  {
    displayName: "Explainer Media",
    capabilities: {
      supportsHint: false,
      supportsSkip: false,
      usesFeedbackOverlay: false,
    },
  },
  parseExplainerMediaStage
);
