"use client";

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import TopProgressBar from "@/components/ui/TopProgressBar";
import TopStatsBar from "@/components/shared/TopStatsBar";
import { ApiError, apiFetch } from "@/lib/api";
import type { CourseListItem, CoursePath, Project, UserProfile } from "@/lib/types";
import { useAuthStore } from "@/stores/useAuthStore";
import { useProjectStore } from "@/stores/useProjectStore";
import useUserStore from "@/stores/useUserStore";

const STORE_COURSE_STYLE: Record<string, { bg: string; icon: React.ReactNode }> = {
  "med-u1": { bg: "from-rose-200 to-rose-100", icon: <HeartIcon /> },
  "calc-u1": { bg: "from-sky-200 to-indigo-100", icon: <CalculusIcon /> },
  "ja-u1": { bg: "from-pink-200 to-pink-100", icon: <JapanIcon /> },
  "es-u1": { bg: "from-red-300 to-yellow-200", icon: <SpainIcon /> },
  "py-u1": { bg: "from-blue-100 to-blue-50", icon: <PythonIcon /> },
  "py2-u1": { bg: "from-emerald-400 to-emerald-300", icon: <PythonIcon2 /> },
  "gen-u1": { bg: "from-amber-100 to-orange-50", icon: <GenericIcon /> },
  "ml-u1": { bg: "from-violet-200 to-violet-100", icon: <MLIcon /> },
  "ds-u1": { bg: "from-cyan-200 to-cyan-100", icon: <DSIcon /> },
};

/* ═══════════════════ Page ═══════════════════ */

