"use client";

import type { UserProfile } from "@/lib/apiTypes";

export const ONBOARDING_REQUIRED_FIELDS = [
  "full_name",
  "education_level",
  "preferred_language",
  "daily_learning_goal_minutes",
] as const;

export function isProfileOnboardingComplete(profile: UserProfile | null | undefined) {
  if (!profile) return false;
  return Boolean(
    profile.full_name?.trim() &&
      profile.education_level?.trim() &&
      profile.preferred_language?.trim() &&
      typeof profile.daily_learning_goal_minutes === "number" &&
      profile.daily_learning_goal_minutes > 0
  );
}

export function goalMinutesToPreset(minutes: number | null | undefined) {
  switch (minutes) {
    case 5:
      return "casual";
    case 10:
      return "regular";
    case 20:
      return "serious";
    case 30:
      return "intense";
    default:
      return "";
  }
}

export function deriveOnboardingStateFromProfile(profile: UserProfile) {
  return {
    onboarded: isProfileOnboardingComplete(profile),
    selectedTopics: [],
    dailyGoal: goalMinutesToPreset(profile.daily_learning_goal_minutes),
  };
}

export function presetToGoalMinutes(goal: string) {
  switch (goal) {
    case "casual":
      return 5;
    case "regular":
      return 10;
    case "serious":
      return 20;
    case "intense":
      return 30;
    default:
      return undefined;
  }
}
