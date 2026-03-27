"use client";

import type { LessonStage } from "@/lib/apiTypes";
import { feynmanPlugin, renderUnsupportedStage } from "./feynmanRenderer";
import { matchingPairsPlugin } from "./matchingPairsRenderer";
import { multipleChoicePlugin } from "./multipleChoiceRenderer";
import { orderingPlugin } from "./orderingRenderer";
import type { StageRenderer } from "./types";

const stagePlugins = [
  multipleChoicePlugin,
  orderingPlugin,
  feynmanPlugin,
  matchingPairsPlugin,
] as const;

export const stageRenderers: Record<LessonStage["component"], StageRenderer> =
  Object.fromEntries(
    stagePlugins.map((plugin) => [plugin.component, plugin.render])
  ) as Record<LessonStage["component"], StageRenderer>;

export { renderUnsupportedStage };
export { stagePlugins };