export default function HomePage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const currentProject = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const syncFromProfile = useUserStore((s) => s.syncFromProfile);
  const name = useUserStore((s) => s.name);
  const [projects, setProjects] = useState<Project[]>([]);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [topic, setTopic] = useState("");
  const [activeCoursePath, setActiveCoursePath] = useState<CoursePath | null>(null);
  const [error, setError] = useState("");
  const [isForging, setIsForging] = useState(false);
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);

  useEffect(() => {
    if (!token) {
      router.replace("/auth/login");
    }
  }, [router, token]);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        const [profile, projectData] = await Promise.all([
          apiFetch<UserProfile>("/auth/me"),
          apiFetch<Project[]>("/projects"),
        ]);
        updateUser(profile);
        syncFromProfile(profile);
        setProjects(projectData);
        if (!currentProject && projectData[0]) {
          setCurrentProject(projectData[0]);
        }
      } catch (err) {
        setError(
          err instanceof ApiError ? err.detail : "Failed to load dashboard."
        );
      }
    };

    void load();
  }, [token, updateUser, syncFromProfile, currentProject, setCurrentProject]);

  useEffect(() => {
    if (!currentProject) {
      setCourses([]);
      setTopic("");
      return;
    }

    const loadCourses = async () => {
      try {
        const data = await apiFetch<CourseListItem[]>(
          `/courses?project_id=${currentProject.id}`
        );
        setCourses(data);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.detail : "Failed to load courses."
        );
      }
    };

    void loadCourses();
  }, [currentProject]);

  useEffect(() => {
    if (!currentProject) return;

    const loadDraft = async () => {
      try {
        const data = await apiFetch<{ draft?: { topic?: string } }>(
          `/projects/${currentProject.id}/draft`
        );
        setTopic(data.draft?.topic || "");
      } catch {
        // Ignore missing/empty draft
      }
    };

    void loadDraft();
  }, [currentProject]);

  const activeCourse = courses[0] || null;
  const activeCourseId = activeCourse ? String(activeCourse.id) : null;
  const resumeTitle = activeCourse?.title ?? "Course";

  useEffect(() => {
    if (!activeCourse) {
      setActiveCoursePath(null);
      return;
    }

    const loadCourseDetail = async () => {
      try {
        const data = await apiFetch<CoursePath>(`/courses/${activeCourse.id}`);
        setActiveCoursePath(data);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.detail : "Failed to load active course."
        );
      }
    };

    void loadCourseDetail();
  }, [activeCourse]);
  const allNodes = activeCoursePath?.units.flatMap((unit) => unit.nodes) ?? [];
  const resumeNodeCount = allNodes.length;
  const completedNodeCount = allNodes.filter((node) => node.status === "completed").length;
  const activeProgress =
    resumeNodeCount > 0
      ? Math.round((completedNodeCount / resumeNodeCount) * 100)
      : 0;
  const hasResumeCourse = !!activeCourse;

  /* ── Forge drop zone ── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Prevent browser from opening files dropped anywhere on the page
  useEffect(() => {
    const prevent = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const handleFileAccepted = useCallback(
    async (file: File) => {
      setSelectedFile(file);
      setError("");
      setIsForging(true);
      try {
        let project = currentProject;
        if (!project) {
          project = await apiFetch<Project>("/projects", {
            method: "POST",
            body: JSON.stringify({
              name: file.name.replace(/\.[^.]+$/, "") || "Imported Project",
            }),
          });
          setProjects((prev) => [project!, ...prev]);
          setCurrentProject(project);
        }

        const formData = new FormData();
        formData.append("file", file);
        await apiFetch(`/projects/upload-document?project_id=${project.id}`, {
          method: "POST",
          body: formData,
        });
        setTopic((prev) => prev || file.name.replace(/\.[^.]+$/, "") || project.name);
        setIsForging(false);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Forge setup failed.");
        setIsForging(false);
      }
    },
    [currentProject, router, setCurrentProject]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/pdf") handleFileAccepted(file);
    },
    [handleFileAccepted]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileAccepted(file);
    },
    [handleFileAccepted]
  );

  // ── Ensure library scroll starts from the left ──
  // 1) Pre-paint reset (covers re-renders & soft-navigation)
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  });
  // 2) Post-paint fallback (covers persist-rehydration & late renders)
  const courseCount = courses.length;
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [courseCount]);

  const scrollLibrary = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "right" ? 260 : -260,
      behavior: "smooth",
    });
  };

  const handleTopicSubmit = useCallback(async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) return;

    setError("");
    setIsSubmittingTopic(true);
    try {
      let project = currentProject;
      if (!project) {
        project = await apiFetch<Project>("/projects", {
          method: "POST",
          body: JSON.stringify({
            name: trimmedTopic,
          }),
        });
        setProjects((prev) => [project!, ...prev]);
        setCurrentProject(project);
      }

      await apiFetch(`/projects/${project.id}/draft`, {
        method: "PUT",
        body: JSON.stringify({
          draft: {
            topic: trimmedTopic,
            questions: [],
            answers: {},
            freeText: "",
          },
        }),
      });

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "learn8_pending_questionnaire",
          JSON.stringify({
            projectId: project.id,
            topic: trimmedTopic,
          })
        );
      }

      router.push("/questionnaire");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Failed to start questionnaire."
      );
    } finally {
      setIsSubmittingTopic(false);
    }
  }, [currentProject, router, setCurrentProject, topic]);

  return (
    <div className="relative overflow-hidden" style={{ zoom: 1.05 }}>
      <TopStatsBar />

      {/* ── Background decorations ── */}
      <DashboardBg />

      {/* ══════════════ Content ══════════════ */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* ── Top row: Continue Journey + Forge ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Continue Journey */}
          <DeepGlassCard className="h-full min-h-[360px] px-6 py-6 md:px-8 md:py-8">
            <div className="flex h-full flex-col">
              <h2 className="font-heading text-2xl md:text-3xl font-extrabold text-brand-gray-700 mb-1">
                Welcome back, {name}!
              </h2>
              <p className="text-sm text-brand-gray-400 mb-5">Continue your journey</p>
              {currentProject && (
                <p className="text-xs text-brand-gray-500 mb-4">
                  Project: {currentProject.name}
                </p>
              )}

              {hasResumeCourse ? (
                <div className="flex flex-1 gap-5 items-start">
                  <div className={`shrink-0 w-28 h-32 rounded-xl overflow-hidden shadow-md flex items-center justify-center bg-gradient-to-br ${(Object.values(STORE_COURSE_STYLE)[activeCourse.id % Object.values(STORE_COURSE_STYLE).length] ?? { bg: "from-teal-100 to-teal-50" }).bg}`}>
                    {(Object.values(STORE_COURSE_STYLE)[activeCourse.id % Object.values(STORE_COURSE_STYLE).length] ?? { icon: <GenericIcon /> }).icon}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="font-heading font-bold text-brand-gray-700 text-lg leading-tight mb-1">
                      {resumeTitle}
                    </h3>
                    <p className="text-sm text-brand-gray-400 mb-3">
                      {resumeNodeCount} nodes
                    </p>

                    <TopProgressBar progress={activeProgress} className="mb-2" />
                    <p className="text-xs text-brand-gray-500 font-semibold mb-4">
                      {activeProgress}% Complete
                    </p>

                    <div className="mt-auto">
                      <Link href={`/courses/${activeCourseId}`}>
                        <GameButton className="w-full text-base">Resume</GameButton>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 flex-col">
                  <p className="text-brand-gray-400 text-sm">
                    No active courses yet. Forge a new one!
                  </p>
                </div>
              )}
            </div>
          </DeepGlassCard>

          <DeepGlassCard className="relative h-full min-h-[360px] rounded-3xl border border-white/40 bg-white/60 px-6 py-6 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 md:px-7 md:py-7">
            <div className="flex h-full flex-col">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={onFileChange}
              />

              <motion.div
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                onDrop={onDrop}
                className={`relative flex-1 min-h-[200px] rounded-2xl border-2 border-dashed backdrop-blur-sm flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 ${
                  selectedFile
                    ? "border-brand-teal bg-brand-teal/10"
                    : isDragging
                    ? "border-brand-teal/80 bg-white/60 shadow-lg shadow-brand-teal/10"
                    : "border-brand-teal/40 bg-white/40 hover:border-brand-teal/70 hover:bg-white/50"
                }`}
              >
                <AnimatePresence mode="wait">
                  {selectedFile ? (
                    <motion.div
                      key="accepted"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      >
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                          <circle cx="20" cy="20" r="18" stroke="#7AC7C4" strokeWidth="3" strokeDasharray="80 30" />
                        </svg>
                      </motion.div>
                      <p className="text-sm font-semibold text-brand-teal">{selectedFile.name}</p>
                      <p className="text-xs text-brand-gray-400">
                        {isForging ? "Uploading…" : "Uploaded"}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <motion.div animate={isDragging ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}>
                        <PortalIcon />
                      </motion.div>
                      <p className="text-sm md:text-base text-brand-gray-500 text-center max-w-xs px-4">
                        {isDragging
                          ? "Release to upload your PDF"
                          : "Drop a PDF here or click this card, then define your topic below."}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <div className="mt-4 rounded-2xl bg-white/55 backdrop-blur-sm border border-white/60 p-4 space-y-3">
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="min-w-0 flex-1">
                    <input
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void handleTopicSubmit();
                        }
                      }}
                      placeholder="Enter the topic you want to learn"
                      className="w-full rounded-xl border border-brand-gray-200 bg-white px-4 py-3 text-sm text-brand-gray-700 outline-none focus:border-brand-teal"
                    />
                  </div>
                  <div className="md:w-auto md:shrink-0">
                    <GameButton
                      onClick={() => void handleTopicSubmit()}
                      disabled={!topic.trim() || isSubmittingTopic || isForging}
                      className="w-full min-w-[160px] md:min-w-[180px]"
                    >
                      {isSubmittingTopic ? "Generating..." : "Generate"}
                    </GameButton>
                  </div>
                </div>
              </div>
            </div>
          </DeepGlassCard>

          <DeepGlassCard className="h-full min-h-[360px] px-6 py-6 md:px-7 md:py-7">
            <div className="flex h-full flex-col">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-2xl md:text-3xl font-extrabold text-brand-gray-700">
                    Duo Arena
                  </h2>
                  <p className="mt-1 text-sm text-brand-gray-400">
                    Launch the separate live battle experience.
                  </p>
                </div>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-inner">
                  <DuoIcon />
                </div>
              </div>

              <div className="flex-1 rounded-2xl border border-white/60 bg-white/55 p-4 backdrop-blur-sm">
                <p className="text-sm leading-relaxed text-brand-gray-500">
                  Use this entry when you want the deployed two-player mode. It stays separate from the Learn8 backend flow.
                </p>
              </div>

              <Link href="/duo" className="mt-4">
                <GameButton className="w-full text-base">Enter Duo</GameButton>
              </Link>
            </div>
          </DeepGlassCard>
        </div>

        {/* ── Your Library ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-2xl md:text-3xl font-extrabold text-brand-gray-700">
              Your Library
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => scrollLibrary("left")}
                className="h-9 w-9 rounded-full border border-brand-gray-200 bg-white flex items-center justify-center text-brand-gray-400 hover:text-brand-gray-600 hover:border-brand-gray-300 transition shadow-sm"
              >
                ‹
              </button>
              <button
                onClick={() => scrollLibrary("right")}
                className="h-9 w-9 rounded-full border border-brand-gray-200 bg-white flex items-center justify-center text-brand-gray-400 hover:text-brand-gray-600 hover:border-brand-gray-300 transition shadow-sm"
              >
                ›
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            dir="ltr"
            className="flex gap-4 overflow-x-auto pt-4 pb-4 scrollbar-hide snap-x"
            style={{ scrollbarWidth: "none" }}
          >
            {/* Real courses from backend */}
            {courses.map((c, index) => {
              const style = Object.values(STORE_COURSE_STYLE)[index % Object.values(STORE_COURSE_STYLE).length] ?? { bg: "from-teal-100 to-teal-50", icon: <GenericIcon /> };
              return (
              <motion.div
                key={c.id}
                whileHover={{ y: -4 }}
                className="shrink-0 w-40 md:w-48 snap-start"
              >
                <Link href={`/courses/${c.id}`}>
                  <div className={`h-36 md:h-44 rounded-2xl bg-gradient-to-br ${style.bg} flex items-center justify-center shadow-md hover:shadow-lg transition-all`}>
                    {style.icon}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-brand-gray-600 text-center truncate">
                    {c.title}
                  </p>
                </Link>
              </motion.div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="relative z-10 py-4 text-center text-sm text-brand-gray-400">
        {error && <div className="mb-3 text-sm text-rose-600">{error}</div>}
        <a href="#" className="hover:text-brand-gray-600 transition">About</a>
        <span className="mx-2 text-brand-gray-300">|</span>
        <a href="#" className="hover:text-brand-gray-600 transition">Contact</a>
        <span className="mx-2 text-brand-gray-300">|</span>
        <a href="#" className="hover:text-brand-gray-600 transition">Privacy</a>
        <span className="mx-2 text-brand-gray-300">|</span>
        <a href="#" className="hover:text-brand-gray-600 transition">Terms</a>
      </footer>
    </div>
  );
}

/* ═══════════════════ Background ═══════════════════ */

function DashboardBg() {
  const runeText =
    "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟ";
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Rune circle – bottom right */}
      <svg
        viewBox="0 0 700 700"
        className="absolute -right-[180px] -bottom-[180px] w-[600px] h-[600px] opacity-20"
        fill="none"
      >
        <defs>
          <radialGradient id="dashPeach" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#FFF5EC" />
            <stop offset="60%" stopColor="#F5DECA" />
            <stop offset="100%" stopColor="#EDD0B5" />
          </radialGradient>
          <path id="dashRune" d="M 350,350 m -260,0 a 260,260 0 1,1 520,0 a 260,260 0 1,1 -520,0" />
        </defs>
        <circle cx="350" cy="350" r="300" fill="url(#dashPeach)" opacity="0.5" />
        <circle cx="350" cy="350" r="290" fill="none" stroke="#D4BC8B" strokeWidth="1" opacity="0.4" />
        <circle cx="350" cy="350" r="248" fill="none" stroke="#D4BC8B" strokeWidth="1" opacity="0.4" />
        <text fill="#C4A87A" fontSize="18" fontWeight="500" letterSpacing="4" opacity="0.35">
          <textPath href="#dashRune">{runeText}</textPath>
        </text>
      </svg>

      {/* Sparkle */}
      <svg viewBox="0 0 40 40" className="absolute bottom-8 right-8 w-7 h-7" fill="none">
        <path d="M20 0 L22 16 L40 20 L22 22 L20 40 L18 22 L0 20 L18 16 Z" fill="#D4A96A" opacity="0.5" />
      </svg>
    </div>
  );
}

