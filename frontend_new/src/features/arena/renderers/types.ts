"use client";

import type { LessonStage, SubmissionResponse } from "@/lib/apiTypes";
import type { MatchPair } from "../hooks/useMatchingPairsStage";

export interface MatchingStageViewModel {
  shuffledRight: string[];
  matched: string[];
  selectedLeft: string | null;
  selectedRight: string | null;
  wrongPair: [string, string] | null;
  hintPair: string | null;
  hintUsed: boolean;
  allMatched: boolean;
  pickLeft: (word: string) => void;
  pickRight: (word: string) => void;
  handleCheck: () => void;
  handleHint: () => void;
}

export interface ArenaStageRendererProps {
  stage: LessonStage;
  stageIdx: number;
  totalStages: number;
  nodeDescription: string;
  matchPairs: MatchPair[];
  matchQuestion: string;
  matchingStage: MatchingStageViewModel;
  onSubmitStage: (
    stage: LessonStage,
    input: unknown
  ) => Promise<SubmissionResponse | void>;
  onSkipStage: (stage: LessonStage) => Promise<void>;
  onContinue: () => void;
  onHintUse: () => boolean;
}

export type StageRenderer = (props: ArenaStageRendererProps) => JSX.Element;

export interface ArenaStagePlugin {
  component: LessonStage["component"];
  render: StageRenderer;
}
