"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import type { CoursePath } from "@/lib/apiTypes";

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
  explicitCourseId,
  paramsCourseId,
  token,
  setLastActiveCourse,
}: {
  courseId: string;
  explicitCourseId?: string;
  paramsCourseId?: string;
  token: string | null;
  setLastActiveCourse: (courseId: string) => void;
}) {
  const router = useRouter();
  const hasResolvedCourseId = courseId.length > 0;
  const isBackendCourse = /^\d+$/.test(courseId);
  const [backendCourse, setBackendCourse] = useState<CoursePath | null>(null);
  const [backendError, setBackendError] = useState("");
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasResolvedCourseId) return;
    if (!isBackendCourse) {
      console.warn("[CourseMapPageClient] Invalid courseId, staying on page", {
        explicitCourseId: explicitCourseId ?? null,
        paramsCourseId: paramsCourseId ?? null,
        resolvedCourseId: courseId,
      });
      setBackendError("Invalid course route.");
      return;
    }
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    const load = async () => {
      try {
        console.info("[CourseMapPageClient] Loading backend course", {
          courseId,
          explicitCourseId: explicitCourseId ?? null,
        });
        const data = await apiFetch<CoursePath>(`/courses/${courseId}`);
        setBackendCourse(data);
      } catch (err) {
        console.error("[CourseMapPageClient] Failed to load backend course", {
          courseId,
          explicitCourseId: explicitCourseId ?? null,
          error: err instanceof ApiError ? err.detail : String(err),
        });
        setBackendError(
          err instanceof ApiError ? err.detail : "Failed to load course map."
        );
      }
    };

    void load();
  }, [courseId, explicitCourseId, hasResolvedCourseId, isBackendCourse, paramsCourseId, router, token]);

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
    window.sessionStorage.removeItem("learn8_recent_course_navigation");
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
    container.scrollTop = 0;

    let frameId = 0;
    let startTime: number | null = null;
    const targetTop = container.scrollHeight;
    const duration = 2200;

    const easeInOutCubic = (progress: number) =>
      progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const animateScroll = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      container.scrollTop = targetTop * easeInOutCubic(progress);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animateScroll);
      }
    };

    const timer = window.setTimeout(() => {
      frameId = window.requestAnimationFrame(animateScroll);
    }, 150);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frameId);
    };
  }, [nodes.length]);

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
