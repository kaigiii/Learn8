"use client";

import type { LessonStage, SubmissionResponse } from "@/lib/apiTypes";
import type { MatchPair } from "../hooks/useMatchingPairsStage";

export interface MatchingStageViewModel {
  shuffledRight: string[];
  matched: string[];
  matchedPairs: Record<string, string>;
  selectedLeft: string | null;
  selectedRight: string | null;
  wrongPair: [string, string] | null;
  hintPair: string | null;
  hintUsed: boolean;
  allMatched: boolean;
  feedback: "correct" | "incorrect" | null;
  pickLeft: (word: string) => void;
  pickRight: (word: string) => void;
  handleCheck: () => void;
  handleHint: () => void | Promise<void>;
}

export interface ArenaLessonRendererViewModel {
  stageIdx: number;
  totalStages: number;
  stageLabel?: string;
  nodeDescription: string;
  matchPairs: MatchPair[];
  matchQuestion: string;
  matchingStage: MatchingStageViewModel;
}

export interface ArenaStageActionHandlers {
  onSubmitStage: (
    stage: LessonStage,
    input: unknown
  ) => Promise<SubmissionResponse | void>;
  onSkipStage: (stage: LessonStage) => Promise<void>;
  onContinue: () => void;
  onHintUse: () => Promise<boolean>;
}

export interface ArenaStageRendererProps {
  stage: LessonStage;
  lesson: ArenaLessonRendererViewModel;
  actions: ArenaStageActionHandlers;
}

export type StageRenderer = (props: ArenaStageRendererProps) => JSX.Element;

export interface ArenaStagePlugin {
  component: LessonStage["component"];
  render: StageRenderer;
}
