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
import { HomeCourseModal } from "./components/HomeCourseModal";
import { HomeCoursePanel } from "./components/HomeCoursePanel";
import { HomeDuoPanel } from "./components/HomeDuoPanel";
import { HomeForgePanel } from "./components/HomeForgePanel";
import { HomeLibrarySection, type HomeLibraryItem } from "./components/HomeLibrarySection";
import { useActiveJobResume } from "./hooks/useActiveJobResume";
import { useHomeActiveCourse } from "./hooks/useHomeActiveCourse";
import { useHomeDashboardData } from "./hooks/useHomeDashboardData";
import { useHomeCourseActions } from "./hooks/useHomeCourseActions";
import { useCourseFiles } from "./hooks/useCourseFiles";
import type { CourseModalState } from "./types";

/* ═══════════════════ Page ═══════════════════ */

export default function HomePage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const name = useUserStore(selectUserName);
  const {
    currentCourse,
    setCurrentCourse,
    courses,
    setCourses,
    draftsByCourse,
    setDraftsByCourse,
    error,
    setError,
    isLoading,
  } = useHomeDashboardData(token);
  const { courseFiles, loadCourseFiles } = useCourseFiles(currentCourse?.id ?? null);
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
    currentCourse,
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
    courseModal,
    setCourseModal,
    handleFileAccepted,
    handleRemoveCourseFile,
    handleRenameCourse,
    handleDeleteCourse,
    handleTopicSubmit,
  } = useHomeCourseActions({
    currentCourse,
    setCurrentCourse,
    setCourses,
    setDraftsByCourse,
    setError,
    loadCourseFiles,
  });

  const openCourseModal = useCallback(
    (modal: NonNullable<CourseModalState>) => {
      setCourseModal(modal);
    },
    [setCourseModal]
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
    if (!currentCourse) {
      setTopic("");
      return;
    }
    setTopic(draftsByCourse[currentCourse.id]?.topic || "");
  }, [currentCourse, draftsByCourse]);

  const libraryItems = useMemo<HomeLibraryItem[]>(() => {
    const items: HomeLibraryItem[] = [];

    courses.forEach((course, index) => {
      const draft = draftsByCourse[course.id] || course.draft_json || {};
      const isReady = course.status === "ready";
      const hasQuestions = (draft.questions?.length || 0) > 0;
      const hasAnswers = Object.keys(draft.answers || {}).length > 0;

      if (!draft?.topic) return;

      items.push({
        kind: isReady ? "course" : "draft",
        key: `${isReady ? "course" : "draft"}-${course.id}`,
        course,
        href: isReady ? `/courses/${course.id}` : `/questionnaire?courseId=${course.id}`,
        title: isReady ? course.title : draft.topic,
        stateLabel: isReady
          ? "Course"
          : hasQuestions
            ? hasAnswers
              ? "Draft In Progress"
              : "Questionnaire Ready"
            : "Topic Draft",
        indexSeed: index,
      });
    });

    return items.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === "draft" ? -1 : 1;
      }
      return b.course.id - a.course.id;
    });
  }, [courses, draftsByCourse]);

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
            Refreshing your learning library...
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
          <HomeCoursePanel
            name={name}
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
            courseFiles={courseFiles}
            topic={topic}
            setIsDragging={setIsDragging}
            setTopic={setTopic}
            onFileChange={onFileChange}
            onDrop={onDrop}
            onTopicSubmit={() => handleTopicSubmit(topic)}
            onRemoveCourseFile={(file) => handleRemoveCourseFile(file)}
          />

          <HomeDuoPanel />
        </div>

        <HomeLibrarySection
          scrollRef={scrollRef}
          libraryItems={libraryItems}
          onScrollLibrary={scrollLibrary}
          onOpenCourseModal={openCourseModal}
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

      <HomeCourseModal
        courseModal={courseModal}
        setCourseModal={setCourseModal}
        onRename={handleRenameCourse}
        onDelete={handleDeleteCourse}
      />
    </div>
  );
}
