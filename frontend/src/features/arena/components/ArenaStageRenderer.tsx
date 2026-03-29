"use client";

import { getArenaStagePlugin, renderUnsupportedStage } from "../renderers";
import type { ArenaStageRenderContext } from "../renderers/types";

export function ArenaStageRenderer(props: ArenaStageRenderContext) {
  const renderer =
    getArenaStagePlugin(props.stage.component)?.Renderer || renderUnsupportedStage;

  return renderer(props);
}
