"use client";

import { useCallback, useRef } from "react";
import { spendAuthenticatedCredits } from "@/lib/auth/profileSync";
import { ApiError, apiFetch } from "@/lib/apiClient";
import type {
  CoursePath,
  LessonSessionPayload,
  LessonStage,
  SubmissionResponse,
} from "@/lib/apiTypes";

interface UseLessonStageFlowParams {
  lessonSession: LessonSessionPayload | null;
  isSessionInteractive: boolean;
  backendCourse: CoursePath | null;
  stageIdx: number;
  totalStages: number;
  onCorrect: () => void;
  onIncorrect: () => void;
  onHintUsed: () => void;
  onAdvanceStage: () => void;
  onCompletePhase: () => Promise<void>;
  onSubmissionConflict: () => Promise<void>;
}

export function useLessonStageFlow({
  lessonSession,
  isSessionInteractive,
  backendCourse,
  stageIdx,
  totalStages,
  onCorrect,
  onIncorrect,
  onHintUsed,
  onAdvanceStage,
  onCompletePhase,
  onSubmissionConflict,
}: UseLessonStageFlowParams) {
  const submitStage = useCallback(
    async (stageToSubmit: LessonStage, userInput: unknown) => {
      if (!lessonSession || !isSessionInteractive) {
        return;
      }

      let response: SubmissionResponse;
      try {
        response = await apiFetch<SubmissionResponse>("/lessons/submit-answer", {
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
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 409 &&
          typeof error.detail === "string" &&
          error.detail.includes("not accepting submissions")
        ) {
          await onSubmissionConflict();
          return;
        }
        throw error;
      }

      if (response.result === "correct") {
        onCorrect();
      } else if (response.result === "incorrect") {
        onIncorrect();
      }

      return response;
    },
    [
      backendCourse,
      isSessionInteractive,
      lessonSession,
      onCorrect,
      onIncorrect,
      onSubmissionConflict,
    ]
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

  // Guards against rapid double-clicks: once an advance/skip is in flight,
  // further calls are ignored until the current one resolves.
  const advanceLockRef = useRef(false);

  const continueStage = useCallback(() => {
    if (advanceLockRef.current) return;
    advanceLockRef.current = true;
    // Release on next tick — by then React has applied the stageIdx update
    // and the new stage is rendered, so the user can act again.
    setTimeout(() => {
      advanceLockRef.current = false;
    }, 0);

    if (stageIdx < totalStages - 1) {
      onAdvanceStage();
      return;
    }

    void onCompletePhase();
  }, [onAdvanceStage, onCompletePhase, stageIdx, totalStages]);

  const skipStage = useCallback(
    async (stageToSkip: LessonStage) => {
      if (advanceLockRef.current) return;
      advanceLockRef.current = true;

      let advanced = false;
      try {
        const response = await submitStage(stageToSkip, { skipped: true });
        if (!response) return;
        // Inline the advance — we already hold the lock, so don't go through
        // continueStage() which would re-check the lock and bail.
        if (stageIdx < totalStages - 1) {
          onAdvanceStage();
        } else {
          void onCompletePhase();
        }
        advanced = true;
      } finally {
        if (advanced) {
          // Defer release so React commits the new stageIdx and the old
          // SKIP button unmounts before another click can re-enter.
          setTimeout(() => { advanceLockRef.current = false; }, 0);
        } else {
          // No advance happened — let the user retry immediately.
          advanceLockRef.current = false;
        }
      }
    },
    [onAdvanceStage, onCompletePhase, stageIdx, submitStage, totalStages]
  );

  const useHint = useCallback(() => consumeHintCredits(), [consumeHintCredits]);

  return {
    submitStage,
    continueStage,
    skipStage,
    useHint,
  };
}
