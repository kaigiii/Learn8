"use client";

import { renderUnsupportedStage, stageRenderers } from "../renderers";
import type { ArenaStageRendererProps } from "../renderers/types";

export function ArenaStageRenderer(props: ArenaStageRendererProps) {
  const renderer =
    stageRenderers[props.stage.component] || renderUnsupportedStage;

  return renderer(props);
}
