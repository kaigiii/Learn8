"use client";

import { apiFetch } from "@/lib/apiClient";
import type { CourseListItem, CoursePath } from "@/lib/apiTypes";

/**
 * Fetch all public courses owned by the system user.
 */
export function fetchPublicCourses() {
  return apiFetch<CourseListItem[]>("/courses/public");
}

/**
 * Fetch detail for a specific course (works for both personal and public courses).
 */
export function fetchCourseDetail(courseId: number | string) {
  return apiFetch<CoursePath>(`/courses/${courseId}`);
}