/* ═══════════════════ Portal icon for Forge ═══════════════════ */

function PortalIcon() {
  return (
    <svg viewBox="0 0 120 120" className="h-24 w-24" fill="none">
      {/* Outer glow */}
      <circle cx="60" cy="60" r="50" fill="#7AC7C4" opacity="0.08" />
      <circle cx="60" cy="60" r="42" fill="#7AC7C4" opacity="0.12" />
      {/* Portal ring */}
      <circle cx="60" cy="60" r="35" fill="none" stroke="#7AC7C4" strokeWidth="3" opacity="0.4" />
      <circle cx="60" cy="60" r="30" fill="none" stroke="#D4BC8B" strokeWidth="2" opacity="0.5" />
      {/* Inner portal */}
      <circle cx="60" cy="60" r="24" fill="#E8F5F4" />
      <circle cx="60" cy="60" r="18" fill="#7AC7C4" opacity="0.15" />
      {/* Magic runes around */}
      <text x="60" y="30" textAnchor="middle" fontSize="8" fill="#C4A87A" opacity="0.6">ᚠᚢᚦ</text>
      <text x="60" y="95" textAnchor="middle" fontSize="8" fill="#C4A87A" opacity="0.6">ᛉᛊᛏ</text>
      {/* Center emblem */}
      <circle cx="60" cy="60" r="10" fill="#7AC7C4" opacity="0.3" />
      <path d="M55 55h10v10H55z" fill="none" stroke="#5BB5B0" strokeWidth="1.5" rx="2" />
      <circle cx="60" cy="60" r="3" fill="#5BB5B0" opacity="0.6" />
      {/* Sparkles */}
      <circle cx="40" cy="45" r="2" fill="#D4A96A" opacity="0.4" />
      <circle cx="80" cy="75" r="1.5" fill="#D4A96A" opacity="0.5" />
      <circle cx="78" cy="42" r="1" fill="#7AC7C4" opacity="0.5" />
    </svg>
  );
}

