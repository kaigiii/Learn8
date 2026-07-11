"use client";

import type { LessonStage, LessonStageComponent } from "@/lib/apiTypes";
import { feynmanPlugin } from "../question-types/feynman/plugin";
import { explainerMediaPlugin } from "../question-types/explainer-media/plugin";
import { matchingPairsPlugin } from "../question-types/matching-pairs/plugin";
import { multipleChoicePlugin } from "../question-types/multiple-choice/plugin";
import { orderingPlugin } from "../question-types/ordering/plugin";
import { heapSortPlugin } from "../question-types/heap-sort-simulator/plugin";
import { heapSortExercisePlugin } from "../question-types/heap-sort-exercise/plugin";
import {
  goCaptureStonesPlugin,
  goConnectPlugin,
  goCountLibertiesPlugin,
  goCountTerritoryPlugin,
  goCutPlugin,
  goEscapePlugin,
  goKoPlugin,
  goNoEntryPlugin,
  goBoardCoordinatePlugin,
  goBoardNumericPlugin,
} from "../question-types/go-board/plugin";
import type { LessonStagePlugin, LessonStagePluginRegistry, StageRenderer } from "./types";
import { renderUnsupportedStage } from "./unsupportedStageRenderer";

const stagePlugins = [
  multipleChoicePlugin,
  orderingPlugin,
  feynmanPlugin,
  matchingPairsPlugin,
  explainerMediaPlugin,
  heapSortPlugin,
  heapSortExercisePlugin,
  goBoardCoordinatePlugin,
  goBoardNumericPlugin,
  goCountLibertiesPlugin,
  goCaptureStonesPlugin,
  goKoPlugin,
  goEscapePlugin,
  goNoEntryPlugin,
  goConnectPlugin,
  goCutPlugin,
  goCountTerritoryPlugin,
] as const satisfies readonly LessonStagePlugin[];

export const lessonStagePluginRegistry: LessonStagePluginRegistry = Object.fromEntries(
  stagePlugins.map((plugin) => [plugin.component, plugin])
) as LessonStagePluginRegistry;

export const stageRenderers: Record<LessonStageComponent, StageRenderer> =
  Object.fromEntries(
    Object.entries(lessonStagePluginRegistry).map(([component, plugin]) => [
      component,
      plugin.Renderer,
    ])
  ) as Record<LessonStageComponent, StageRenderer>;

export function getLessonStagePlugin(component: LessonStageComponent) {
  return lessonStagePluginRegistry[component];
}

export function getLessonStagePluginMeta(component: LessonStageComponent) {
  return getLessonStagePlugin(component)?.meta;
}

export function parseLessonStage(stage: LessonStage) {
  return getLessonStagePlugin(stage.component)?.parseStage(stage);
}

export { renderUnsupportedStage };
export { stagePlugins };
