"use client";

export type QuestionResult = "correct" | "incorrect" | "skipped";

export interface QuestionStageMeta {
  stageIndex: number;
  totalStages: number;
  stageLabel?: string;
  topic: string;
  description?: string;
  difficulty?: "low" | "medium" | "high" | null;
  recommendedDurationMinutes?: number | null;
  courseId?: number | null;
}

export interface QuestionFeedbackMessages {
  success: string;
  error: string;
  hint: string;
}

export interface QuestionCommonActions {
  onSkip?: () => void;
  onHintUse?: () => Promise<boolean>;
}

export interface QuestionSubmitResponse {
  feedback?: string;
  result?: QuestionResult;
}