/* ═══════════════════ Course thumbnail icons ═══════════════════ */

function FrenchThumbnail() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-100 via-white to-red-100 flex items-center justify-center relative">
      {/* French flag stripes */}
      <div className="absolute inset-0 flex">
        <div className="w-1/3 bg-blue-400/30" />
        <div className="w-1/3 bg-white/30" />
        <div className="w-1/3 bg-red-400/30" />
      </div>
      <svg viewBox="0 0 60 60" className="h-16 w-16 relative z-10" fill="none">
        <circle cx="20" cy="28" r="8" fill="#EDB9A0" />
        <rect x="14" y="36" width="12" height="16" rx="3" fill="#E8734A" opacity="0.6" />
        <circle cx="40" cy="28" r="8" fill="#EDB9A0" />
        <rect x="34" y="36" width="12" height="16" rx="3" fill="#5BB5B0" opacity="0.6" />
        <circle cx="20" cy="22" r="4" fill="#333" opacity="0.1" />
        <circle cx="40" cy="22" r="4" fill="#333" opacity="0.1" />
      </svg>
    </div>
  );
}

function JapanIcon() {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none">
      {/* Torii gate */}
      <rect x="18" y="28" width="4" height="38" rx="1.5" fill="#D94F5C" />
      <rect x="58" y="28" width="4" height="38" rx="1.5" fill="#D94F5C" />
      <rect x="14" y="26" width="52" height="5" rx="2" fill="#E35D6A" />
      <rect x="20" y="35" width="40" height="3.5" rx="1.5" fill="#E35D6A" />
      {/* Mt Fuji */}
      <path d="M42 50 L58 66 H26 Z" fill="#7B9EC9" opacity="0.5" />
      <path d="M42 50 L47 56 H37 Z" fill="white" opacity="0.7" />
      {/* Cherry blossom */}
      <circle cx="64" cy="22" r="3.5" fill="#FFB7C5" />
      <circle cx="60" cy="18" r="3" fill="#FFA3B5" />
      <circle cx="67" cy="17" r="2.5" fill="#FFB7C5" />
      <circle cx="63" cy="15" r="2" fill="#FFCDD8" />
      <circle cx="58" cy="22" r="2.5" fill="#FFCDD8" />
    </svg>
  );
}

