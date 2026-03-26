"use client";

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import TopStatsBar from "@/components/layout/TopStatsBar";
import { ApiError, apiFetch } from "@/lib/apiClient";
import type { CourseListItem, CoursePath, Project } from "@/lib/apiTypes";
import { useAuthStore } from "@/stores/useAuthStore";
import useUserStore from "@/stores/useUserStore";
import { HomeActiveJobBanner } from "@/features/home/HomeActiveJobBanner";
import { HomeBackground } from "@/features/home/HomeBackground";
import { HomeDuoPanel } from "@/features/home/HomeDuoPanel";
import { HomeForgePanel } from "@/features/home/HomeForgePanel";
import { HomeJourneyPanel } from "@/features/home/HomeJourneyPanel";
import { HomeLibrarySection, type HomeLibraryItem } from "@/features/home/HomeLibrarySection";
import { HomeProjectModal } from "@/features/home/HomeProjectModal";
import type { ProjectModalState } from "@/features/home/homePageTypes";
import { useActiveJobResume } from "@/features/home/useActiveJobResume";
import { useHomeDashboardData } from "@/features/home/useHomeDashboardData";
import { useHomeProjectActions } from "@/features/home/useHomeProjectActions";
import { useProjectFiles } from "@/features/home/useProjectFiles";

/* ═══════════════════ Page ═══════════════════ */

export default function HomePage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const name = useUserStore((s) => s.name);
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
  } = useHomeDashboardData(token);
  const { projectFiles, loadProjectFiles } = useProjectFiles(currentProject);
  const { activeJob, cancelActiveJob } = useActiveJobResume(token);
  const [topic, setTopic] = useState("");
  const [activeCoursePath, setActiveCoursePath] = useState<CoursePath | null>(null);
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
    setActiveCoursePath,
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
    if (!token) {
      router.replace("/auth/login");
    }
  }, [router, token]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.sessionStorage.getItem("learn8_recent_course_navigation");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        courseId?: number;
        timestamp?: number;
      };
      const courseId = parsed.courseId;
      const timestamp = parsed.timestamp ?? 0;

      if (
        courseId &&
        Number.isFinite(courseId) &&
        Date.now() - timestamp < 15000
      ) {
        window.sessionStorage.removeItem("learn8_recent_course_navigation");
        router.replace(`/courses/${courseId}`);
        return;
      }
    } catch {
      // Ignore malformed persisted navigation intent.
    }

    window.sessionStorage.removeItem("learn8_recent_course_navigation");
  }, [router]);

  useEffect(() => {
    if (!currentProject) {
      setTopic("");
      return;
    }
    setTopic(draftsByProject[currentProject.id]?.topic || "");
  }, [currentProject, draftsByProject]);

  const activeCourse = useMemo(
    () =>
      currentProject
        ? courses.find((course) => course.project_id === currentProject.id) || null
        : null,
    [courses, currentProject]
  );
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
        {activeJob && (
          <HomeActiveJobBanner
            activeJob={activeJob}
            onCancel={() => cancelActiveJob()}
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
