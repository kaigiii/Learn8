"use client";

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import TopStatsBar from "@/components/shared/TopStatsBar";
import { ApiError, apiFetch } from "@/lib/api";
import type { CoursePath } from "@/lib/types";
import { useAuthStore } from "@/stores/useAuthStore";
import useUserStore from "@/stores/useUserStore";

/* ═══════════════════ Fallback mock nodes (for demo courseIds with no mock data) ═══════════════════ */

interface MapNode {
  id: string;
  title: string;
  status: "completed" | "available" | "locked";
  x: number;
  y: number;
}

/* ── Per-library-course metadata: each course has its own independent title + nodes ── */
const LIBRARY_COURSE_META: Record<string, { title: string; nodes: { id: string; title: string; status: "completed" | "available" | "locked" }[] }> = {
  ja: {
    title: "Japanese",
    nodes: [
      { id: "ja-n1", title: "Hiragana Basics", status: "completed" },
      { id: "ja-n2", title: "Katakana Basics", status: "available" },
      { id: "ja-n3", title: "Greetings & Self-Introduction", status: "locked" },
      { id: "ja-n4", title: "Numbers & Counting", status: "locked" },
      { id: "ja-n5", title: "Basic Particles (は・が・を)", status: "locked" },
      { id: "ja-n6", title: "Daily Conversation", status: "locked" },
      { id: "ja-n7", title: "Verb Conjugation", status: "locked" },
      { id: "ja-n8", title: "Adjectives & Descriptions", status: "locked" },
      { id: "ja-n9", title: "Kanji Level 1", status: "locked" },
      { id: "ja-n10", title: "Reading Comprehension", status: "locked" },
      { id: "ja-n11", title: "Listening Practice", status: "locked" },
      { id: "ja-n12", title: "Travel Japanese", status: "locked" },
      { id: "ja-n13", title: "Polite vs Casual Speech", status: "locked" },
      { id: "ja-n14", title: "Culture & Etiquette", status: "locked" },
      { id: "ja-n15", title: "Final Challenge", status: "locked" },
    ],
  },
  es: {
    title: "Spanish",
    nodes: [
      { id: "es-n1", title: "Alphabet & Pronunciation", status: "completed" },
      { id: "es-n2", title: "Greetings & Introductions", status: "available" },
      { id: "es-n3", title: "Articles & Gender", status: "locked" },
      { id: "es-n4", title: "Basic Verbs (Ser/Estar)", status: "locked" },
      { id: "es-n5", title: "Numbers & Time", status: "locked" },
      { id: "es-n6", title: "Food & Ordering", status: "locked" },
      { id: "es-n7", title: "Present Tense Conjugation", status: "locked" },
      { id: "es-n8", title: "Prepositions & Directions", status: "locked" },
      { id: "es-n9", title: "Past Tense (Pretérito)", status: "locked" },
      { id: "es-n10", title: "Shopping & Money", status: "locked" },
      { id: "es-n11", title: "Subjunctive Mood", status: "locked" },
      { id: "es-n12", title: "Travel Conversation", status: "locked" },
      { id: "es-n13", title: "Reading Practice", status: "locked" },
      { id: "es-n14", title: "Culture & Idioms", status: "locked" },
      { id: "es-n15", title: "Final Challenge", status: "locked" },
    ],
  },
  py: {
    title: "Python",
    nodes: [
      { id: "py-n1", title: "Variables & Data Types", status: "completed" },
      { id: "py-n2", title: "Control Flow (if/else)", status: "available" },
      { id: "py-n3", title: "Loops (for/while)", status: "locked" },
      { id: "py-n4", title: "Functions & Scope", status: "locked" },
      { id: "py-n5", title: "Lists & Tuples", status: "locked" },
      { id: "py-n6", title: "Dictionaries & Sets", status: "locked" },
      { id: "py-n7", title: "String Manipulation", status: "locked" },
      { id: "py-n8", title: "File I/O", status: "locked" },
      { id: "py-n9", title: "Error Handling", status: "locked" },
      { id: "py-n10", title: "Modules & Packages", status: "locked" },
      { id: "py-n11", title: "List Comprehensions", status: "locked" },
      { id: "py-n12", title: "OOP Basics", status: "locked" },
      { id: "py-n13", title: "Decorators & Generators", status: "locked" },
      { id: "py-n14", title: "Testing with pytest", status: "locked" },
      { id: "py-n15", title: "Final Project", status: "locked" },
    ],
  },
  py2: {
    title: "Python Advanced",
    nodes: [
      { id: "py2-n1", title: "Async & Concurrency", status: "completed" },
      { id: "py2-n2", title: "Metaprogramming", status: "available" },
      { id: "py2-n3", title: "Design Patterns", status: "locked" },
      { id: "py2-n4", title: "Type Hints & Mypy", status: "locked" },
      { id: "py2-n5", title: "Performance Optimization", status: "locked" },
      { id: "py2-n6", title: "Context Managers", status: "locked" },
      { id: "py2-n7", title: "Networking & APIs", status: "locked" },
      { id: "py2-n8", title: "Data Processing (Pandas)", status: "locked" },
      { id: "py2-n9", title: "Database Integration", status: "locked" },
      { id: "py2-n10", title: "Web Scraping", status: "locked" },
      { id: "py2-n11", title: "CLI Tools (Click/Typer)", status: "locked" },
      { id: "py2-n12", title: "Package Publishing", status: "locked" },
      { id: "py2-n13", title: "CI/CD Pipelines", status: "locked" },
      { id: "py2-n14", title: "Security Best Practices", status: "locked" },
      { id: "py2-n15", title: "Capstone Project", status: "locked" },
    ],
  },
  gen: {
    title: "Study Skills",
    nodes: [
      { id: "gen-n1", title: "Active Recall", status: "completed" },
      { id: "gen-n2", title: "Spaced Repetition", status: "available" },
      { id: "gen-n3", title: "Note-Taking Methods", status: "locked" },
      { id: "gen-n4", title: "Mind Mapping", status: "locked" },
      { id: "gen-n5", title: "Pomodoro Technique", status: "locked" },
      { id: "gen-n6", title: "Goal Setting (SMART)", status: "locked" },
      { id: "gen-n7", title: "Critical Thinking", status: "locked" },
      { id: "gen-n8", title: "Speed Reading", status: "locked" },
      { id: "gen-n9", title: "Memory Palace", status: "locked" },
      { id: "gen-n10", title: "Group Study Strategies", status: "locked" },
      { id: "gen-n11", title: "Test Preparation", status: "locked" },
      { id: "gen-n12", title: "Time Management", status: "locked" },
      { id: "gen-n13", title: "Self-Assessment", status: "locked" },
      { id: "gen-n14", title: "Growth Mindset", status: "locked" },
      { id: "gen-n15", title: "Final Review", status: "locked" },
    ],
  },
  ml: {
    title: "ML Basics",
    nodes: [
      { id: "ml-n1", title: "What is Machine Learning?", status: "completed" },
      { id: "ml-n2", title: "Supervised vs Unsupervised", status: "available" },
      { id: "ml-n3", title: "Linear Regression", status: "locked" },
      { id: "ml-n4", title: "Logistic Regression", status: "locked" },
      { id: "ml-n5", title: "Decision Trees", status: "locked" },
      { id: "ml-n6", title: "K-Nearest Neighbors", status: "locked" },
      { id: "ml-n7", title: "Support Vector Machines", status: "locked" },
      { id: "ml-n8", title: "Neural Network Intro", status: "locked" },
      { id: "ml-n9", title: "Training & Validation", status: "locked" },
      { id: "ml-n10", title: "Overfitting & Regularization", status: "locked" },
      { id: "ml-n11", title: "Feature Engineering", status: "locked" },
      { id: "ml-n12", title: "Model Evaluation Metrics", status: "locked" },
      { id: "ml-n13", title: "Ensemble Methods", status: "locked" },
      { id: "ml-n14", title: "Deploying Models", status: "locked" },
      { id: "ml-n15", title: "Final Challenge", status: "locked" },
    ],
  },
  ds: {
    title: "Data Science",
    nodes: [
      { id: "ds-n1", title: "Data Science Overview", status: "completed" },
      { id: "ds-n2", title: "Data Collection & Cleaning", status: "available" },
      { id: "ds-n3", title: "Exploratory Data Analysis", status: "locked" },
      { id: "ds-n4", title: "Statistical Foundations", status: "locked" },
      { id: "ds-n5", title: "Data Visualization", status: "locked" },
      { id: "ds-n6", title: "Hypothesis Testing", status: "locked" },
      { id: "ds-n7", title: "Regression Analysis", status: "locked" },
      { id: "ds-n8", title: "Clustering Techniques", status: "locked" },
      { id: "ds-n9", title: "Time Series Analysis", status: "locked" },
      { id: "ds-n10", title: "Natural Language Processing", status: "locked" },
      { id: "ds-n11", title: "Big Data Tools", status: "locked" },
      { id: "ds-n12", title: "Dashboard & Reporting", status: "locked" },
      { id: "ds-n13", title: "A/B Testing", status: "locked" },
      { id: "ds-n14", title: "Ethics in Data Science", status: "locked" },
      { id: "ds-n15", title: "Capstone Project", status: "locked" },
    ],
  },
};

