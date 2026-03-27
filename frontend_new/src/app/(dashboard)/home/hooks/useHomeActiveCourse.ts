"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/apiClient";
import type { CourseListItem, CoursePath, Project } from "@/lib/apiTypes";

interface UseHomeActiveCourseParams {
  currentProject: Project | null;
  courses: CourseListItem[];
}

export function useHomeActiveCourse({
  currentProject,
  courses,
}: UseHomeActiveCourseParams) {
  const [activeCoursePath, setActiveCoursePath] = useState<CoursePath | null>(null);
  const [activeCourseLoading, setActiveCourseLoading] = useState(false);
  const [activeCourseError, setActiveCourseError] = useState("");

  const activeCourse = useMemo(
    () =>
      currentProject
        ? courses.find((course) => course.project_id === currentProject.id) || null
        : null,
    [courses, currentProject]
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
    (node) => node.status === "completed"
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
