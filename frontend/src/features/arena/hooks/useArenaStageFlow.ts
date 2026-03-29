"use client";

import { useCallback } from "react";
import { spendAuthenticatedCredits } from "@/lib/auth/profileSync";
import { ApiError, apiFetch } from "@/lib/apiClient";
import type {
  CoursePath,
  LessonSessionPayload,
  LessonStage,
  SubmissionResponse,
} from "@/lib/apiTypes";
import { useMatchingPairsStage } from "./useMatchingPairsStage";

interface UseArenaStageFlowParams {
  lessonSession: LessonSessionPayload | null;
  isSessionInteractive: boolean;
  backendCourse: CoursePath | null;
  backendStage: LessonStage | null;
  matchPairs: { left: string; right: string }[];
  stageIdx: number;
  totalStages: number;
  onCorrect: () => void;
  onIncorrect: () => void;
  onHintUsed: () => void;
  onAdvanceStage: () => void;
  onCompletePhase: () => Promise<void>;
}

export function useArenaStageFlow({
  lessonSession,
  isSessionInteractive,
  backendCourse,
  backendStage,
  matchPairs,
  stageIdx,
  totalStages,
  onCorrect,
  onIncorrect,
  onHintUsed,
  onAdvanceStage,
  onCompletePhase,
}: UseArenaStageFlowParams) {
  const submitStage = useCallback(
    async (stageToSubmit: LessonStage, userInput: unknown) => {
      if (!lessonSession || !isSessionInteractive) {
        return;
      }

      const response = await apiFetch<SubmissionResponse>("/lessons/submit-answer", {
        method: "POST",
        body: JSON.stringify({
          sessionId: lessonSession.sessionId,
          stageId: stageToSubmit.stageId,
          userInput,
          context_topic:
            backendCourse?.topic || backendCourse?.courseTitle || stageToSubmit.topic,
          component: stageToSubmit.component,
        }),
      });

      if (response.result === "correct") {
        onCorrect();
      } else if (response.result === "incorrect") {
        onIncorrect();
      }

      return response;
    },
    [backendCourse, isSessionInteractive, lessonSession, onCorrect, onIncorrect]
  );

  const consumeHintCredits = useCallback(async () => {
    try {
      await spendAuthenticatedCredits(10);
      onHintUsed();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 402) {
        return false;
      }
      throw error;
    }
  }, [onHintUsed]);

  const matchingStage = useMatchingPairsStage({
    pairs: matchPairs,
    enabled: backendStage?.component === "MatchingPairs",
    onCorrectStageComplete: async (pairsPayload) => {
      if (!backendStage) {
        return;
      }

      const response = await submitStage(backendStage, { matches: pairsPayload });
      if (!response) {
        return;
      }

      if (response.result === "correct") {
        matchingStage.markCorrectFeedback();
        return;
      }

      matchingStage.markIncorrectFeedback();
    },
    onHintUse: consumeHintCredits,
  });

  const continueStage = useCallback(() => {
    if (stageIdx < totalStages - 1) {
      onAdvanceStage();
      matchingStage.clearFeedback();
      return;
    }

    void onCompletePhase();
  }, [matchingStage, onAdvanceStage, onCompletePhase, stageIdx, totalStages]);

  const skipStage = useCallback(
    async (stageToSkip: LessonStage) => {
      const response = await submitStage(stageToSkip, { skipped: true });
      if (!response) {
        return;
      }
      continueStage();
    },
    [continueStage, submitStage]
  );

  const useHint = useCallback(() => consumeHintCredits(), [consumeHintCredits]);

  return {
    matchingStage,
    submitStage,
    continueStage,
    skipStage,
    useHint,
  };
}
