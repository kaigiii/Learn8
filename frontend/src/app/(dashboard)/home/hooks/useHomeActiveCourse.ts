"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { COURSE_STATUS, NODE_STATUS } from "@/lib/domain/statuses";
import type { CourseListItem, CoursePath } from "@/lib/apiTypes";

interface UseHomeActiveCourseParams {
  currentCourse: CourseListItem | null;
  courses: CourseListItem[];
}

export function useHomeActiveCourse({
  currentCourse,
  courses,
}: UseHomeActiveCourseParams) {
  const [activeCoursePath, setActiveCoursePath] = useState<CoursePath | null>(null);
  const [activeCourseLoading, setActiveCourseLoading] = useState(false);
  const [activeCourseError, setActiveCourseError] = useState("");

  const activeCourse = useMemo(
    () =>
      currentCourse?.status === COURSE_STATUS.READY
        ? currentCourse
        : courses.find((course) => course.status === COURSE_STATUS.READY) || null,
    [courses, currentCourse]
  );

  useEffect(() => {
    if (!activeCourse) {
      setActiveCoursePath(null);
      setActiveCourseLoading(false);
      setActiveCourseError("");
      return;
    }

    let cancelled = false;

    const loadCourseDetail = async () => {
      setActiveCourseLoading(true);
      setActiveCourseError("");
      try {
        const data = await apiFetch<CoursePath>(`/courses/${activeCourse.id}`);
        if (!cancelled) {
          setActiveCoursePath(data);
        }
      } catch (err) {
        if (!cancelled) {
          setActiveCoursePath(null);
          setActiveCourseError(
            err instanceof ApiError ? err.detail : "Failed to load active course."
          );
        }
      } finally {
        if (!cancelled) {
          setActiveCourseLoading(false);
        }
      }
    };

    void loadCourseDetail();

    return () => {
      cancelled = true;
    };
  }, [activeCourse]);

  const allNodes = activeCoursePath?.units.flatMap((unit) => unit.nodes) ?? [];
  const resumeNodeCount = allNodes.length;
  const completedNodeCount = allNodes.filter(
    (node) => node.status === NODE_STATUS.COMPLETED
  ).length;
  const activeProgress =
    resumeNodeCount > 0
      ? Math.round((completedNodeCount / resumeNodeCount) * 100)
      : 0;

  return {
    activeCourse,
    activeCoursePath,
    activeCourseLoading,
    activeCourseError,
    activeCourseId: activeCourse ? String(activeCourse.id) : null,
    resumeTitle: activeCourse?.title ?? "Course",
    resumeNodeCount,
    activeProgress,
    hasResumeCourse: !!activeCourse,
  };
}
