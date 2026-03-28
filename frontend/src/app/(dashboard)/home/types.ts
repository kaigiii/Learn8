import type { CourseListItem } from "@/lib/apiTypes";

export type CourseModalState =
  | {
      type: "rename";
      course: CourseListItem;
      draftName: string;
      submitting: boolean;
      renameTarget: "course" | "draft";
      courseId?: number;
    }
  | { type: "delete"; course: CourseListItem; submitting: boolean }
  | null;
