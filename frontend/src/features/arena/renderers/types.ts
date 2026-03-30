"use client";

import type { ComponentType } from "react";
import type {
  LessonStage,
  LessonStageComponent,
  SubmissionResponse,
} from "@/lib/apiTypes";

export interface ArenaLessonRendererViewModel {
  stageIdx: number;
  totalStages: number;
  stageLabel?: string;
  nodeDescription: string;
}

export interface ArenaStageActionHandlers {
  submitStage: (
    stage: LessonStage,
    input: unknown
  ) => Promise<SubmissionResponse | void>;
  skipStage: (stage: LessonStage) => Promise<void>;
  continueStage: () => void;
  useHint: () => Promise<boolean>;
}

export interface ArenaStageRenderContext {
  stage: LessonStage;
  lesson: ArenaLessonRendererViewModel;
  actions: ArenaStageActionHandlers;
}

export type StageRenderer = ComponentType<ArenaStageRenderContext>;

export interface ArenaStagePluginCapabilities {
  supportsHint: boolean;
  supportsSkip: boolean;
  usesFeedbackOverlay: boolean;
}

export interface ArenaStagePluginMeta {
  displayName: string;
  capabilities: ArenaStagePluginCapabilities;
}

export type ArenaStageDataParser<TData = unknown> = (stage: LessonStage) => TData;

export interface ArenaStagePlugin<
  TData = unknown,
  TComponent extends LessonStageComponent = LessonStageComponent,
> {
  component: TComponent;
  meta: ArenaStagePluginMeta;
  Renderer: StageRenderer;
  parseStage: ArenaStageDataParser<TData>;
}

export type ArenaStagePluginRegistry = Record<LessonStageComponent, ArenaStagePlugin>;

export function createArenaStagePlugin<
  TComponent extends LessonStageComponent,
  TData,
>(
  component: TComponent,
  Renderer: StageRenderer,
  meta: ArenaStagePluginMeta,
  parseStage: ArenaStageDataParser<TData>
): ArenaStagePlugin<TData, TComponent> {
  return {
    component,
    meta,
    Renderer,
    parseStage,
  };
}
