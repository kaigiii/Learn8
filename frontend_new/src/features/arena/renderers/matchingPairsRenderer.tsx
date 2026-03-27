"use client";

import dynamic from "next/dynamic";
import { StageComponentLoading } from "./shared";
import type { ArenaStagePlugin, ArenaStageRendererProps } from "./types";

const MatchingPairsQuestion = dynamic(
  () => import("@/components/arena/MatchingPairsQuestion"),
  { loading: () => <StageComponentLoading /> }
);

export function renderMatchingPairsStage({
  stage,
  stageIdx,
  totalStages,
  matchPairs,
  matchQuestion,
  matchingStage,
  onSkipStage,
}: ArenaStageRendererProps) {
  return (
    <MatchingPairsQuestion
      key={`backend-match-${stageIdx}`}
      stageIndex={stageIdx}
      totalStages={totalStages}
      topic={stage.topic}
      question={matchQuestion}
      pairs={matchPairs}
      shuffledRight={matchingStage.shuffledRight}
      matched={matchingStage.matched}
      selectedLeft={matchingStage.selectedLeft}
      selectedRight={matchingStage.selectedRight}
      wrongPair={matchingStage.wrongPair}
      hintPair={matchingStage.hintPair}
      hintUsed={matchingStage.hintUsed}
      allMatched={matchingStage.allMatched}
      onPickLeft={matchingStage.pickLeft}
      onPickRight={matchingStage.pickRight}
      onHint={matchingStage.handleHint}
      onSubmit={matchingStage.handleCheck}
      onSkip={() => void onSkipStage(stage)}
    />
  );
}

export const matchingPairsPlugin: ArenaStagePlugin = {
  component: "MatchingPairs",
  render: renderMatchingPairsStage,
};
