"use client";

import type { LessonStage, LessonStageComponent } from "@/lib/apiTypes";
import { feynmanPlugin } from "../question-types/feynman/plugin";
import { matchingPairsPlugin } from "../question-types/matching-pairs/plugin";
import { multipleChoicePlugin } from "../question-types/multiple-choice/plugin";
import { orderingPlugin } from "../question-types/ordering/plugin";
import type { ArenaStagePlugin, ArenaStagePluginRegistry, StageRenderer } from "./types";
import { renderUnsupportedStage } from "./unsupportedStageRenderer";

const stagePlugins = [
  multipleChoicePlugin,
  orderingPlugin,
  feynmanPlugin,
  matchingPairsPlugin,
] as const satisfies readonly ArenaStagePlugin[];

export const arenaStagePluginRegistry: ArenaStagePluginRegistry = Object.fromEntries(
  stagePlugins.map((plugin) => [plugin.component, plugin])
) as ArenaStagePluginRegistry;

export const stageRenderers: Record<LessonStageComponent, StageRenderer> =
  Object.fromEntries(
    Object.entries(arenaStagePluginRegistry).map(([component, plugin]) => [
      component,
      plugin.Renderer,
    ])
  ) as Record<LessonStageComponent, StageRenderer>;

export function getArenaStagePlugin(component: LessonStageComponent) {
  return arenaStagePluginRegistry[component];
}

export function getArenaStagePluginMeta(component: LessonStageComponent) {
  return getArenaStagePlugin(component)?.meta;
}

export function parseArenaStage(stage: LessonStage) {
  return getArenaStagePlugin(stage.component)?.parseStage(stage);
}

export { renderUnsupportedStage };
export { stagePlugins };
