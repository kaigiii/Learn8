"use client";

import { AnimatePresence } from "framer-motion";
import MatchingPairsQuestion from "@/components/lesson-session/MatchingPairsQuestion";
import { LessonSessionFeedbackOverlay } from "../../components/LessonSessionFeedbackOverlay";
import { useMatchingPairsStage } from "../../hooks/useMatchingPairsStage";
import type { MatchPair } from "../../hooks/useMatchingPairsStage";
import { createLessonStagePlugin } from "../../renderers/types";
import type { LessonStageRenderContext } from "../../renderers/types";

export interface ParsedMatchingPairsStageData {
  question: string;
  pairs: MatchPair[];
}

export function parseMatchingPairsStage(
  stage: LessonStageRenderContext["stage"]
): ParsedMatchingPairsStageData {
  const data = stage.config.data as {
    question?: string;
    pairs?: { id?: string; left?: string; right?: string }[];
  };

  return {
    question: data.question || stage.topic,
    pairs: (data.pairs || []).map((pair: any, index) => {
      const left = pair.left || pair.term || pair.text || pair.label || "";
      const right = pair.right || pair.definition || pair.match || pair.answer || "";
      return {
        id: String(pair.id || `pair-${index}`),
        left: String(left).trim(),
        right: String(right).trim(),
      };
    }),
  };
}

export function MatchingPairsStageRenderer({
  stage,
  lesson,
  actions,
}: LessonStageRenderContext) {
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
        key={`backend-match-${stage.stageId}`}
        stageIndex={lesson.stageIdx}
        totalStages={lesson.totalStages}
        stageLabel={lesson.stageLabel}
        topic={stage.topic}
        difficulty={stage.difficulty}
        recommendedDurationMinutes={stage.recommendedDurationMinutes}
        question={question}
        pairs={pairs}
        shuffledRightIds={matchingStage.shuffledRightIds}
        matched={matchingStage.matched}
        matchedPairs={matchingStage.matchedPairs}
        selectedLeftId={matchingStage.selectedLeftId}
        selectedRightId={matchingStage.selectedRightId}
        wrongPair={matchingStage.wrongPair}
        hintPairId={matchingStage.hintPairId}
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
          <LessonSessionFeedbackOverlay
            type={matchingStage.feedback}
            onContinue={handleContinue}
            showConfetti={matchingStage.showConfetti}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

export const matchingPairsPlugin = createLessonStagePlugin(
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
