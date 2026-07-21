import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { stageRenderers, renderUnsupportedStage } from "../features/lesson-session/renderers";
import { mockSubmitStage } from "./mockActions";
import { FALLBACK_COURSE_DATA } from "./fallbackData";
import { BookOpen, Check, Lock, Play, ChevronLeft, ChevronRight, Home, RefreshCw } from "lucide-react";

export interface OfflineStage {
  stageId: string;
  component: string;
  config: any;
  topic: string;
  difficulty?: string;
  recommendedDurationMinutes?: number;
  feedback: {
    success?: string;
    error?: string;
  };
}

export interface OfflineNode {
  id: string;
  title: string;
  description: string;
  status: string; // 'completed' | 'available' | 'locked'
  stages: OfflineStage[];
}

export interface OfflineUnit {
  unitId: string;
  unitTitle: string;
  unitDescription: string;
  nodes: OfflineNode[];
}

export interface OfflineCourseData {
  courseTitle: string;
  description: string;
  units: OfflineUnit[];
}

export function OfflineCoursePlayer() {
  // 1. 載入課程資料
  const courseData = useMemo<OfflineCourseData>(() => {
    return (window as any).__COURSE_EXPORT_DATA__ || FALLBACK_COURSE_DATA;
  }, []);

  // 2. 計算地圖節點坐標
  const nodes = useMemo(() => {
    const NODE_VERTICAL_SPACING = 160;
    const MAP_TOP_OFFSET = 70;
    const FIRST_NODE_DOWN_OFFSET = 56;

    const sourceNodes: any[] = [];
    courseData.units.forEach((unit, uIndex) => {
      sourceNodes.push({
        id: `unit-header-${uIndex + 1}`,
        title: unit.unitTitle || `Unit ${uIndex + 1}`,
        description: "",
        status: "available",
        isUnitHeader: true,
        unitNumber: uIndex + 1,
        stages: []
      });

      unit.nodes.forEach((node) => {
        sourceNodes.push({
          id: node.id,
          title: node.title,
          description: node.description,
          status: node.status,
          isUnitHeader: false,
          stages: node.stages || []
        });
      });
    });

    let currentTheta = 0;
    let lastUnitHeaderTheta = -180;

    return sourceNodes.map((node, index) => {
      if (node.isUnitHeader) {
        if (index === 0) {
          currentTheta = 0;
        } else {
          currentTheta = Math.max(
            lastUnitHeaderTheta + 180,
            Math.ceil((currentTheta + 89) / 180) * 180
          );
        }
        lastUnitHeaderTheta = currentTheta;
      } else {
        if (index > 0 && !sourceNodes[index - 1].isUnitHeader) {
          currentTheta += 180;
        } else {
          currentTheta = Math.ceil((currentTheta + 44) / 90) * 90;
          if (currentTheta % 180 === 0) currentTheta += 90;
        }
      }

      const amp = 24;
      const x = 50 + amp * Math.sin((currentTheta * Math.PI) / 180);
      const y = currentTheta * (NODE_VERTICAL_SPACING / 180) + MAP_TOP_OFFSET + (index === 0 ? FIRST_NODE_DOWN_OFFSET : 0);

      return {
        ...node,
        x,
        y,
        theta: currentTheta,
      };
    });
  }, [courseData]);

  // 3. 地圖高度
  const mapHeight = useMemo(() => {
    const maxY = nodes.length > 0 ? Math.max(...nodes.map((n) => n.y)) : 0;
    return Math.max(680, maxY + 180);
  }, [nodes]);

  // 4. 本地學習狀態管理
  const [completedNodeIds, setCompletedNodeIds] = useState<Set<string>>(() => {
    const completed = new Set<string>();
    nodes.forEach(n => {
      if (!n.isUnitHeader && n.status === "completed") {
        completed.add(n.id);
      }
    });
    return completed;
  });

  // 目前點選進入的關卡節點
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  // 目前關卡的 Stage 索引
  const [stageIdx, setStageIdx] = useState(0);
  // 目前作答回饋狀態
  const [submissionFeedback, setSubmissionFeedback] = useState<any>(null);

  // 離線播放器狀態
  const [isPlaying, setIsPlaying] = useState(false);

  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId && !n.isUnitHeader) || null;
  }, [nodes, selectedNodeId]);

  // 自動解鎖狀態更新 (如果前一個關卡已完成，下一個關卡即解鎖)
  const nodeStatuses = useMemo(() => {
    const statuses: Record<string, string> = {};
    let prevCompleted = true;

    nodes.forEach(n => {
      if (n.isUnitHeader) return;
      
      const isCompleted = completedNodeIds.has(n.id);
      if (isCompleted) {
        statuses[n.id] = "completed";
        prevCompleted = true;
      } else if (prevCompleted) {
        statuses[n.id] = "available";
        prevCompleted = false;
      } else {
        statuses[n.id] = "locked";
        prevCompleted = false;
      }
    });
    return statuses;
  }, [nodes, completedNodeIds]);

  // 載入關卡重置 stage 索引
  useEffect(() => {
    setStageIdx(0);
    setSubmissionFeedback(null);
  }, [selectedNodeId]);

  // 5. 課堂控制 Actions
  const handleNextStage = () => {
    if (!selectedNode) return;
    if (stageIdx < selectedNode.stages.length - 1) {
      setStageIdx(prev => prev + 1);
      setSubmissionFeedback(null);
    } else {
      // 關卡全部完成！
      setCompletedNodeIds(prev => {
        const next = new Set(prev);
        next.add(selectedNode.id);
        return next;
      });
      // 觸發灑花
      if (typeof (window as any).confetti === "function") {
        (window as any).confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      // 返回地圖
      setIsPlaying(false);
      setSelectedNodeId(null);
    }
  };

  const handlePrevStage = () => {
    if (stageIdx > 0) {
      setStageIdx(prev => prev - 1);
      setSubmissionFeedback(null);
    }
  };


  const actionHandlers = useMemo(() => {
    return {
      submitStage: async (stage: any, input: any) => {
        const response = await mockSubmitStage(stage, input);
        setSubmissionFeedback(response);
        return response;
      },
      skipStage: async (stage: any) => {
        handleNextStage();
      },
      continueStage: () => {
        handleNextStage();
      },
      useHint: async () => {
        const hint = selectedNode?.stages[stageIdx]?.feedback?.error || "仔細檢查題目選項與描述。";
        alert(`提示：\n${hint}`);
        return true;
      }
    };
  }, [selectedNode, stageIdx]);

  const activeStage = selectedNode?.stages[stageIdx] || null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-brand-gray-700 font-sans">
      {!isPlaying ? (
        // ─── 1. 課程地圖畫面 (Winding Course Map View) ───
        <div className="relative flex flex-col h-full w-full overflow-hidden app-shared-bg">
          {/* 頂部標題欄 */}
          <header className="flex items-center justify-between px-6 py-4 bg-white/60 backdrop-blur-md border-b border-white/40 z-30 shadow-sm">
            <div className="flex items-center gap-3">
              <BookOpen className="text-brand-teal h-6 w-6" />
              <h1 className="text-xl font-heading font-extrabold tracking-wide text-brand-gray-700">
                {courseData.courseTitle}
              </h1>
              <span className="text-xs bg-brand-teal/20 text-[#3a8b87] border border-brand-teal/30 rounded-full px-2.5 py-0.5 font-bold font-heading">
                離線存檔版
              </span>
            </div>
          </header>

          {/* 主地圖與側欄 */}
          <main className="flex-1 flex min-h-0 relative max-w-[1580px] mx-auto w-full gap-8 px-3 sm:px-4 md:px-6">
            {/* 左側地圖 */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide relative pb-6 pt-4">
              <div className="relative mx-auto max-w-[1000px]" style={{ height: mapHeight }}>
                {/* SVG Winding Line */}
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
                    const isActive =
                      nodeStatuses[node.id] !== "locked" ||
                      nodeStatuses[next.id] !== "locked";

                    const segments = 12;
                    const amp = 24;
                    let pathD = `M ${node.x} ${node.y}`;
                    for (let i = 1; i <= segments; i++) {
                      const t = node.theta + (next.theta - node.theta) * (i / segments);
                      const currX = 50 + amp * Math.sin((t * Math.PI) / 180);
                      const currY = node.y + (next.y - node.y) * (i / segments);
                      pathD += ` L ${currX} ${currY}`;
                    }

                    return (
                      <path
                        key={index}
                        d={pathD}
                        stroke={isActive ? "url(#pathGrad)" : "#999"}
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                        opacity={isActive ? 0.85 : 0.45}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </svg>

                {/* 地圖節點與單元看板 */}
                {nodes.map((node, index) => {
                  if (node.isUnitHeader) {
                    return (
                      <div
                        key={node.id}
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
                          transition={{ type: "spring", damping: 14 }}
                          className="relative"
                        >
                          <div className="relative flex items-center gap-3 rounded-[1.5rem] bg-[#55aaa6] px-7 py-3 min-w-[240px] shadow-[0_10px_24px_-6px_rgba(74,158,155,0.55),0_4px_10px_-2px_rgba(122,199,196,0.35)] overflow-hidden">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent" />
                            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#fde79a] bg-gradient-to-b from-[#fbd66b] to-[#e6a93f] shadow-inner">
                              <span
                                className="font-heading text-base font-extrabold text-white"
                                style={{ textShadow: "0 1px 2px rgba(140,90,20,0.5)" }}
                              >
                                {node.unitNumber}
                              </span>
                            </div>
                            <span
                              className="relative font-heading text-lg font-extrabold leading-tight text-white whitespace-nowrap"
                              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.25)" }}
                            >
                              {node.title}
                            </span>
                          </div>
                        </motion.div>
                      </div>
                    );
                  }

                  const status = nodeStatuses[node.id] || "locked";
                  const isSelected = node.id === selectedNodeId;
                  const isCompleted = status === "completed";
                  const isAvailable = status === "available";
                  const isClickable = isCompleted || isAvailable;

                  return (
                    <div
                      key={node.id}
                      className="absolute z-10"
                      style={{
                        left: `${node.x}%`,
                        top: `${node.y}px`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <motion.button
                        type="button"
                        className="flex cursor-pointer flex-col items-center gap-2 bg-transparent"
                        onClick={() => {
                          if (isSelected && isClickable) {
                            return;
                          }
                          if (isClickable) {
                            setSelectedNodeId(node.id);
                          }
                        }}
                        whileHover={isClickable ? { scale: 1.1 } : {}}
                        whileTap={isClickable ? { scale: 0.92 } : {}}
                      >
                        {isAvailable && (
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

                        {isCompleted && (
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
                            isCompleted
                              ? "shadow-lg shadow-amber-300/30"
                              : isAvailable
                              ? "shadow-lg shadow-teal-400/30"
                              : "shadow-md"
                          }`}
                        >
                          <div
                            className={`absolute inset-0 rounded-full ${
                              isCompleted
                                ? "bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500"
                                : isAvailable
                                ? "bg-gradient-to-br from-[#7AC7C4] via-[#5fb3af] to-[#4da8a4]"
                                : "bg-gradient-to-br from-[#e0ddd8] via-[#d4d0ca] to-[#c8c4be]"
                            }`}
                          />
                          <div
                            className={`absolute inset-[3px] rounded-full border-2 ${
                              isSelected
                                ? "border-brand-teal/80"
                                : isCompleted
                                ? "border-yellow-200/50"
                                : isAvailable
                                ? "border-white/30"
                                : "border-white/20"
                            }`}
                          />
                          <div className="absolute inset-0 overflow-hidden rounded-full">
                            <div
                              className="absolute -top-1 left-1/2 h-[40%] w-[70%] -translate-x-1/2 rounded-[50%]"
                              style={{
                                background:
                                  !isClickable
                                    ? "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)"
                                    : "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)",
                              }}
                            />
                          </div>

                          <div className="relative z-10">
                            {isCompleted ? (
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
                            ) : isAvailable ? (
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
                            isCompleted
                              ? "text-amber-700"
                              : isAvailable
                              ? "text-teal-700"
                              : "text-brand-gray-400"
                          }`}
                        >
                          {node.title}
                        </span>
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 右側節點詳情看板 */}
            <div className="w-[380px] flex-shrink-0 pt-8 pb-8 pr-6 h-full min-h-0 hidden lg:block">
              <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/70 shadow-lg shadow-teal-200/20 backdrop-blur-xl">
                {selectedNode ? (
                  <div className="flex-1 flex flex-col min-h-0">
                    {/* Header */}
                    <div className="flex border-b border-brand-teal/10 bg-brand-teal/5 p-4 justify-center items-center">
                      <h3 className="font-heading text-sm font-extrabold text-brand-gray-700">Node Control (關卡資訊)</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-6">
                      <section className="rounded-2xl border border-brand-teal/15 bg-brand-teal/5 p-4 text-center">
                        <h2 className="font-heading text-base font-extrabold text-[#3a8b87]">
                          {selectedNode.title}
                        </h2>
                        <p className="mt-2 text-xs leading-relaxed text-[#569b97]">
                          {selectedNode.description || "這個關卡目前沒有額外描述。"}
                        </p>
                      </section>

                      <section className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3a8b87]">
                          關卡大綱與練習
                        </p>
                        <div className="space-y-2">
                          {selectedNode.stages.map((st: any, sIdx: number) => (
                            <div
                              key={st.stageId}
                              className="flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-white/60 px-4 py-3"
                            >
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-teal/20 text-[#3a8b87] text-xs font-bold font-mono">
                                {sIdx + 1}
                              </div>
                              <span className="text-xs font-bold text-brand-gray-600">
                                {st.topic || st.component}
                              </span>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>

                    <div className="border-t border-white/60 p-6 bg-white/30">
                      <button
                        type="button"
                        onClick={() => setIsPlaying(true)}
                        className="w-full rounded-2xl bg-gradient-to-r from-brand-teal to-[#5fb3af] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-300/30 transition hover:brightness-105"
                      >
                        進入課程
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="h-16 w-16 rounded-full bg-brand-teal/10 flex items-center justify-center border border-brand-teal/20">
                      <Play className="h-8 w-8 text-brand-teal fill-brand-teal/10 translate-x-0.5" />
                    </div>
                    <h3 className="text-base font-bold text-brand-gray-600">請選取一個關卡開始學習</h3>
                    <p className="text-xs text-brand-gray-400 max-w-[240px]">
                      點選地圖上綠色（已完成）或黃色（可進行）的圓形按鈕，即可在此處開啟關卡詳情。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      ) : (
        // ─── 2. 關卡播放器畫面 (Active Lesson Player View - Single Centered Column Layout) ───
        <div className="relative flex flex-col h-full w-full overflow-hidden app-shared-bg">
          {/* 頂部進度導航欄 */}
          <div className="flex items-center gap-3 px-4 pt-4 pb-1 sm:px-6 lg:px-8 z-30">
            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setStageIdx(0);
                setSubmissionFeedback(null);
              }}
              className="relative z-20 h-9 w-9 rounded-full bg-white/60 backdrop-blur flex items-center justify-center hover:bg-white/80 transition shadow-sm border border-white/50"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand-gray-600" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="flex-1">
              <div className="relative h-3 w-full bg-white/50 rounded-full overflow-hidden border border-white/40 shadow-inner">
                <div
                  className="bg-gradient-to-r from-brand-teal to-[#5fb3af] h-full transition-all duration-300"
                  style={{ width: `${((stageIdx + 1) / selectedNode!.stages.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* 單欄置中版面 */}
          <div className="relative flex w-full min-h-0 flex-1 justify-center px-4 pb-4 sm:px-6 lg:px-8 pt-2">
            <div className="w-full max-w-[1000px] flex flex-col min-w-0 min-h-0">
              {/* 關卡主要內容渲染 */}
              <div className="flex-1 min-h-0 flex flex-col py-2">
                {activeStage ? (
                  activeStage.component === "FeynmanMirror" ? (
                    <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center text-center rounded-3xl border border-amber-200/60 bg-amber-50/80 p-8 shadow-sm backdrop-blur-md">
                      <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-4 flex-shrink-0">
                        <span className="text-3xl">💡</span>
                      </div>
                      <h3 className="text-lg font-bold text-amber-800 mb-2 flex-shrink-0">費曼教學關卡</h3>
                      <p className="text-sm text-amber-700 max-w-md mb-6 leading-relaxed flex-shrink-0">
                        此關卡為「費曼教學」（需要與線上 AI 即時對話），離線下載版目前不支援此互動功能，但您仍可以閱讀下方的思考主題與參考解答：
                      </p>
                      
                      <div className="w-full text-left space-y-4 bg-white/95 rounded-2xl p-6 border border-amber-200/50 max-w-xl shadow-inner">
                        <div>
                          <span className="text-xs font-bold text-amber-600 block mb-1">【思考主題】</span>
                          <p className="text-sm font-semibold text-slate-800 leading-relaxed">{activeStage.topic}</p>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-amber-600 block mb-1">【題目描述】</span>
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {String((activeStage.config?.data as any)?.prompt || activeStage.topic)}
                          </p>
                        </div>
                        {(activeStage.config?.data as any)?.sampleAnswer && (
                          <div>
                            <span className="text-xs font-bold text-amber-600 block mb-1">【參考解答】</span>
                            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono">
                              {String((activeStage.config?.data as any)?.sampleAnswer)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    React.createElement(stageRenderers[activeStage.component as keyof typeof stageRenderers] || renderUnsupportedStage, {
                      key: `${activeStage.component}-${activeStage.stageId}`,
                      stage: activeStage as any,
                      lesson: {
                        stageIdx,
                        totalStages: selectedNode!.stages.length,
                        stageLabel: `投影片 ${stageIdx + 1}`,
                        nodeDescription: selectedNode!.description,
                        courseId: 0,
                      },
                      actions: actionHandlers as any,
                    })
                  )
                ) : (
                  <div className="text-center text-slate-500 py-10">此關卡尚無內容。</div>
                )}
              </div>

              {/* 底部導覽欄 */}
              <div className="border-t border-white/40 pt-4 flex items-center justify-between mt-auto bg-transparent">
                <button
                  onClick={handlePrevStage}
                  disabled={stageIdx === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/70 border border-white/60 text-sm font-semibold text-brand-gray-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一頁
                </button>
                <button
                  onClick={handleNextStage}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-brand-teal to-[#5fb3af] text-white font-bold text-sm shadow-md transition hover:brightness-105"
                >
                  {stageIdx < selectedNode!.stages.length - 1 ? "下一頁" : "完成關卡"}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
