"use client";

import { AnimatePresence } from "framer-motion";
import MatchingPairsQuestion from "@/components/arena/MatchingPairsQuestion";
import { ArenaFeedbackOverlay } from "../../components/ArenaFeedbackOverlay";
import { useMatchingPairsStage } from "../../hooks/useMatchingPairsStage";
import type { MatchPair } from "../../hooks/useMatchingPairsStage";
import { createArenaStagePlugin } from "../../renderers/types";
import type { ArenaStageRenderContext } from "../../renderers/types";

export interface ParsedMatchingPairsStageData {
  question: string;
  pairs: MatchPair[];
}

export function parseMatchingPairsStage(
  stage: ArenaStageRenderContext["stage"]
): ParsedMatchingPairsStageData {
  const data = stage.config.data as {
    question?: string;
    pairs?: { left: string; right: string }[];
  };

  return {
    question: data.question || stage.topic,
    pairs: (data.pairs || []).map((pair) => ({
      left: pair.left,
      right: pair.right,
    })),
  };
}

export function MatchingPairsStageRenderer({
  stage,
  lesson,
  actions,
}: ArenaStageRenderContext) {
  const { question, pairs } = parseMatchingPairsStage(stage);

  const matchingStage = useMatchingPairsStage({
    pairs,
    enabled: true,
    onCorrectStageComplete: async (pairsPayload) => {
      const response = await actions.submitStage(stage, { matches: pairsPayload });
      if (!response) {
        return;
      }

      if (response.result === "correct") {
        matchingStage.markCorrectFeedback();
        return;
      }

      matchingStage.markIncorrectFeedback();
    },
    onHintUse: actions.useHint,
  });

  const handleContinue = () => {
    matchingStage.clearFeedback();
    actions.continueStage();
  };

  return (
    <>
      <MatchingPairsQuestion
        key={`backend-match-${lesson.stageIdx}`}
        stageIndex={lesson.stageIdx}
        totalStages={lesson.totalStages}
        stageLabel={lesson.stageLabel}
        topic={stage.topic}
        question={question}
        pairs={pairs}
        shuffledRight={matchingStage.shuffledRight}
        matched={matchingStage.matched}
        matchedPairs={matchingStage.matchedPairs}
        selectedLeft={matchingStage.selectedLeft}
        selectedRight={matchingStage.selectedRight}
        wrongPair={matchingStage.wrongPair}
        hintPair={matchingStage.hintPair}
        hintUsed={matchingStage.hintUsed}
        allMatched={matchingStage.allMatched}
        feedback={matchingStage.feedback}
        onPickLeft={matchingStage.pickLeft}
        onPickRight={matchingStage.pickRight}
        onHint={matchingStage.handleHint}
        onSubmit={matchingStage.handleCheck}
        onSkip={() => void actions.skipStage(stage)}
      />

      <AnimatePresence>
        {matchingStage.feedback ? (
          <ArenaFeedbackOverlay
            type={matchingStage.feedback}
            onContinue={handleContinue}
            showConfetti={matchingStage.showConfetti}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

export const matchingPairsPlugin = createArenaStagePlugin(
  "MatchingPairs",
  MatchingPairsStageRenderer,
  {
    displayName: "Matching Pairs",
    capabilities: {
      supportsHint: true,
      supportsSkip: true,
      usesFeedbackOverlay: true,
    },
  },
  parseMatchingPairsStage
);
