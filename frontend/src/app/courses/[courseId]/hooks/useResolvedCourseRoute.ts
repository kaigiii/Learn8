"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";

interface UseResolvedCourseRouteParams {
  courseId?: string;
}

function parseCourseId(value: string | null | undefined) {
  return typeof value === "string" ? value : "";
}

export function useResolvedCourseRoute({
  courseId: explicitCourseId,
}: UseResolvedCourseRouteParams = {}) {
  const params = useParams();

  const routeCourseId = parseCourseId(params.courseId as string | undefined);
  const courseId = useMemo(
    () => parseCourseId(explicitCourseId) || routeCourseId,
    [explicitCourseId, routeCourseId]
  );

  return {
    courseId,
    routeCourseId,
    isBackendCourse: /^\d+$/.test(courseId),
    hasResolvedCourseId: courseId.length > 0,
  };
}
