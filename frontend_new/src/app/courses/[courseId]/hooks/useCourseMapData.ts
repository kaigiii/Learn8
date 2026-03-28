"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import type { CoursePath } from "@/lib/apiTypes";
import { clearRecentCourseNavigation } from "@/lib/navigation/intents";

export interface CourseMapNode {
  id: string;
  title: string;
  status: "completed" | "available" | "locked";
  x: number;
  y: number;
}

const X_PATTERN = [50, 28, 68, 32, 58, 40, 65, 30, 55, 42, 62, 35, 58, 45, 50];

export function useCourseMapData({
  courseId,
  routeCourseId,
  setLastActiveCourse,
  lastActiveNodeId,
}: {
  courseId: string;
  routeCourseId?: string;
  setLastActiveCourse: (courseId: string) => void;
  lastActiveNodeId: string | null;
}) {
  const router = useRouter();
  const { isReady } = useRequireAuthRedirect();
  const hasResolvedCourseId = courseId.length > 0;
  const isBackendCourse = /^\d+$/.test(courseId);
  const [backendCourse, setBackendCourse] = useState<CoursePath | null>(null);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState("");
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasResolvedCourseId) return;
    if (!isBackendCourse) {
      setBackendError("Invalid course route.");
      return;
    }
    if (!isReady) return;

    const load = async () => {
      setBackendLoading(true);
      setBackendError("");
      try {
        const data = await apiFetch<CoursePath>(`/courses/${courseId}`);
        setBackendCourse(data);
      } catch (err) {
        setBackendError(
          err instanceof ApiError ? err.detail : "Failed to load course map."
        );
      } finally {
        setBackendLoading(false);
      }
    };

    void load();
  }, [courseId, hasResolvedCourseId, isBackendCourse, isReady, routeCourseId, router]);

  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (courseId) setLastActiveCourse(courseId);
  }, [courseId, setLastActiveCourse]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isBackendCourse) return;
    clearRecentCourseNavigation();
  }, [isBackendCourse]);

  const nodes = useMemo<CourseMapNode[]>(() => {
    const buildPositions = (
      sourceNodes: { id: string; title: string; status: "completed" | "available" | "locked" }[]
    ) => {
      const count = sourceNodes.length;
      const spacing = 120;
      return sourceNodes.map((node, index) => ({
        id: node.id,
        title: node.title,
        status: node.status,
        x: X_PATTERN[index % X_PATTERN.length],
        y: (count - 1 - index) * spacing + 60,
      }));
    };

    if (!backendCourse) return [];

    return buildPositions(
      backendCourse.units.flatMap((unit) =>
        unit.nodes.map((node) => ({
          id: node.id,
          title: node.title,
          status: node.status,
        }))
      )
    );
  }, [backendCourse]);

  const mapHeight = Math.max(560, nodes.length * 120 + 120);

  useEffect(() => {
    if (nodes.length === 0 || !mapContainerRef.current) return;

    const container = mapContainerRef.current;
    const focusNode =
      (lastActiveNodeId
        ? nodes.find((node) => node.id === lastActiveNodeId)
        : null) ||
      nodes.find((node) => node.status === "available") ||
      [...nodes].reverse().find((node) => node.status === "completed") ||
      nodes[0];

    const targetTop = Math.max(
      0,
      focusNode.y - container.clientHeight / 2 + 32
    );

    container.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  }, [lastActiveNodeId, nodes]);

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    const container = mapContainerRef.current;
    if (!container) return;

    isDragging.current = true;
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    container.style.cursor = "grabbing";
    container.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging.current) return;
    const container = mapContainerRef.current;
    if (!container) return;

    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    container.scrollTop = dragStart.current.scrollTop - dy;
    container.scrollLeft = dragStart.current.scrollLeft - dx;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    const container = mapContainerRef.current;
    if (!container) return;
    container.style.cursor = "grab";
    container.style.userSelect = "";
  }, []);

  return {
    backendError,
    backendLoading,
    isBackendCourse,
    pageTitle: backendCourse?.courseTitle ?? "Course Map",
    nodes,
    mapHeight,
    mapContainerRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
