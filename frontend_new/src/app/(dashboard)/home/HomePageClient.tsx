"use client";

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import TopStatsBar from "@/components/layout/TopStatsBar";
import {
  clearRecentCourseNavigation,
  getRecentCourseNavigation,
} from "@/lib/navigation/intents";
import { useAuthStore } from "@/stores/app/useAuthStore";
import useUserStore, { selectUserName } from "@/stores/app/useUserStore";
import { HomeActiveJobBanner } from "./components/HomeActiveJobBanner";
import { HomeBackground } from "./components/HomeBackground";
import { HomeDuoPanel } from "./components/HomeDuoPanel";
import { HomeForgePanel } from "./components/HomeForgePanel";
import { HomeJourneyPanel } from "./components/HomeJourneyPanel";
import { HomeLibrarySection, type HomeLibraryItem } from "./components/HomeLibrarySection";
import { HomeProjectModal } from "./components/HomeProjectModal";
import { useActiveJobResume } from "./hooks/useActiveJobResume";
import { useHomeActiveCourse } from "./hooks/useHomeActiveCourse";
import { useHomeDashboardData } from "./hooks/useHomeDashboardData";
import { useHomeProjectActions } from "./hooks/useHomeProjectActions";
import { useProjectFiles } from "./hooks/useProjectFiles";
import type { ProjectModalState } from "./types";

/* ═══════════════════ Page ═══════════════════ */

