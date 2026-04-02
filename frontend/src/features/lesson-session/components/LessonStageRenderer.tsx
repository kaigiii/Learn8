"use client";

import { getLessonStagePlugin, renderUnsupportedStage } from "../renderers";
import type { LessonStageRenderContext } from "../renderers/types";

export function LessonStageRenderer(props: LessonStageRenderContext) {
  const Renderer =
    getLessonStagePlugin(props.stage.component)?.Renderer || renderUnsupportedStage;

  return <Renderer key={`${props.stage.component}-${props.stage.stageId}`} {...props} />;
}