const FALLBACK_NODES: { id: string; title: string; status: "completed" | "available" | "locked" }[] = [
  { id: "demo-n1", title: "Introduction", status: "completed" },
  { id: "demo-n2", title: "Core Concepts", status: "available" },
  { id: "demo-n3", title: "Deep Dive", status: "locked" },
  { id: "demo-n4", title: "Practice Lab", status: "locked" },
  { id: "demo-n5", title: "Advanced Topics", status: "locked" },
  { id: "demo-n6", title: "Connections", status: "locked" },
  { id: "demo-n7", title: "Analysis", status: "locked" },
  { id: "demo-n8", title: "Synthesis", status: "locked" },
  { id: "demo-n9", title: "Application", status: "locked" },
  { id: "demo-n10", title: "Case Study", status: "locked" },
  { id: "demo-n11", title: "Research", status: "locked" },
  { id: "demo-n12", title: "Review", status: "locked" },
  { id: "demo-n13", title: "Mastery", status: "locked" },
  { id: "demo-n14", title: "Integration", status: "locked" },
  { id: "demo-n15", title: "Final Challenge", status: "locked" },
];

/* ═══════════════════ Page ═══════════════════ */

export default function MapClient({ courseId: explicitCourseId }: { courseId?: string } = {}) {
  const router = useRouter();
  const params = useParams();
  const courseId =
    (typeof explicitCourseId === "string" && explicitCourseId) ||
    (typeof params.courseId === "string" ? params.courseId : "");
  const token = useAuthStore((s) => s.token);
  const hasResolvedCourseId = courseId.length > 0;
  const isBackendCourse = /^\d+$/.test(courseId);

  const setLastActiveCourse = useUserStore((s) => s.setLastActiveCourse);

  const [backendCourse, setBackendCourse] = useState<CoursePath | null>(null);
  const [backendError, setBackendError] = useState("");

  useEffect(() => {
    if (!hasResolvedCourseId) return;
    if (!isBackendCourse) {
      console.warn("[MapClient] Invalid courseId, staying on page", {
        explicitCourseId: explicitCourseId ?? null,
        paramsCourseId: (params.courseId as string | undefined) ?? null,
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
        console.info("[MapClient] Loading backend course", {
          courseId,
          explicitCourseId: explicitCourseId ?? null,
        });
        const data = await apiFetch<CoursePath>(`/courses/${courseId}`);
        setBackendCourse(data);
      } catch (err) {
        console.error("[MapClient] Failed to load backend course", {
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
  }, [courseId, explicitCourseId, hasResolvedCourseId, isBackendCourse, params, router, token]);

  /* Lock body scroll while map page is mounted (zoom 1.05 causes overflow) */
  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
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

  // Build MapNode array – use store data if available, otherwise fallback
  // Dynamic positions: zigzag pattern, each node spaced vertically
  const NODES: MapNode[] = useMemo(() => {
    const X_PATTERN = [50, 28, 68, 32, 58, 40, 65, 30, 55, 42, 62, 35, 58, 45, 50];
    const buildPositions = (nodes: { id: string; title: string; status: "completed" | "available" | "locked" }[]) => {
      const count = nodes.length;
      const spacing = 120; // px per node
      return nodes.map((n, i) => ({
        id: n.id,
        title: n.title,
        status: n.status,
        x: X_PATTERN[i % X_PATTERN.length],
        y: (count - 1 - i) * spacing + 60, // bottom-to-top, first node at bottom
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

  // Total height for scrollable map
  const mapHeight = Math.max(560, NODES.length * 120 + 120);

  /* ── Start at the top, then auto-scroll down after mount ── */
  const mapContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (NODES.length === 0 || !mapContainerRef.current) return;

    const container = mapContainerRef.current;
    container.scrollTop = 0;

    let frameId = 0;
    let startTime: number | null = null;
    const startTop = 0;
    const targetTop = container.scrollHeight;
    const duration = 2200;

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animateScroll = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      container.scrollTop = startTop + (targetTop - startTop) * easedProgress;

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
  }, [NODES.length]);

  /* ── Mouse drag to pan ── */
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const container = mapContainerRef.current;
    if (!container) return;
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    container.style.cursor = "grabbing";
    container.style.userSelect = "none";
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const container = mapContainerRef.current;
    if (!container) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    container.scrollTop = dragStart.current.scrollTop - dy;
    container.scrollLeft = dragStart.current.scrollLeft - dx;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    const container = mapContainerRef.current;
    if (container) {
      container.style.cursor = "grab";
      container.style.userSelect = "";
    }
  }, []);

  const pageTitle = backendCourse?.courseTitle ?? "Course Map";

  if (!isBackendCourse) {
    return null;
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]" style={{ zoom: 1.05, height: "calc(100vh / 1.05)" }}>
      <TopStatsBar backHref="/home" pageTitle={pageTitle} />

      {/* Background effects */}
      <MapBg />
      <FloatingParticles />

      <div className="relative z-10 flex gap-6 px-6 max-w-7xl mx-auto" style={{ height: "calc(100vh / 1.05 - 56px)" }}>
        {/* ── Center: Map canvas (drag to pan, hidden scrollbar) ── */}
        <div
          ref={mapContainerRef}
          className="flex-1 min-w-0 overflow-y-auto rounded-2xl scrollbar-hide"
          style={{ cursor: "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {backendError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {backendError}
            </div>
          )}
          <div className="relative" style={{ height: mapHeight, minHeight: 560 }}>
            {/* SVG path connecting nodes */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
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
              {NODES.slice(0, -1).map((node, i) => {
                const next = NODES[i + 1];
                const nx = node.x;
                const ny = node.y;
                const nnx = next.x;
                const nny = next.y;
                const mx = (nx + nnx) / 2;
                const my = (ny + nny) / 2;
                const isActive =
                  node.status !== "locked" || next.status !== "locked";
                return (
                  <path
                    key={i}
                    d={`M ${nx} ${ny} Q ${mx + (i % 2 === 0 ? 12 : -12)} ${my} ${nnx} ${nny}`}
                    stroke={isActive ? "url(#pathGrad)" : "#999"}
                    strokeWidth="1.8"
                    strokeDasharray="4 3"
                    opacity={isActive ? 0.85 : 0.45}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {NODES.map((node, i) => {
              return (
                <MapNodeCircle key={node.id} node={node} index={i} courseId={courseId} />
              );
            })}
          </div>
        </div>

        {/* ── Right: AI Chat Assistant ── */}
        <div className="w-[340px] flex-shrink-0 pt-8">
          <AIChatAssistant />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ AI Chat Assistant ═══════════════════ */

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

function AIChatAssistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resizeInput = (el?: HTMLTextAreaElement | null) => {
    const ta = el ?? inputRef.current;
    if (!ta) return;
    ta.style.height = "40px";
    const max = 240;
    const newH = Math.min(Math.max(ta.scrollHeight, 40), max);
    ta.style.height = `${newH}px`;
    ta.style.overflow = newH >= max ? 'auto' : 'hidden';
  };

  useEffect(() => { resizeInput(); }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = { id: Date.now(), role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const aiOutput = `保護性構造(Protectivestructure)：Pericardium(心包膜)、Pericardialfluid(心包液)、Fibrouspericardium(纖維性心包膜)
 
肌肉構造(Muscularstructure)： Myocardium(心肌層)、Cardiacmusclefibers(心肌纖維)、Intercalateddiscs(閏盤)
 
選項詳細解釋
 
1.保護性構造(Protectivestructure)
 
這類構造的主要功能是固定心臟位置、減少摩擦並防止過度擴張。
 
Pericardium(心包膜)：包圍心臟的雙層囊狀結構。它像一個保護套，將心臟與周圍器官隔開。
Pericardialfluid(心包液)：存在於兩層心包膜之間的潤滑液。心臟跳動時，它能減少摩擦，保護心臟表面不被磨損。
Fibrouspericardium(纖維性心包膜)：這是心包膜最外層，由堅韌的結締組織組成。它的作用是防止心臟過度充血膨脹，並將心臟固定在胸腔中。
 
2.肌肉構造(Muscularstructure)
 
這類構造直接參與心臟的收縮與訊號傳導，是心臟跳動（幫浦功能）的核心。
 
Myocardium(心肌層)：這是心臟壁中最厚的一層，由心肌細胞組成。它是心臟收縮與舒張的主體。
Cardiacmusclefibers(心肌纖維)：指的就是組成心肌的細胞。它們具有自動律動性，能協同收縮。
Intercalateddiscs(閏盤)：這是心肌細胞特有的連接結構。它含有縫隙連接（Gapjunctions），能讓電訊號快速在細胞間傳導，確保心臟肌肉能同步收縮。`;

    // Typewriter effect: append assistant message one char at a time
    (async () => {
      const assistantId = Date.now() + 2;
      const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", text: "" };
      setMessages((prev) => [...prev, assistantMsg]);
      for (const ch of aiOutput) {
        // small delay between characters (adjusted)
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 20));
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + ch } : m)));
      }
    })();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isComposing || e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicDown = () => {
    if (isRecording) return;
    setIsRecording(true);
    setInput("");
  };

  const handleMicUp = () => {
    if (!isRecording) return;
    setIsRecording(false);
    const micText = "麥克風測試";
    const userMsg: ChatMessage = { id: Date.now(), role: "user", text: micText };
    setMessages((prev) => [...prev, userMsg]);

    const aiOutput = `保護性構造(Protectivestructure)：Pericardium(心包膜)、Pericardialfluid(心包液)、Fibrouspericardium(纖維性心包膜)
 
肌肉構造(Muscularstructure)： Myocardium(心肌層)、Cardiacmusclefibers(心肌纖維)、Intercalateddiscs(閏盤)
 
選項詳細解釋
 
1.保護性構造(Protectivestructure)
 
這類構造的主要功能是固定心臟位置、減少摩擦並防止過度擴張。
 
Pericardium(心包膜)：包圍心臟的雙層囊狀結構。它像一個保護套，將心臟與周圍器官隔開。
Pericardialfluid(心包液)：存在於兩層心包膜之間的潤滑液。心臟跳動時，它能減少摩擦，保護心臟表面不被磨損。
Fibrouspericardium(纖維性心包膜)：這是心包膜最外層，由堅韌的結締組織組成。它的作用是防止心臟過度充血膨脹，並將心臟固定在胸腔中。
 
2.肌肉構造(Muscularstructure)
 
這類構造直接參與心臟的收縮與訊號傳導，是心臟跳動（幫浦功能）的核心。
 
Myocardium(心肌層)：這是心臟壁中最厚的一層，由心肌細胞組成。它是心臟收縮與舒張的主體。
Cardiacmusclefibers(心肌纖維)：指的就是組成心肌的細胞。它們具有自動律動性，能協同收縮。
Intercalateddiscs(閏盤)：這是心肌細胞特有的連接結構。它含有縫隙連接（Gapjunctions），能讓電訊號快速在細胞間傳導，確保心臟肌肉能同步收縮。`;

    (async () => {
      const assistantId = Date.now() + 2;
      const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", text: "" };
      setMessages((prev) => [...prev, assistantMsg]);
      for (const ch of aiOutput) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 40));
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + ch } : m)));
      }
    })();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, type: "spring", damping: 18 }}
      className="rounded-3xl bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg shadow-teal-200/20 overflow-hidden flex flex-col"
      style={{ height: "78vh", minHeight: 560 }}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-center gap-3">
        {/* Owl avatar */}
        <div className="relative w-14 h-14 flex-shrink-0">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center shadow-md">
            <svg viewBox="0 0 40 40" className="w-9 h-9" fill="none">
              <ellipse cx="20" cy="24" rx="12" ry="10" fill="#C47F17" />
              <circle cx="15" cy="20" r="5" fill="white" />
              <circle cx="25" cy="20" r="5" fill="white" />
              <circle cx="15" cy="20" r="2.5" fill="#2D2D2D" />
              <circle cx="25" cy="20" r="2.5" fill="#2D2D2D" />
              <circle cx="16" cy="19" r="1" fill="white" />
              <circle cx="26" cy="19" r="1" fill="white" />
              <polygon points="20,22 18,25 22,25" fill="#FF9500" />
              <polygon points="10,16 8,8 15,14" fill="#C47F17" />
              <polygon points="30,16 32,8 25,14" fill="#C47F17" />
            </svg>
          </div>
        </div>
        <div>
          <h3 className="font-heading font-bold text-[15px] text-brand-gray-700">
            AI Chat Assistant
          </h3>
          <p className="text-xs text-brand-gray-400 mt-0.5">
            Ask me anything about this course!
          </p>
        </div>
      </div>

      {/* Chat messages area */}
      <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-brand-teal/10 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-brand-teal" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-xs text-brand-gray-400 leading-relaxed max-w-[200px]">
              Type a message to start chatting with your AI study companion!
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-gradient-to-r from-brand-teal to-[#5fb3af] text-white rounded-br-md"
                  : "bg-white/70 border border-white/60 text-brand-gray-600 rounded-bl-md shadow-sm"
              }`}
            >
              {msg.text}
            </div>
          </motion.div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-brand-teal/20 to-transparent" />

      {/* Input area */}
      <div className="px-5 py-3 flex items-center gap-2">
        <div className="flex-1 relative">
          {isRecording ? (
            <div className="rounded-xl bg-white/70 border border-brand-teal/40 px-4 py-3 flex items-center justify-center gap-[6px] h-[40px] ring-2 ring-brand-teal/30">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-[3px] rounded-full bg-brand-teal"
                  animate={{
                    height: [4, 16 + Math.random() * 8, 6, 20, 4],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.08,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          ) : (
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); resizeInput(e.target); }}
              onInput={(e) => resizeInput(e.currentTarget)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={(e) => {
                setIsComposing(false);
                resizeInput(e.currentTarget);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              className="w-full resize-none rounded-xl bg-white/70 border border-white/60 px-4 py-[10px] text-[13px] leading-[18px] text-brand-gray-700 placeholder-brand-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal/40 h-10"
              style={{ maxHeight: 240, overflow: 'hidden' }}
            />
          )}
        </div>
        <motion.button
          onMouseDown={handleMicDown}
          onMouseUp={handleMicUp}
          onMouseLeave={handleMicUp}
          onTouchStart={handleMicDown}
          onTouchEnd={handleMicUp}
          className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center select-none border border-white/60 shadow-md ${
            isRecording ? "bg-red-500 text-white" : "bg-white/70 text-brand-teal hover:bg-brand-teal/10"
          }`}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M19 10v1a7 7 0 01-14 0v-1" />
            <line x1="12" y1="18" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </motion.button>
        <motion.button
          onClick={handleSend}
          whileTap={{ scale: 0.9 }}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-r from-brand-teal to-[#5fb3af] text-white flex items-center justify-center shadow-md shadow-teal-300/30 hover:shadow-lg hover:shadow-teal-300/40 transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ═══════════════════ Node Circle ═══════════════════ */

function MapNodeCircle({
  node,
  index,
  courseId,
}: {
  node: MapNode;
  index: number;
  courseId: string;
}) {
  const isClickable =
    node.status === "available" || node.status === "completed";

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15 * index, type: "spring", damping: 14 }}
      className="flex flex-col items-center gap-2 cursor-pointer"
      whileHover={isClickable ? { scale: 1.1 } : {}}
      whileTap={isClickable ? { scale: 0.92 } : {}}
    >
      {/* Outer glow ring for available */}
      {node.status === "available" && (
        <>
          <motion.div
            className="absolute w-[88px] h-[88px] rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(122,199,196,0.25) 0%, transparent 70%)",
            }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
          />
          {/* Petal / scallop border */}
          <motion.div
            className="absolute w-[76px] h-[76px]"
            animate={{ rotate: [0, 360] }}
            transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
          >
            <svg viewBox="0 0 76 76" className="w-full h-full" fill="none">
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 30 * Math.PI) / 180;
                const cx = 38 + 32 * Math.cos(angle);
                const cy = 38 + 32 * Math.sin(angle);
                return (
                  <circle
                    key={i}
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

      {/* Completed outer ring decoration */}
      {node.status === "completed" && (
        <motion.div
          className="absolute w-[78px] h-[78px]"
          animate={{ rotate: [0, -360] }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
        >
          <svg viewBox="0 0 78 78" className="w-full h-full" fill="none">
            {Array.from({ length: 10 }).map((_, i) => {
              const angle = (i * 36 * Math.PI) / 180;
              const cx = 39 + 33 * Math.cos(angle);
              const cy = 39 + 33 * Math.sin(angle);
              return (
                <circle
                  key={i}
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

      {/* Main circle */}
      <div
        className={`relative z-10 h-[64px] w-[64px] rounded-full flex items-center justify-center transition-all ${
          node.status === "completed"
            ? "shadow-lg shadow-amber-300/30"
            : node.status === "available"
            ? "shadow-lg shadow-teal-400/30"
            : "shadow-md"
        }`}
      >
        {/* Background with double border effect */}
        <div
          className={`absolute inset-0 rounded-full ${
            node.status === "completed"
              ? "bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500"
              : node.status === "available"
              ? "bg-gradient-to-br from-[#7AC7C4] via-[#5fb3af] to-[#4da8a4]"
              : "bg-gradient-to-br from-[#e0ddd8] via-[#d4d0ca] to-[#c8c4be]"
          }`}
        />
        {/* Inner ring */}
        <div
          className={`absolute inset-[3px] rounded-full border-2 ${
            node.status === "completed"
              ? "border-yellow-200/50"
              : node.status === "available"
              ? "border-white/30"
              : "border-white/20"
          }`}
        />
        {/* Specular highlight */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-[70%] h-[40%] rounded-[50%]"
            style={{
              background:
                node.status === "locked"
                  ? "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 100%)"
                  : "linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)",
            }}
          />
        </div>

        {/* Icon */}
        <div className="relative z-10">
          {node.status === "completed" ? (
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
          ) : node.status === "available" ? (
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 text-white drop-shadow-sm"
                fill="currentColor"
              >
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

      {/* Label */}
      <span
        className={`text-[11px] font-heading font-bold text-center max-w-[100px] leading-tight drop-shadow-sm ${
          node.status === "completed"
            ? "text-amber-700"
            : node.status === "available"
            ? "text-teal-700"
            : "text-brand-gray-400"
        }`}
      >
        {node.title}
      </span>
    </motion.div>
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
      {isClickable ? (
        <Link href={`/courses/${courseId}/nodes/${node.id}`}>
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}

/* ═══════════════════ Floating Particles ═══════════════════ */

function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        x: 5 + Math.random() * 90,
        size: 3 + Math.random() * 5,
        delay: Math.random() * 8,
        duration: 10 + Math.random() * 12,
        opacity: 0.08 + Math.random() * 0.15,
        type: i % 4, // 0=dot, 1=ring, 2=diamond, 3=star
      })),
    []
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{ left: `${p.x}%`, bottom: -20 }}
          animate={{
            y: [0, -(typeof window !== "undefined" ? window.innerHeight + 40 : 900)],
            x: [0, (p.id % 2 === 0 ? 1 : -1) * (15 + Math.random() * 25)],
            rotate: [0, 180 + Math.random() * 180],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {p.type === 0 && (
            <div
              className="rounded-full bg-brand-teal"
              style={{
                width: p.size,
                height: p.size,
                opacity: p.opacity,
              }}
            />
          )}
          {p.type === 1 && (
            <div
              className="rounded-full border border-brand-teal"
              style={{
                width: p.size * 1.5,
                height: p.size * 1.5,
                opacity: p.opacity,
              }}
            />
          )}
          {p.type === 2 && (
            <div
              className="bg-amber-400"
              style={{
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                transform: "rotate(45deg)",
                borderRadius: 1,
              }}
            />
          )}
          {p.type === 3 && (
            <svg
              viewBox="0 0 24 24"
              fill="#7AC7C4"
              style={{
                width: p.size * 1.8,
                height: p.size * 1.8,
                opacity: p.opacity,
              }}
            >
              <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
            </svg>
          )}
        </motion.div>
      ))}

      {/* Sparkle shimmer dots */}
      {Array.from({ length: 14 }, (_, i) => (
        <motion.div
          key={`sparkle-${i}`}
          className="absolute rounded-full bg-white"
          style={{
            width: 2 + Math.random() * 3,
            height: 2 + Math.random() * 3,
            left: `${8 + Math.random() * 84}%`,
            top: `${10 + Math.random() * 80}%`,
          }}
          animate={{
            opacity: [0, 0.4, 0],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{
            duration: 2 + Math.random() * 3,
            delay: Math.random() * 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════ Background ═══════════════════ */

function MapBg() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Runic circle — bottom-right */}
      <svg
        viewBox="0 0 700 700"
        className="absolute -right-[160px] -bottom-[160px] w-[520px] h-[520px] opacity-[0.08]"
        fill="none"
      >
        <defs>
          <radialGradient id="mapPeach" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#D4EEE8" />
            <stop offset="60%" stopColor="#B5DDD4" />
            <stop offset="100%" stopColor="#9ACEC3" />
          </radialGradient>
          <path
            id="mapRune"
            d="M 350,350 m -260,0 a 260,260 0 1,1 520,0 a 260,260 0 1,1 -520,0"
          />
        </defs>
        <circle cx="350" cy="350" r="300" fill="url(#mapPeach)" opacity="0.5" />
        <circle
          cx="350"
          cy="350"
          r="290"
          fill="none"
          stroke="#7AC7C4"
          strokeWidth="1"
          opacity="0.3"
        />
        <circle
          cx="350"
          cy="350"
          r="240"
          fill="none"
          stroke="#7AC7C4"
          strokeWidth="0.5"
          opacity="0.2"
          strokeDasharray="8 6"
        />
        <text
          fill="#7AC7C4"
          fontSize="18"
          fontWeight="500"
          letterSpacing="4"
          opacity="0.3"
        >
          <textPath href="#mapRune">
            ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟ
          </textPath>
        </text>
      </svg>

      {/* Subtle top-left gradient orb */}
      <div
        className="absolute -left-[100px] -top-[100px] w-[400px] h-[400px] rounded-full opacity-[0.06]"
        style={{
          background:
            "radial-gradient(circle, rgba(122,199,196,0.6) 0%, transparent 70%)",
        }}
      />

      {/* Mid-right soft glow */}
      <div
        className="absolute right-[5%] top-[35%] w-[200px] h-[200px] rounded-full opacity-[0.05]"
        style={{
          background:
            "radial-gradient(circle, rgba(245,200,66,0.5) 0%, transparent 70%)",
        }}
      />
    </div>
  );
}
