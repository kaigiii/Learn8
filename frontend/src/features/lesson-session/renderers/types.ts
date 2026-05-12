"use client";

import type { ComponentType } from "react";
import type {
  LessonStage,
  LessonStageComponent,
  SubmissionResponse,
} from "@/lib/apiTypes";

export interface LessonStageRendererViewModel {
  stageIdx: number;
  totalStages: number;
  stageLabel?: string;
  nodeDescription: string;
  courseId: number | null;
  topicOverride?: string;
}

export interface LessonStageActionHandlers {
  submitStage: (
    stage: LessonStage,
    input: unknown
  ) => Promise<SubmissionResponse | void>;
  skipStage: (stage: LessonStage) => Promise<void>;
  continueStage: () => void;
  useHint: () => Promise<boolean>;
}

export interface LessonStageRenderContext {
  stage: LessonStage;
  lesson: LessonStageRendererViewModel;
  actions: LessonStageActionHandlers;
}

export type StageRenderer = ComponentType<LessonStageRenderContext>;

export interface LessonStagePluginCapabilities {
  supportsHint: boolean;
  supportsSkip: boolean;
  usesFeedbackOverlay: boolean;
}

export interface LessonStagePluginMeta {
  displayName: string;
  capabilities: LessonStagePluginCapabilities;
}

export type LessonStageDataParser<TData = unknown> = (stage: LessonStage) => TData;

export interface LessonStagePlugin<
  TData = unknown,
  TComponent extends LessonStageComponent = LessonStageComponent,
> {
  component: TComponent;
  meta: LessonStagePluginMeta;
  Renderer: StageRenderer;
  parseStage: LessonStageDataParser<TData>;
}

export type LessonStagePluginRegistry = Record<LessonStageComponent, LessonStagePlugin>;

export function createLessonStagePlugin<
  TComponent extends LessonStageComponent,
  TData,
>(
  component: TComponent,
  Renderer: StageRenderer,
  meta: LessonStagePluginMeta,
  parseStage: LessonStageDataParser<TData>
): LessonStagePlugin<TData, TComponent> {
  return {
    component,
    meta,
    Renderer,
    parseStage,
  };
}