function SpainIcon() {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none">
      {/* Speech bubble */}
      <rect x="10" y="12" width="60" height="44" rx="12" fill="white" opacity="0.9" />
      <path d="M30 56 L26 68 L38 56" fill="white" opacity="0.9" />
      {/* Spain flag colors as accent */}
      <rect x="18" y="20" width="44" height="6" rx="3" fill="#AA151B" />
      <rect x="18" y="30" width="44" height="8" rx="3" fill="#F1BF00" />
      <rect x="18" y="42" width="44" height="6" rx="3" fill="#AA151B" />
      {/* ¡Hola! text */}
      <text x="40" y="38" textAnchor="middle" fontFamily="sans-serif" fontWeight="800" fontSize="11" fill="#AA151B" opacity="0.9">¡Hola!</text>
    </svg>
  );
}

function DuoIcon() {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none">
      <circle cx="28" cy="28" r="10" fill="#64748B" opacity="0.35" />
      <circle cx="52" cy="28" r="10" fill="#334155" opacity="0.35" />
      <rect x="16" y="42" width="24" height="20" rx="10" fill="#64748B" opacity="0.45" />
      <rect x="40" y="42" width="24" height="20" rx="10" fill="#334155" opacity="0.45" />
      <circle cx="40" cy="36" r="4" fill="#0F172A" opacity="0.55" />
    </svg>
  );
}

