"use client";

import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import TopStatsBar from "@/components/layout/TopStatsBar";
import { fetchPublicCourses } from "@/lib/courses/api";
import { COURSE_STATUS } from "@/lib/domain/statuses";
import {
  clearRecentCourseNavigation,
  getRecentCourseNavigation,
} from "@/lib/navigation/intents";
import { useAuthStore } from "@/stores/app/useAuthStore";
import useUserStore, { selectUserName } from "@/stores/app/useUserStore";
import { HomeBackground } from "./components/HomeBackground";
import { HomeCourseModal } from "./components/HomeCourseModal";
import { HomeCoursePanel } from "./components/HomeCoursePanel";
import { HomePublicTopicsSection } from "./components/HomePublicTopicsSection";
import { HomeForgePanel } from "./components/HomeForgePanel";
import { HomeLibrarySection, type HomeLibraryItem } from "./components/HomeLibrarySection";
import { useActiveJobResume } from "./hooks/useActiveJobResume";
import { useHomeActiveCourse } from "./hooks/useHomeActiveCourse";
import { useHomeDashboardData } from "./hooks/useHomeDashboardData";
import { useHomeCourseActions } from "./hooks/useHomeCourseActions";
import { useCourseFiles } from "./hooks/useCourseFiles";
import type { CourseModalState } from "./types";
import type { CourseListItem } from "@/lib/apiTypes";

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
  const [publicCourses, setPublicCourses] = useState<CourseListItem[]>([]);
  const [homeContentTab, setHomeContentTab] = useState<"library" | "public">("library");
  const {
    fileInputRef,
    fileActionMessage,
    isDragging,
    setIsDragging,
    isForging,
    isSubmittingTopic,
    removingFile,
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
    if (!token) {
      return;
    }

    let cancelled = false;
    void fetchPublicCourses()
      .then((items) => {
        if (!cancelled) {
          setPublicCourses(items);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [token]);

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
      const isReady = course.status === COURSE_STATUS.READY;
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

  const resumeLibraryIndex = useMemo(() => {
    if (!activeCourseId) {
      return -1;
    }

    const numericActiveCourseId = Number(activeCourseId);
    if (!Number.isFinite(numericActiveCourseId)) {
      return -1;
    }

    return libraryItems.findIndex(
      (item) => item.kind === "course" && item.course.id === numericActiveCourseId
    );
  }, [activeCourseId, libraryItems]);

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
    <div className="relative overflow-hidden">
      <TopStatsBar
        mascotSrc="/icons/icon.ico"
        mascotAlt="Home mascot"
        mascotImageClassName="scale-110"
        quickLinks={[
          {
            href: "/multiplayer",
            label: "Multiplayer",
            iconSrc: "/svg/multiplayer-controller.svg",
            iconAlt: "Multiplayer",
          },
          {
            href: "/arena/leaderboard",
            label: "Leaderboard",
            iconSrc: "/svg/leaderboard-logo.svg",
            iconAlt: "Leaderboard",
          },
        ]}
      />

      <HomeBackground />

      <div className="relative z-10 mx-auto max-w-[86rem] space-y-10 px-3 py-10 md:px-6">
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

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          <HomeCoursePanel
            name={name}
            hasResumeCourse={hasResumeCourse}
            activeCourseId={activeCourseId}
            activeCourseNumericId={activeCourse?.id ?? null}
            resumeLibraryIndex={resumeLibraryIndex}
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
            onTopicSubmit={async () => {
              await handleTopicSubmit(topic);
              setTopic("");
            }}
            onRemoveCourseFile={(file) => handleRemoveCourseFile(file)}
            activeJob={activeJob}
            onCancelActiveJob={() => cancelActiveJob()}
            onRetryActiveJob={() => retryActiveJob()}
          />
        </div>

        {homeContentTab === "public" ? (
          <HomePublicTopicsSection
            courses={publicCourses}
            activeTab={homeContentTab}
            onTabChange={setHomeContentTab}
          />
        ) : (
          <HomeLibrarySection
            scrollRef={scrollRef}
            libraryItems={libraryItems}
            onScrollLibrary={scrollLibrary}
            onOpenCourseModal={openCourseModal}
            activeTab={homeContentTab}
            onTabChange={setHomeContentTab}
          />
        )}
      </div>

      <HomeCourseModal
        courseModal={courseModal}
        setCourseModal={setCourseModal}
        onRename={handleRenameCourse}
        onDelete={handleDeleteCourse}
      />
    </div>
  );
}