export default function HomePage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const name = useUserStore(selectUserName);
  const {
    currentProject,
    setCurrentProject,
    projects,
    setProjects,
    courses,
    setCourses,
    draftsByProject,
    setDraftsByProject,
    error,
    setError,
    isLoading,
  } = useHomeDashboardData(token);
  const { projectFiles, loadProjectFiles } = useProjectFiles(currentProject?.id ?? null);
  const { activeJob, cancelActiveJob, retryActiveJob } = useActiveJobResume(token);
  const {
    activeCourse,
    activeCourseLoading,
    activeCourseError,
    activeCourseId,
    resumeTitle,
    resumeNodeCount,
    activeProgress,
    hasResumeCourse,
  } = useHomeActiveCourse({
    currentProject,
    courses,
  });
  const [topic, setTopic] = useState("");
  const {
    fileInputRef,
    isDragging,
    setIsDragging,
    isForging,
    isSubmittingTopic,
    removingFile,
    fileActionMessage,
    projectModal,
    setProjectModal,
    handleFileAccepted,
    handleRemoveProjectFile,
    handleRenameProject,
    handleDeleteProject,
    handleTopicSubmit,
  } = useHomeProjectActions({
    currentProject,
    setCurrentProject,
    projects,
    setProjects,
    setCourses,
    setDraftsByProject,
    setError,
    loadProjectFiles,
  });

  const openProjectModal = useCallback(
    (modal: NonNullable<ProjectModalState>) => {
      setProjectModal(modal);
    },
    [setProjectModal]
  );

  useEffect(() => {
    if (!authHydrated) return;
    if (!token) {
      router.replace("/auth/login");
    }
  }, [authHydrated, router, token]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const courseId = getRecentCourseNavigation();
    if (courseId) {
      clearRecentCourseNavigation();
      router.replace(`/courses/${courseId}`);
      return;
    }

    clearRecentCourseNavigation();
  }, [router]);

  useEffect(() => {
    if (!currentProject) {
      setTopic("");
      return;
    }
    setTopic(draftsByProject[currentProject.id]?.topic || "");
  }, [currentProject, draftsByProject]);

  const libraryItems = useMemo<HomeLibraryItem[]>(() => {
    const projectById = new Map(projects.map((project) => [project.id, project]));
    const items: HomeLibraryItem[] = [];

    courses.forEach((course, index) => {
      const project =
        (course.project_id ? projectById.get(course.project_id) : null) ?? null;
      if (!project) return;
      items.push({
        kind: "course",
        key: `course-${course.id}`,
        project,
        course,
        href: `/courses/${course.id}`,
        title: course.title,
        subtitle: project.name,
        stateLabel: "Course",
        indexSeed: index,
      });
    });

    projects.forEach((project, index) => {
      const hasCourse = courses.some((course) => course.project_id === project.id);
      if (hasCourse) return;

      const draft = draftsByProject[project.id];
      if (!draft?.topic) return;

      const hasQuestions = (draft.questions?.length || 0) > 0;
      const hasAnswers = Object.keys(draft.answers || {}).length > 0;
      items.push({
        kind: "draft",
        key: `draft-${project.id}`,
        project,
        href: `/questionnaire?projectId=${project.id}`,
        title: draft.topic,
        subtitle: project.name,
        stateLabel: hasQuestions
          ? hasAnswers
            ? "Draft In Progress"
            : "Questionnaire Ready"
          : "Topic Draft",
        indexSeed: courses.length + index,
      });
    });

    return items.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "draft" ? -1 : 1;
      }
      return b.project.id - a.project.id;
    });
  }, [courses, draftsByProject, projects]);

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

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/pdf") {
        void handleFileAccepted(file, setTopic);
      }
    },
    [handleFileAccepted, setIsDragging]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void handleFileAccepted(file, setTopic);
      }
    },
    [handleFileAccepted]
  );

  // ── Ensure library scroll starts from the left ──
  // 1) Pre-paint reset (covers re-renders & soft-navigation)
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  });
  // 2) Post-paint fallback (covers persist-rehydration & late renders)
  const courseCount = libraryItems.length;
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [courseCount]);

  const scrollLibrary = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "right" ? 260 : -260,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative overflow-hidden" style={{ zoom: 1.05 }}>
      <TopStatsBar />

      <HomeBackground />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {isLoading && (
          <div className="rounded-2xl border border-white/60 bg-white/65 px-4 py-3 text-sm text-brand-gray-600 shadow-sm backdrop-blur">
            Refreshing your projects and courses...
          </div>
        )}

        {activeCourseLoading && (
          <div className="rounded-2xl border border-white/60 bg-white/65 px-4 py-3 text-sm text-brand-gray-600 shadow-sm backdrop-blur">
            Refreshing your active course...
          </div>
        )}

        {activeCourseError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {activeCourseError}
          </div>
        )}

        {activeJob && (
          <HomeActiveJobBanner
            activeJob={activeJob}
            onCancel={() => cancelActiveJob()}
            onRetry={() => retryActiveJob()}
          />
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <HomeJourneyPanel
            name={name}
            currentProject={currentProject}
            hasResumeCourse={hasResumeCourse}
            activeCourseId={activeCourseId}
            activeCourseNumericId={activeCourse?.id ?? null}
            resumeTitle={resumeTitle}
            resumeNodeCount={resumeNodeCount}
            activeProgress={activeProgress}
          />

          <HomeForgePanel
            fileInputRef={fileInputRef}
            isDragging={isDragging}
            isForging={isForging}
            isSubmittingTopic={isSubmittingTopic}
            removingFile={removingFile}
            fileActionMessage={fileActionMessage}
            projectFiles={projectFiles}
            topic={topic}
            setIsDragging={setIsDragging}
            setTopic={setTopic}
            onFileChange={onFileChange}
            onDrop={onDrop}
            onTopicSubmit={() => handleTopicSubmit(topic)}
            onRemoveProjectFile={(file) => handleRemoveProjectFile(file)}
          />

          <HomeDuoPanel />
        </div>

        <HomeLibrarySection
          scrollRef={scrollRef}
          libraryItems={libraryItems}
          onScrollLibrary={scrollLibrary}
          onOpenProjectModal={openProjectModal}
        />
      </div>

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

      <HomeProjectModal
        projectModal={projectModal}
        setProjectModal={setProjectModal}
        onRename={handleRenameProject}
        onDelete={handleDeleteProject}
      />
    </div>
  );
}
