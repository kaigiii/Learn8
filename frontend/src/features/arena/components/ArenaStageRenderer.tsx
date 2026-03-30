"use client";

import { getArenaStagePlugin, renderUnsupportedStage } from "../renderers";
import type { ArenaStageRenderContext } from "../renderers/types";

export function ArenaStageRenderer(props: ArenaStageRenderContext) {
  const Renderer =
    getArenaStagePlugin(props.stage.component)?.Renderer || renderUnsupportedStage;

  return <Renderer key={`${props.stage.component}-${props.stage.stageId}`} {...props} />;
}
