"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { syncPersistedProfile } from "@/lib/auth/profileSync";
import type { CourseListItem, DraftData, UserProfile } from "@/lib/apiTypes";
import { useCourseStore } from "@/stores/app/useCourseStore";

export function useHomeDashboardData(token: string | null) {
  const currentCourseId = useCourseStore((s) => s.currentCourseId);
  const setCurrentCourse = useCourseStore((s) => s.setCurrentCourse);

  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [draftsByCourse, setDraftsByCourse] = useState<Record<number, DraftData>>({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const currentCourse =
    courses.find((course) => course.id === currentCourseId) ?? null;

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const [profile, courseData] = await Promise.all([
          apiFetch<UserProfile>("/auth/me"),
          apiFetch<CourseListItem[]>("/courses"),
        ]);
        const draftsByCourseMap = Object.fromEntries(
          courseData.map((course) => [course.id, course.draft_json || {}])
        );

        syncPersistedProfile(profile);
        setCourses(courseData);
        setDraftsByCourse(draftsByCourseMap);
        const persistedCourseId = useCourseStore.getState().currentCourseId;
        const resolvedCourse =
          courseData.find((course) => course.id === persistedCourseId) ??
          courseData[0] ??
          null;
        setCurrentCourse(resolvedCourse);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.detail
            : "Failed to load your learning library."
        );
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [token, setCurrentCourse]);

  return {
    currentCourse,
    setCurrentCourse,
    courses,
    setCourses,
    draftsByCourse,
    setDraftsByCourse,
    error,
    setError,
    isLoading,
  };
}
