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
import { useI18n } from "@/lib/i18n/useI18n";

const COMPACT_VIEWPORT_MEDIA_QUERY = "(max-width: 1023px)";

export default function CourseMapPageClient({
  courseId: explicitCourseId,
}: {
  courseId?: string;
} = {}) {
  const { courseId, routeCourseId } = useResolvedCourseRoute({
    courseId: explicitCourseId,
  });
  const { t } = useI18n();
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
    isFreshNav,
    isMapReady,
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
  const [isCompactViewport, setIsCompactViewport] = React.useState(true);
  const [isNodePanelOpen, setIsNodePanelOpen] = React.useState(false);
  const [isAssistantPanelOpen, setIsAssistantPanelOpen] = React.useState(false);
  const previousCompactViewportRef = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    const media = window.matchMedia(COMPACT_VIEWPORT_MEDIA_QUERY);
    const applyViewport = (compact: boolean) => {
      setIsCompactViewport(compact);
      if (previousCompactViewportRef.current === null || previousCompactViewportRef.current !== compact) {
        setIsNodePanelOpen(!compact);
      }
      previousCompactViewportRef.current = compact;
    };

    applyViewport(media.matches);
    const handleChange = (event: MediaQueryListEvent) => {
      applyViewport(event.matches);
    };

    media.addEventListener("change", handleChange);
    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  React.useEffect(() => {
    if (nodes.length === 0) {
      return;
    }

    const preferredNodeId =
      nodes.find((node) => node.status === NODE_STATUS.AVAILABLE && !node.isUnitHeader)?.id ||
      (lastActiveNodeId && nodes.find((node) => node.id === lastActiveNodeId && !node.isUnitHeader)?.id) ||
      nodes.find((node) => node.status === NODE_STATUS.COMPLETED && !node.isUnitHeader)?.id ||
      nodes.find((node) => !node.isUnitHeader)?.id ||
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
  const showAssistantPanel = Boolean(coursePath && !coursePath.isPublic);

  if (!isBackendCourse) {
    return null;
  }

  return (
    <div
      className="relative min-h-dvh overflow-hidden app-shared-bg"
    >
      <TopStatsBar
        backHref="/home"
        pageTitle={pageTitle}
        mascotSrc="/icons/icon.ico"
        mascotAlt="Course mascot"
        mascotImageClassName="scale-110"
        quickLinks={[
          {
            href: "/multiplayer",
            label: t("common.multiplayer"),
            iconSrc: "/svg/multiplayer-controller.svg",
            iconAlt: "Multiplayer",
          },
          {
            href: "/arena/leaderboard",
            label: t("common.leaderboard"),
            iconSrc: "/svg/leaderboard-logo.svg",
            iconAlt: "Leaderboard",
          },
        ]}
      />

      <CourseMapBackground />

      <div
        className="relative z-10 mx-auto max-w-[1580px] px-3 sm:px-4 md:px-6 lg:grid lg:gap-8"
        style={{
          height: "calc(100dvh - 72px)",
          gridTemplateColumns: isCompactViewport ? "minmax(0, 1fr)" : "minmax(0, 1fr) 380px",
        }}
      >
        {isCompactViewport ? (
          <>
            <div className="pointer-events-none absolute right-3 top-3 z-30 flex flex-col gap-2 sm:right-4 md:right-6">
              <button
                type="button"
                onClick={() => {
                  if (!isNodePanelOpen) {
                    setIsNodePanelOpen(true);
                    setIsAssistantPanelOpen(false);
                  } else {
                    setIsNodePanelOpen(false);
                  }
                }}
                className="pointer-events-auto inline-flex h-10 items-center gap-2 rounded-full border border-white/85 bg-white/92 px-4 text-sm font-heading font-bold text-brand-gray-700 shadow-sm backdrop-blur transition hover:bg-white"
              >
                <span>{isNodePanelOpen ? "隱藏面板" : "展示面板"}</span>
              </button>
            </div>
          </>
        ) : null}

        <div
          ref={mapContainerRef}
          className="scrollbar-hide h-full min-h-0 min-w-0 overflow-y-auto rounded-2xl pb-6 pt-4 transition-opacity duration-300 lg:pb-8 lg:pt-8"
          style={{ cursor: "grab", opacity: isMapReady ? 1 : 0 }}
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
                mapHeight={mapHeight}
                scrollDuration={3000}
                isFreshNav={isFreshNav}
                courseId={courseId}
                isSelected={node.id === selectedNodeId}
                onSelect={setSelectedNodeId}
              />
            ))}
          </div>
        </div>

        {/* ── Unified Sidebar (Node Panel + Architect) ── */}
        {(isCompactViewport ? isNodePanelOpen || (showAssistantPanel && isAssistantPanelOpen) : true) && (
          <div
            className={`h-full min-h-0 pt-8 pb-8 ${isCompactViewport ? "absolute inset-x-3 bottom-3 top-16 z-20 sm:inset-x-4 md:inset-x-6" : ""}`}
            style={isCompactViewport ? {} : { order: 2 }}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/70 shadow-lg shadow-teal-200/20 backdrop-blur-xl">
              {/* Tab Switcher */}
              {showAssistantPanel && (
                <div className="flex border-b border-brand-teal/10 bg-brand-teal/5 p-1.5">
                  <button
                    onClick={() => {
                      setIsNodePanelOpen(true);
                      setIsAssistantPanelOpen(false);
                    }}
                    className={`flex-1 rounded-2xl py-2 text-xs font-bold transition-all ${
                      !isAssistantPanelOpen
                        ? "bg-white text-brand-teal shadow-sm"
                        : "text-brand-gray-400 hover:text-brand-gray-600"
                    }`}
                  >
                    Node Control
                  </button>
                  <button
                    onClick={() => {
                      setIsAssistantPanelOpen(true);
                      setIsNodePanelOpen(false);
                    }}
                    className={`flex-1 rounded-2xl py-2 text-xs font-bold transition-all ${
                      isAssistantPanelOpen
                        ? "bg-white text-brand-teal shadow-sm"
                        : "text-brand-gray-400 hover:text-brand-gray-600"
                    }`}
                  >
                    Syllabus Architect
                  </button>
                </div>
              )}

              {/* Panel Content */}
              <div className="relative flex-1 overflow-hidden">
                <div
                  className={`absolute inset-0 transition-all duration-300 ${
                    !isAssistantPanelOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"
                  }`}
                >
                  <CourseMapNodePanel
                    courseId={courseId}
                    coursePath={coursePath}
                    selectedNode={selectedNode}
                  />
                </div>
                {showAssistantPanel && (
                  <div
                    className={`absolute inset-0 transition-all duration-300 ${
                      isAssistantPanelOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
                    }`}
                  >
                    <CourseMapAssistantPanel
                      coursePath={coursePath}
                      courseId={Number(courseId) || currentCourseId}
                      onCoursePathUpdated={setCoursePath}
                      compact
                      mobileOverlay={false}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MapNodeCircle({
  node,
  index,
  mapHeight,
  scrollDuration = 3000,
  isFreshNav = true,
  courseId,
  isSelected,
  onSelect,
}: {
  node: CourseMapNode;
  index: number;
  mapHeight: number;
  scrollDuration?: number;
  isFreshNav?: boolean;
  courseId: string;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const isClickable =
    node.status === NODE_STATUS.AVAILABLE ||
    node.status === NODE_STATUS.COMPLETED;

  // 全新進入時，採用精準映射延遲；返回課綱時直接顯示節點，不執行延遲淡入
  const delay = isFreshNav
    ? Math.max(0, ((mapHeight - node.y) / mapHeight) * (scrollDuration / 1000))
    : 0;

  if (node.isUnitHeader) {
    return (
      <div
        className="absolute z-20 flex flex-col items-center pointer-events-none select-none"
        style={{
          left: `${node.x}%`,
          top: `${node.y}px`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay, type: "spring", damping: 14 }}
          className="relative flex flex-col items-center justify-center rounded-[1.5rem] border border-white/40 px-8 py-4 shadow-[0_4px_20px_rgba(180,210,230,0.2),inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-md min-w-[220px]"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(220,235,245,0.18) 100%)",
          }}
        >
          {/* top-left glow accent */}
          <div className="pointer-events-none absolute -top-px -left-px h-1/3 w-1/2 rounded-tl-[1.5rem] bg-gradient-to-br from-white/40 to-transparent" />

          <span className="font-heading text-[12px] font-medium uppercase tracking-[0.22em] text-black/55">
            {t("courseMap.unit")} {node.unitNumber}
          </span>
          <span className="mt-1 font-heading text-xl font-bold text-black/75 leading-tight text-center">
            {node.title}
          </span>
        </motion.div>
      </div>
    );
  }

  const content = (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", damping: 14 }}
      className="flex cursor-pointer flex-col items-center gap-2 bg-transparent"
      onHoverStart={() => {
        if (isClickable) {
          void router.prefetch(`/courses/${courseId}/nodes/${node.id}`);
        }
      }}
      onClick={() => {
        if (isSelected && isClickable) {
          router.push(`/courses/${courseId}/nodes/${node.id}`);
          return;
        }
        onSelect(node.id);
      }}
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
