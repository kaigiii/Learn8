"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { NODE_STATUS, type NodeStatus, JOB_STATUS } from "@/lib/domain/statuses";
import { useRequireAuthRedirect } from "@/lib/auth/useRequireAuthRedirect";
import type { CoursePath } from "@/lib/apiTypes";
import { clearRecentCourseNavigation } from "@/lib/navigation/intents";
import { watchJobStream } from "@/lib/jobs/stream";

export interface CourseMapNode {
  id: string;
  title: string;
  description: string;
  status: NodeStatus;
  hasGeneratedLesson?: boolean;
  unitTitle?: string;
  isUnitHeader?: boolean;
  unitNumber?: number;
  x: number;
  y: number;
  theta: number;
}

const NODE_VERTICAL_SPACING = 160;
const MAP_TOP_OFFSET = 70;
const FIRST_NODE_DOWN_OFFSET = 56;
const MAP_BOTTOM_PADDING = 180;

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

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobProgress, setActiveJobProgress] = useState<number>(0);
  const [activeJobMessage, setActiveJobMessage] = useState<string>("");

  const [isMapReady, setIsMapReady] = useState(false);

  const [isFreshNav] = useState(() => {
    if (typeof window === "undefined") return true;
    const isJustCompleted = sessionStorage.getItem("just_completed_node") === "true";
    return !isJustCompleted;
  });

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

  useEffect(() => {
    if (!isBackendCourse || !courseId || !isReady || backendLoading) return;

    let eventSource: EventSource | null = null;
    let isUnmounted = false;

    const connectJob = (jobId: string) => {
      if (isUnmounted) return;
      setActiveJobId(jobId);
      
      eventSource = watchJobStream(jobId, {
        onUpdate: (data) => {
          if (isUnmounted) return;
          setActiveJobProgress(data.progress ?? 0);
          setActiveJobMessage(data.message || "Generating lesson...");
        },
        onCompleted: async () => {
          if (isUnmounted) return;
          setActiveJobId(null);
          // Reload the course map
          try {
            const data = await apiFetch<CoursePath>(`/courses/${courseId}`);
            setBackendCourse(data);
          } catch (err) {
            console.error("Failed to reload course map", err);
          }
          // Check for next job after a short delay
          setTimeout(() => {
            if (!isUnmounted) void checkActiveJob();
          }, 1500);
        },
        onFailed: () => {
          if (isUnmounted) return;
          setActiveJobId(null);
          setTimeout(() => {
            if (!isUnmounted) void checkActiveJob();
          }, 1500);
        },
        onCancelled: () => {
          if (isUnmounted) return;
          setActiveJobId(null);
        }
      });
    };

    const checkActiveJob = async () => {
      try {
        const response = await apiFetch<{ job_id: string | null; status?: string }>(
          `/jobs/active?course_id=${courseId}&job_type=LESSON_GENERATION`
        );
        const isActive =
          response.status === JOB_STATUS.PENDING ||
          response.status === JOB_STATUS.PROCESSING;

        if (response.job_id && isActive && !isUnmounted) {
          connectJob(response.job_id);
        } else if (!isUnmounted) {
          setActiveJobId(null);
        }
      } catch (err) {
        console.error("Failed to check active jobs:", err);
      }
    };

    void checkActiveJob();

    return () => {
      isUnmounted = true;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [courseId, isBackendCourse, isReady, backendLoading]);

  const nodes = useMemo<CourseMapNode[]>(() => {
    const buildPositions = (
      sourceNodes: {
        id: string;
        title: string;
        description: string;
        status: NodeStatus;
        hasGeneratedLesson?: boolean;
        unitTitle?: string;
        isUnitHeader?: boolean;
        unitNumber?: number;
      }[]
    ) => {
      let currentTheta = 0;
      let lastUnitHeaderTheta = -180;

      return sourceNodes.map((node, index) => {
        if (node.isUnitHeader) {
          if (index === 0) {
            currentTheta = 0;
          } else {
            // Ensure at least 180 deg from previous unit header
            // and must be a multiple of 180 (0, 180, 360...)
            // and must be at least 90 deg from previous node
            currentTheta = Math.max(
              lastUnitHeaderTheta + 180,
              Math.ceil((currentTheta + 89) / 180) * 180
            );
          }
          lastUnitHeaderTheta = currentTheta;
        } else {
          // Regular node
          // Consecutive nodes must alternate sides (90 deg -> 270 deg -> 450 deg...)
          if (index > 0 && !sourceNodes[index - 1].isUnitHeader) {
            currentTheta += 180;
          } else {
            // First node after unit header: move to next peak (90, 270, 450...)
            currentTheta = Math.ceil((currentTheta + 44) / 90) * 90;
            if (currentTheta % 180 === 0) currentTheta += 90;
          }
        }

        const amp = 24;
        const x = 50 + amp * Math.sin((currentTheta * Math.PI) / 180);
        // Map theta to y. Scale 180 deg to the standard vertical spacing.
        const y = currentTheta * (NODE_VERTICAL_SPACING / 180) + MAP_TOP_OFFSET + (index === 0 ? FIRST_NODE_DOWN_OFFSET : 0);

        return {
          id: node.id,
          title: node.title,
          description: node.description,
          status: node.status,
          hasGeneratedLesson: node.hasGeneratedLesson,
          unitTitle: node.unitTitle,
          isUnitHeader: node.isUnitHeader,
          unitNumber: node.unitNumber,
          x,
          y,
          theta: currentTheta,
        };
      });
    };

    if (!backendCourse) return [];

    const sourceNodes: any[] = [];
    backendCourse.units.forEach((unit, uIndex) => {
      sourceNodes.push({
        id: `unit-header-${uIndex + 1}`,
        title: unit.unitTitle || `Unit ${uIndex + 1}`,
        description: "",
        status: NODE_STATUS.AVAILABLE,
        isUnitHeader: true,
        unitNumber: uIndex + 1,
        unitTitle: unit.unitTitle,
      });

      unit.nodes.forEach((node) => {
        sourceNodes.push({
          id: node.id,
          title: node.title,
          description: node.description,
          status: node.status,
          hasGeneratedLesson: node.hasGeneratedLesson,
          unitTitle: unit.unitTitle,
          isUnitHeader: false,
        });
      });
    });

    return buildPositions(sourceNodes);
  }, [backendCourse]);

  const maxY = nodes.length > 0 ? Math.max(...nodes.map((n) => n.y)) : 0;
  const mapHeight = Math.max(680, maxY + MAP_BOTTOM_PADDING);

  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (nodes.length === 0 || !mapContainerRef.current || hasScrolledRef.current) return;

    const container = mapContainerRef.current;

    const timer = setTimeout(() => {
      // 找到正要進行的關卡 (AVAILABLE 或最近一次 COMPLETED)，排除 Unit Header 節點
      const focusNode =
        nodes.find((node) => node.status === NODE_STATUS.AVAILABLE && !node.isUnitHeader) ||
        (lastActiveNodeId ? nodes.find((node) => node.id === lastActiveNodeId && !node.isUnitHeader) : null) ||
        [...nodes].reverse().find((node) => node.status === NODE_STATUS.COMPLETED && !node.isUnitHeader) ||
        nodes.find((node) => !node.isUnitHeader) ||
        nodes[0];

      const targetTop = Math.max(
        0,
        Math.min(
          mapHeight - container.clientHeight,
          focusNode.y - container.clientHeight / 2 + 32
        )
      );

      // 若是剛完成關卡返回課綱畫面，直接瞬間滾動到該關卡，不執行由底向上的平滑滾動動畫
      if (!isFreshNav) {
        container.scrollTop = targetTop;
        sessionStorage.removeItem("just_completed_node");
        setIsMapReady(true);
        hasScrolledRef.current = true;
        return;
      }

      // 一進入時，直接設定到最底部，利用穩定的 mapHeight 避免 DOM 滾動高度未更新導致卡住
      const startScrollTop = mapHeight - container.clientHeight;
      const endScrollTop = targetTop;

      container.scrollTop = startScrollTop;
      setIsMapReady(true);
      hasScrolledRef.current = true;

      // 設定 3000ms (3秒) 內平滑滑動到 focusNode
      const duration = 3000;
      const startTime = performance.now();

      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用 easeInOutCubic 平滑緩動
        const easeInOutCubic =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        container.scrollTop = startScrollTop + (endScrollTop - startScrollTop) * easeInOutCubic;

        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      };

      requestAnimationFrame(animateScroll);
    }, 300);

    return () => clearTimeout(timer);
  }, [nodes, lastActiveNodeId, mapHeight]);


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
    coursePath: backendCourse,
    setCoursePath: setBackendCourse,
    isBackendCourse,
    pageTitle: backendCourse?.courseTitle ?? "Course Map",
    nodes,
    mapHeight,
    mapContainerRef,
    isFreshNav,
    isMapReady,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    activeJobId,
    activeJobProgress,
    activeJobMessage,
  };
}
