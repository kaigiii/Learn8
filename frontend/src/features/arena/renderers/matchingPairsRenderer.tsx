"use client";

import MatchingPairsQuestion from "@/components/arena/MatchingPairsQuestion";
import type { ArenaStagePlugin, ArenaStageRendererProps } from "./types";

export function renderMatchingPairsStage({
  stage,
  lesson,
  actions,
}: ArenaStageRendererProps) {
  return (
    <MatchingPairsQuestion
      key={`backend-match-${lesson.stageIdx}`}
      stageIndex={lesson.stageIdx}
      totalStages={lesson.totalStages}
      stageLabel={lesson.stageLabel}
      topic={stage.topic}
      question={lesson.matchQuestion}
      pairs={lesson.matchPairs}
      shuffledRight={lesson.matchingStage.shuffledRight}
      matched={lesson.matchingStage.matched}
      matchedPairs={lesson.matchingStage.matchedPairs}
      selectedLeft={lesson.matchingStage.selectedLeft}
      selectedRight={lesson.matchingStage.selectedRight}
      wrongPair={lesson.matchingStage.wrongPair}
      hintPair={lesson.matchingStage.hintPair}
      hintUsed={lesson.matchingStage.hintUsed}
      allMatched={lesson.matchingStage.allMatched}
      feedback={lesson.matchingStage.feedback}
      onPickLeft={lesson.matchingStage.pickLeft}
      onPickRight={lesson.matchingStage.pickRight}
      onHint={lesson.matchingStage.handleHint}
      onSubmit={lesson.matchingStage.handleCheck}
      onSkip={() => void actions.onSkipStage(stage)}
    />
  );
}

export const matchingPairsPlugin: ArenaStagePlugin = {
  component: "MatchingPairs",
  render: renderMatchingPairsStage,
};
