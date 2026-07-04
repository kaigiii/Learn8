"use client";

import GoBoardQuestion from "@/components/lesson-session/GoBoardQuestion";
import { createLessonStagePlugin } from "../../renderers/types";
import type { LessonStageRenderContext } from "../../renderers/types";

const goBoardMeta = {
  displayName: "Go Board",
  capabilities: {
    supportsHint: true,
    supportsSkip: true,
    usesFeedbackOverlay: false,
  },
};

function getVariantLabel(component: string) {
  switch (component) {
    case "GoCountLiberties":
      return "數氣";
    case "GoCaptureStones":
      return "提子";
    case "GoKo":
      return "叫吃";
    case "GoEscape":
      return "逃跑";
    case "GoNoEntry":
      return "禁入點";
    case "GoConnect":
      return "連接";
    case "GoCut":
      return "分斷";
    case "GoCountTerritory":
      return "數目";
    default:
      return "圍棋";
  }
}

export function parseGoBoardStage(stage: LessonStageRenderContext["stage"]) {
  const data = (stage.config.data as Record<string, unknown>) || {};
  return {
    question: String(data.question || stage.topic || "圍棋題"),
    board: data.board ?? [],
    explanation: String(data.explanation || ""),
    expectedAnswer: data.expectedAnswer != null ? String(data.expectedAnswer) : null,
    playerColor: data.playerColor != null ? String(data.playerColor) : null,
    variantLabel: getVariantLabel(stage.component),
  };
}

export function GoBoardStageRenderer({ stage, lesson, actions }: LessonStageRenderContext) {
  const parsedStage = parseGoBoardStage(stage);

  return (
    <GoBoardQuestion
      key={`go-board-${stage.stageId}`}
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
      difficulty={stage.difficulty}
      recommendedDurationMinutes={stage.recommendedDurationMinutes}
      description={lesson.nodeDescription}
      question={parsedStage.question}
      board={parsedStage.board}
      variantLabel={parsedStage.variantLabel}
      explanation={parsedStage.explanation}
      componentType={stage.component}
      expectedAnswer={parsedStage.expectedAnswer}
      playerColor={parsedStage.playerColor}
      onComplete={async (answer) => {
        const response = await actions.submitStage(stage, { answer });
        return response;
      }}
      onError={(answer) => void actions.submitStage(stage, { answer })}
      onCorrectAdvance={actions.continueStage}
      onWrongAdvance={actions.continueStage}
      onSkip={() => void actions.skipStage(stage)}
      onHintUse={actions.useHint}
    />
  );
}

export const goCountLibertiesPlugin = createLessonStagePlugin(
  "GoCountLiberties",
  GoBoardStageRenderer,
  goBoardMeta,
  parseGoBoardStage
);

export const goCaptureStonesPlugin = createLessonStagePlugin(
  "GoCaptureStones",
  GoBoardStageRenderer,
  goBoardMeta,
  parseGoBoardStage
);

export const goKoPlugin = createLessonStagePlugin(
  "GoKo",
  GoBoardStageRenderer,
  goBoardMeta,
  parseGoBoardStage
);

export const goEscapePlugin = createLessonStagePlugin(
  "GoEscape",
  GoBoardStageRenderer,
  goBoardMeta,
  parseGoBoardStage
);

export const goNoEntryPlugin = createLessonStagePlugin(
  "GoNoEntry",
  GoBoardStageRenderer,
  goBoardMeta,
  parseGoBoardStage
);

export const goConnectPlugin = createLessonStagePlugin(
  "GoConnect",
  GoBoardStageRenderer,
  goBoardMeta,
  parseGoBoardStage
);

export const goCutPlugin = createLessonStagePlugin(
  "GoCut",
  GoBoardStageRenderer,
  goBoardMeta,
  parseGoBoardStage
);

export const goCountTerritoryPlugin = createLessonStagePlugin(
  "GoCountTerritory",
  GoBoardStageRenderer,
  goBoardMeta,
  parseGoBoardStage
);
