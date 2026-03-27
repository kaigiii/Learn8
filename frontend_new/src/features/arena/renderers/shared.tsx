"use client";

import type { LessonStage, SubmissionResponse } from "@/lib/apiTypes";

export function StageComponentLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="rounded-3xl bg-white/70 px-6 py-5 text-sm text-brand-gray-600 shadow-sm">
        Loading stage...
      </div>
    </div>
  );
}

export function getFeynmanSubmitResult(
  response: SubmissionResponse | void
) {
  return {
    feedback:
      typeof response?.evaluation?.grading === "object" &&
      response?.evaluation?.grading &&
      "feedback" in response.evaluation.grading
        ? String(
            (
              response.evaluation.grading as {
                feedback?: unknown;
              }
            ).feedback || ""
          )
        : response?.message,
    result: response?.result,
  };
}

export function normalizeChoiceOptions(stage: LessonStage) {
  const rawOptions = Array.isArray(stage.config.data?.options)
    ? stage.config.data.options
    : [];

  return rawOptions.map((option, index) => {
    if (typeof option === "string") {
      return { id: `option-${index}`, text: option };
    }
    if (option && typeof option === "object") {
      const item = option as { id?: string; text?: string; label?: string };
      return {
        id: item.id || `option-${index}`,
        text: item.text || item.label || `Option ${index + 1}`,
      };
    }
    return { id: `option-${index}`, text: `Option ${index + 1}` };
  });
}

export function getCorrectOptionId(stage: LessonStage) {
  const data = stage.config.data as {
    correctId?: string;
    correctOptionId?: string;
  };
  const validation = stage.validation.condition as {
    correctId?: string;
    correctOptionId?: string;
  };

  return (
    data.correctId ||
    data.correctOptionId ||
    validation.correctId ||
    validation.correctOptionId ||
    ""
  );
}
