import type { Project } from "@/lib/apiTypes";

export type ProjectModalState =
  | { type: "rename"; project: Project; draftName: string; submitting: boolean }
  | { type: "delete"; project: Project; submitting: boolean }
  | null;