function PythonIcon() {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none">
      {/* Terminal window */}
      <rect x="10" y="14" width="60" height="52" rx="8" fill="#1E293B" />
      <rect x="10" y="14" width="60" height="12" rx="8" fill="#334155" />
      <rect x="10" y="22" width="60" height="4" fill="#334155" />
      {/* Window dots */}
      <circle cx="20" cy="20" r="2.5" fill="#EF4444" />
      <circle cx="28" cy="20" r="2.5" fill="#EAB308" />
      <circle cx="36" cy="20" r="2.5" fill="#22C55E" />
      {/* Code lines */}
      <text x="18" y="39" fontFamily="monospace" fontWeight="700" fontSize="8" fill="#22C55E">&gt;&gt;&gt;</text>
      <rect x="38" y="33" width="24" height="4" rx="2" fill="#60A5FA" opacity="0.7" />
      <rect x="18" y="44" width="30" height="3.5" rx="1.5" fill="#A78BFA" opacity="0.5" />
      <rect x="18" y="52" width="20" height="3.5" rx="1.5" fill="#34D399" opacity="0.5" />
      <rect x="42" y="52" width="16" height="3.5" rx="1.5" fill="#FBBF24" opacity="0.5" />
    </svg>
  );
}

function PythonIcon2() {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none">
      {/* Rocket body */}
      <path d="M40 10 C40 10 28 28 28 48 C28 58 33 64 40 68 C47 64 52 58 52 48 C52 28 40 10 40 10Z" fill="white" opacity="0.95" />
      {/* Window */}
      <circle cx="40" cy="38" r="7" fill="#3B82F6" opacity="0.8" />
      <circle cx="40" cy="38" r="4" fill="#60A5FA" opacity="0.6" />
      <circle cx="38" cy="36" r="1.5" fill="white" opacity="0.7" />
      {/* Fins */}
      <path d="M28 48 Q22 52 20 60 L28 56Z" fill="#EF4444" opacity="0.8" />
      <path d="M52 48 Q58 52 60 60 L52 56Z" fill="#EF4444" opacity="0.8" />
      {/* Flame */}
      <path d="M36 68 Q38 76 40 78 Q42 76 44 68 Q42 72 40 73 Q38 72 36 68Z" fill="#F59E0B" />
      <path d="M38 68 Q39 74 40 75 Q41 74 42 68 Q41 71 40 71 Q39 71 38 68Z" fill="#EF4444" />
      {/* Nose cone */}
      <path d="M40 10 C38 16 36 22 35 26 L45 26 C44 22 42 16 40 10Z" fill="#EF4444" opacity="0.7" />
    </svg>
  );
}

