"use client";

import { useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";

interface UseResolvedLessonRouteParams {
  courseId?: string;
  nodeId?: string;
}

function parseNumericParam(value: string | null | undefined) {
  return value && /^\d+$/.test(value) ? value : null;
}

function parseNumericSearchParam(value: string | null) {
  return value && /^\d+$/.test(value) ? Number(value) : null;
}

export function useResolvedLessonRoute({
  courseId: explicitCourseId,
  nodeId: explicitNodeId,
}: UseResolvedLessonRouteParams = {}) {
  const params = useParams();
  const searchParams = useSearchParams();

  const nodeId = explicitNodeId ?? (params.nodeId as string | undefined) ?? "";
  const routeCourseId =
    explicitCourseId ?? (params.courseId as string | undefined) ?? null;

  const backendCourseId = useMemo(() => {
    const searchCourseId = searchParams.get("courseId");
    return parseNumericParam(routeCourseId) ?? parseNumericParam(searchCourseId);
  }, [routeCourseId, searchParams]);

  const sessionId = useMemo(() => {
    return parseNumericSearchParam(searchParams.get("sessionId"));
  }, [searchParams]);

  return {
    nodeId,
    routeCourseId,
    backendCourseId,
    backendCourseIdNumber: backendCourseId ? Number(backendCourseId) : null,
    sessionId,
    isBackendCourse: backendCourseId !== null,
  };
}
