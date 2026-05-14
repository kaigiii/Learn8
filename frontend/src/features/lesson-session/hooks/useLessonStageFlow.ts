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
      const isFinalStage = stageIdx >= totalStages - 1;

      // Advance immediately so the user isn't waiting on a network round-trip.
      // (This must not depend on lessonSession — public courses may have a
      // session that hasn't fully entered the interactive state yet.)
      if (!isFinalStage) {
        onAdvanceStage();
        // Queue the submission AFTER the UI commits. submitStage itself
        // already no-ops when the session isn't interactive, so this is safe.
        setTimeout(() => {
          void submitStage(stageToSkip, { skipped: true });
          advanceLockRef.current = false;
        }, 0);
        return;
      }

      // Final stage: fire-and-forget the skip submission and immediately
      // kick off phase completion so the transition panel shows up without
      // waiting on the submit round-trip. complete-primary is the only
      // request that actually gates navigation; the skip record is purely
      // bookkeeping and the backend tolerates either ordering.
      void submitStage(stageToSkip, { skipped: true }).catch(() => {
        // submitStage handles conflict recovery internally.
      });

      try {
        await onCompletePhase();
      } catch {
        // complete phase already reports errors; avoid unhandled rejections.
      } finally {
        advanceLockRef.current = false;
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