function GenericIcon() {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none">
      {/* Book */}
      <path d="M16 18 C16 14 20 12 24 12 L56 12 C60 12 64 14 64 18 V62 C64 66 60 68 56 68 L24 68 C20 68 16 66 16 62Z" fill="#F59E0B" opacity="0.85" />
      <path d="M20 16 L20 64 C20 64 24 62 30 62 L60 62 L60 14 L30 14 C24 14 20 16 20 16Z" fill="#FEF3C7" />
      {/* Spine */}
      <path d="M20 16 L20 64" stroke="#D97706" strokeWidth="2" />
      {/* Lines on page */}
      <rect x="28" y="22" width="24" height="3" rx="1.5" fill="#D97706" opacity="0.3" />
      <rect x="28" y="30" width="20" height="2.5" rx="1" fill="#92400E" opacity="0.15" />
      <rect x="28" y="36" width="22" height="2.5" rx="1" fill="#92400E" opacity="0.15" />
      <rect x="28" y="42" width="18" height="2.5" rx="1" fill="#92400E" opacity="0.15" />
      {/* Bookmark */}
      <path d="M50 12 V28 L53 24 L56 28 V12Z" fill="#EF4444" opacity="0.7" />
      {/* Star */}
      <circle cx="55" cy="55" r="6" fill="#F59E0B" opacity="0.5" />
      <polygon points="55,49 56.5,53 61,53 57.5,56 58.8,60 55,57.5 51.2,60 52.5,56 49,53 53.5,53" fill="#FBBF24" />
    </svg>
  );
}

function MLIcon() {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none">
      {/* Brain outline */}
      <path d="M40 14 C30 14 22 20 22 30 C22 34 24 37 24 37 C20 39 18 43 18 48 C18 55 24 60 30 60 L32 60 C32 64 36 68 40 68 C44 68 48 64 48 60 L50 60 C56 60 62 55 62 48 C62 43 60 39 56 37 C56 37 58 34 58 30 C58 20 50 14 40 14Z" fill="#A78BFA" opacity="0.2" stroke="#8B5CF6" strokeWidth="2" />
      {/* Neural network nodes */}
      <circle cx="28" cy="32" r="4" fill="#8B5CF6" opacity="0.7" />
      <circle cx="40" cy="24" r="4" fill="#A78BFA" opacity="0.8" />
      <circle cx="52" cy="32" r="4" fill="#8B5CF6" opacity="0.7" />
      <circle cx="32" cy="46" r="4" fill="#7C3AED" opacity="0.6" />
      <circle cx="48" cy="46" r="4" fill="#7C3AED" opacity="0.6" />
      <circle cx="40" cy="58" r="4" fill="#6D28D9" opacity="0.7" />
      {/* Connections */}
      <line x1="28" y1="32" x2="40" y2="24" stroke="#8B5CF6" strokeWidth="1.5" opacity="0.4" />
      <line x1="52" y1="32" x2="40" y2="24" stroke="#8B5CF6" strokeWidth="1.5" opacity="0.4" />
      <line x1="28" y1="32" x2="32" y2="46" stroke="#8B5CF6" strokeWidth="1.5" opacity="0.4" />
      <line x1="52" y1="32" x2="48" y2="46" stroke="#8B5CF6" strokeWidth="1.5" opacity="0.4" />
      <line x1="32" y1="46" x2="40" y2="58" stroke="#8B5CF6" strokeWidth="1.5" opacity="0.4" />
      <line x1="48" y1="46" x2="40" y2="58" stroke="#8B5CF6" strokeWidth="1.5" opacity="0.4" />
      <line x1="32" y1="46" x2="48" y2="46" stroke="#8B5CF6" strokeWidth="1.5" opacity="0.3" />
      {/* Sparkle */}
      <path d="M60 16 L61 20 L65 21 L61 22 L60 26 L59 22 L55 21 L59 20Z" fill="#FBBF24" opacity="0.8" />
    </svg>
  );
}

