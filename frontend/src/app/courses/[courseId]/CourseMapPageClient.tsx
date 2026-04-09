"use client";

import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import TopStatsBar from "@/components/layout/TopStatsBar";
import { NODE_STATUS } from "@/lib/domain/statuses";
import { useDelayedVisibility } from "@/lib/ui/useDelayedVisibility";
import { useCourseStore } from "@/stores/app/useCourseStore";
import useUserStore, { selectLastActiveNodeId } from "@/stores/app/useUserStore";
import { CourseMapAssistantPanel } from "./components/CourseMapAssistantPanel";
import { CourseMapBackground } from "./components/CourseMapBackground";
import { CourseMapNodePanel } from "./components/CourseMapNodePanel";
import { useCourseMapData, type CourseMapNode } from "./hooks/useCourseMapData";
import { useResolvedCourseRoute } from "./hooks/useResolvedCourseRoute";

export default function CourseMapPageClient({
  courseId: explicitCourseId,
}: {
  courseId?: string;
} = {}) {
  const { courseId, routeCourseId } = useResolvedCourseRoute({
    courseId: explicitCourseId,
  });
  const currentCourseId = useCourseStore((state) => state.currentCourseId);
  const setLastActiveCourse = useUserStore((state) => state.setLastActiveCourse);
  const lastActiveNodeId = useUserStore(selectLastActiveNodeId);

  const {
    backendError,
    backendLoading,
    coursePath,
    setCoursePath,
    isBackendCourse,
    pageTitle,
    nodes,
    mapHeight,
    mapContainerRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useCourseMapData({
    courseId,
    routeCourseId,
    setLastActiveCourse,
    lastActiveNodeId,
  });
  const showDelayedMapLoading = useDelayedVisibility(backendLoading, 220);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (nodes.length === 0) {
      return;
    }

    const preferredNodeId =
      (lastActiveNodeId && nodes.find((node) => node.id === lastActiveNodeId)?.id) ||
      nodes.find((node) => node.status === NODE_STATUS.AVAILABLE)?.id ||
      nodes.find((node) => node.status === NODE_STATUS.COMPLETED)?.id ||
      nodes[0]?.id ||
      null;

    setSelectedNodeId((prev) => {
      if (prev && nodes.some((node) => node.id === prev)) {
        return prev;
      }
      return preferredNodeId;
    });
  }, [lastActiveNodeId, nodes]);

  const selectedNode =
    nodes.find((node) => node.id === selectedNodeId) ?? null;

  if (!isBackendCourse) {
    return null;
  }

  return (
    <div
      className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]"
    >
      <TopStatsBar backHref="/home" pageTitle={pageTitle} />

      <CourseMapBackground />

      <div
        className="relative z-10 mx-auto flex max-w-7xl gap-6 px-6"
        style={{ height: "calc(100dvh - 72px)" }}
      >
        <div
          ref={mapContainerRef}
          className="scrollbar-hide min-w-0 flex-1 overflow-y-auto rounded-2xl"
          style={{ cursor: "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {showDelayedMapLoading && (
            <div className="mb-4 rounded-xl border border-sky-200 bg-white/75 px-4 py-3 text-sm text-brand-gray-600 shadow-sm backdrop-blur">
              Loading course map...
            </div>
          )}

          {backendError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {backendError}
            </div>
          )}

          <div className="relative" style={{ height: mapHeight, minHeight: 560 }}>
            <svg
              className="pointer-events-none absolute inset-0 z-0 h-full w-full"
              viewBox={`0 0 100 ${mapHeight}`}
              preserveAspectRatio="none"
              fill="none"
            >
              <defs>
                <linearGradient id="pathGrad" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#4a9e9b" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#8a7a60" stopOpacity="0.5" />
                </linearGradient>
              </defs>
              {nodes.slice(0, -1).map((node, index) => {
                const next = nodes[index + 1];
                const mx = (node.x + next.x) / 2;
                const my = (node.y + next.y) / 2;
                const isActive =
                  node.status !== NODE_STATUS.LOCKED ||
                  next.status !== NODE_STATUS.LOCKED;

                return (
                  <path
                    key={index}
                    d={`M ${node.x} ${node.y} Q ${mx + (index % 2 === 0 ? 12 : -12)} ${my} ${next.x} ${next.y}`}
                    stroke={isActive ? "url(#pathGrad)" : "#999"}
                    strokeWidth="1.8"
                    strokeDasharray="4 3"
                    opacity={isActive ? 0.85 : 0.45}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {nodes.map((node, index) => (
              <MapNodeCircle
                key={node.id}
                node={node}
                index={index}
                courseId={courseId}
                isSelected={node.id === selectedNodeId}
                onSelect={setSelectedNodeId}
              />
            ))}
          </div>
        </div>

        <div className="w-[340px] flex-shrink-0 overflow-y-auto pt-8">
          <div className="flex flex-col gap-5 pb-8">
            <CourseMapNodePanel
              courseId={courseId}
              coursePath={coursePath}
              selectedNode={selectedNode}
            />
            <CourseMapAssistantPanel
              coursePath={coursePath}
              courseId={Number(courseId) || currentCourseId}
              onCoursePathUpdated={setCoursePath}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MapNodeCircle({
  node,
  index,
  courseId,
  isSelected,
  onSelect,
}: {
  node: CourseMapNode;
  index: number;
  courseId: string;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
}) {
  const router = useRouter();
  const isClickable =
    node.status === NODE_STATUS.AVAILABLE ||
    node.status === NODE_STATUS.COMPLETED;

  const content = (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15 * index, type: "spring", damping: 14 }}
      className="flex cursor-pointer flex-col items-center gap-2 bg-transparent"
      onHoverStart={() => {
        if (isClickable) {
          void router.prefetch(`/courses/${courseId}/nodes/${node.id}`);
        }
      }}
      onClick={() => onSelect(node.id)}
      whileHover={isClickable ? { scale: 1.1 } : {}}
      whileTap={isClickable ? { scale: 0.92 } : {}}
    >
      {node.status === NODE_STATUS.AVAILABLE && (
        <>
          <motion.div
            className="absolute h-[88px] w-[88px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(122,199,196,0.25) 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute h-[76px] w-[76px]"
            animate={{ rotate: [0, 360] }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          >
            <svg viewBox="0 0 76 76" className="h-full w-full" fill="none">
              {Array.from({ length: 12 }).map((_, circleIndex) => {
                const angle = (circleIndex * 30 * Math.PI) / 180;
                const cx = 38 + 32 * Math.cos(angle);
                const cy = 38 + 32 * Math.sin(angle);
                return (
                  <circle
                    key={circleIndex}
                    cx={cx}
                    cy={cy}
                    r="8"
                    fill="none"
                    stroke="#7AC7C4"
                    strokeWidth="1"
                    opacity="0.3"
                  />
                );
              })}
            </svg>
          </motion.div>
        </>
      )}

      {node.status === NODE_STATUS.COMPLETED && (
        <motion.div
          className="absolute h-[78px] w-[78px]"
          animate={{ rotate: [0, -360] }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
        >
          <svg viewBox="0 0 78 78" className="h-full w-full" fill="none">
            {Array.from({ length: 10 }).map((_, circleIndex) => {
              const angle = (circleIndex * 36 * Math.PI) / 180;
              const cx = 39 + 33 * Math.cos(angle);
              const cy = 39 + 33 * Math.sin(angle);
              return (
                <circle
                  key={circleIndex}
                  cx={cx}
                  cy={cy}
                  r="7"
                  fill="none"
                  stroke="#F5C842"
                  strokeWidth="1"
                  opacity="0.35"
                />
              );
            })}
          </svg>
        </motion.div>
      )}

      <div
          className={`relative flex h-[64px] w-[64px] items-center justify-center rounded-full transition-all ${
          node.status === NODE_STATUS.COMPLETED
            ? "shadow-lg shadow-amber-300/30"
            : node.status === NODE_STATUS.AVAILABLE
            ? "shadow-lg shadow-teal-400/30"
            : "shadow-md"
        }`}
      >
        <div
          className={`absolute inset-0 rounded-full ${
            node.status === NODE_STATUS.COMPLETED
              ? "bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500"
              : node.status === NODE_STATUS.AVAILABLE
              ? "bg-gradient-to-br from-[#7AC7C4] via-[#5fb3af] to-[#4da8a4]"
              : "bg-gradient-to-br from-[#e0ddd8] via-[#d4d0ca] to-[#c8c4be]"
          }`}
        />
        <div
          className={`absolute inset-[3px] rounded-full border-2 ${
            isSelected
              ? "border-brand-teal/80"
              : node.status === NODE_STATUS.COMPLETED
              ? "border-yellow-200/50"
              : node.status === NODE_STATUS.AVAILABLE
              ? "border-white/30"
              : "border-white/20"
          }`}
        />
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div
            className="absolute -top-1 left-1/2 h-[40%] w-[70%] -translate-x-1/2 rounded-[50%]"
            style={{
              background:
                node.status === NODE_STATUS.LOCKED
                  ? "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)"
                  : "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)",
            }}
          />
        </div>

        <div className="relative z-10">
          {node.status === NODE_STATUS.COMPLETED ? (
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7 text-white drop-shadow-sm"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : node.status === NODE_STATUS.AVAILABLE ? (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-white drop-shadow-sm" fill="currentColor">
                <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
              </svg>
            </motion.div>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-[#a09a92]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          )}
        </div>
      </div>

      <span
        className={`max-w-[100px] text-center font-heading text-[11px] font-bold leading-tight drop-shadow-sm ${
          node.status === NODE_STATUS.COMPLETED
            ? "text-amber-700"
            : node.status === NODE_STATUS.AVAILABLE
            ? "text-teal-700"
            : "text-brand-gray-400"
        }`}
      >
        {node.title}
      </span>
    </motion.button>
  );

  return (
    <div
      className="absolute z-10"
      style={{
        left: `${node.x}%`,
        top: `${node.y}px`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {content}
    </div>
  );
}
