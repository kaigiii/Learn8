"use client";

import { getLessonStagePlugin, renderUnsupportedStage } from "../renderers";
import type { LessonStageRenderContext } from "../renderers/types";

export function LessonStageRenderer(props: LessonStageRenderContext) {
  const Renderer =
    getLessonStagePlugin(props.stage.component)?.Renderer || renderUnsupportedStage;

  const stage =
    props.lesson.topicOverride
      ? { ...props.stage, topic: props.lesson.topicOverride }
      : props.stage;

  return <Renderer key={`${props.stage.component}-${props.stage.stageId}`} {...props} stage={stage} />;
}