function DSIcon() {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none">
      {/* Chart background */}
      <rect x="12" y="12" width="56" height="56" rx="10" fill="white" opacity="0.15" />
      {/* Grid lines */}
      <line x1="18" y1="58" x2="62" y2="58" stroke="#0891B2" strokeWidth="1" opacity="0.2" />
      <line x1="18" y1="46" x2="62" y2="46" stroke="#0891B2" strokeWidth="1" opacity="0.1" />
      <line x1="18" y1="34" x2="62" y2="34" stroke="#0891B2" strokeWidth="1" opacity="0.1" />
      {/* Bars */}
      <rect x="20" y="42" width="8" height="16" rx="3" fill="#06B6D4" opacity="0.7" />
      <rect x="31" y="30" width="8" height="28" rx="3" fill="#0891B2" opacity="0.8" />
      <rect x="42" y="36" width="8" height="22" rx="3" fill="#22D3EE" opacity="0.7" />
      <rect x="53" y="22" width="8" height="36" rx="3" fill="#06B6D4" opacity="0.9" />
      {/* Trend line */}
      <path d="M24 40 L35 28 L46 34 L57 20" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Dots on trend */}
      <circle cx="24" cy="40" r="3" fill="#F59E0B" />
      <circle cx="35" cy="28" r="3" fill="#F59E0B" />
      <circle cx="46" cy="34" r="3" fill="#F59E0B" />
      <circle cx="57" cy="20" r="3" fill="#FBBF24" />
      {/* Magnifier */}
      <circle cx="61" cy="16" r="5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.6" />
      <line x1="65" y1="20" x2="68" y2="23" stroke="white" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none">
      {/* Anatomical heart shape */}
      <path d="M40 68 C20 52 8 40 8 28 C8 18 16 10 26 10 C32 10 37 13 40 18 C43 13 48 10 54 10 C64 10 72 18 72 28 C72 40 60 52 40 68Z" fill="#E11D48" opacity="0.75" />
      <path d="M40 62 C24 48 14 38 14 28 C14 20 20 14 28 14 C33 14 37 16 40 20 C43 16 47 14 52 14 C60 14 66 20 66 28 C66 38 56 48 40 62Z" fill="#FB7185" opacity="0.6" />
      {/* Heartbeat line */}
      <path d="M12 40 L28 40 L32 30 L36 50 L40 25 L44 48 L48 32 L50 40 L68 40" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      {/* Blood drops */}
      <path d="M22 58 Q24 52 26 58 Q24 62 22 58Z" fill="#E11D48" opacity="0.4" />
      <path d="M56 56 Q58 50 60 56 Q58 60 56 56Z" fill="#E11D48" opacity="0.3" />
    </svg>
  );
}

function CalculusIcon() {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none">
      {/* Background circle */}
      <circle cx="40" cy="40" r="30" fill="#3B82F6" opacity="0.15" />
      {/* Coordinate axes */}
      <line x1="14" y1="60" x2="66" y2="60" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="20" y1="14" x2="20" y2="66" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      {/* Curve (limit / derivative) */}
      <path d="M22 55 C30 52 35 40 38 30 C41 20 46 16 55 14" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Tangent line */}
      <line x1="28" y1="55" x2="58" y2="22" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 3" opacity="0.7" />
      {/* Point on curve */}
      <circle cx="38" cy="30" r="4" fill="#6366F1" opacity="0.8" />
      <circle cx="38" cy="30" r="2" fill="white" opacity="0.9" />
      {/* dx notation */}
      <text x="54" y="70" fontFamily="serif" fontStyle="italic" fontSize="12" fill="#6366F1" opacity="0.7">dx</text>
      {/* Integral symbol */}
      <text x="8" y="30" fontFamily="serif" fontSize="18" fill="#3B82F6" opacity="0.5">∫</text>
      {/* Infinity */}
      <text x="58" y="14" fontFamily="serif" fontSize="10" fill="#6366F1" opacity="0.4">∞</text>
    </svg>
  );
}
