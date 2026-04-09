"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { COURSE_STATUS, type CourseStatus } from "@/lib/domain/statuses";
import { rememberPendingQuestionnaireNavigation } from "@/lib/navigation/intents";
import type { CourseListItem, DraftData } from "@/lib/apiTypes";
import type { CourseModalState } from "../types";

interface UseHomeCourseActionsParams {
  currentCourse: CourseListItem | null;
  setCurrentCourse: (course: CourseListItem | null) => void;
  setCourses: React.Dispatch<React.SetStateAction<CourseListItem[]>>;
  setDraftsByCourse: React.Dispatch<
    React.SetStateAction<Record<number, DraftData>>
  >;
  setError: React.Dispatch<React.SetStateAction<string>>;
  loadCourseFiles: (courseId: number) => Promise<void>;
}

export function useHomeCourseActions({
  currentCourse,
  setCurrentCourse,
  setCourses,
  setDraftsByCourse,
  setError,
  loadCourseFiles,
}: UseHomeCourseActionsParams) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isForging, setIsForging] = useState(false);
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);
  const [removingFile, setRemovingFile] = useState<string | null>(null);
  const [fileActionMessage, setFileActionMessage] = useState("");
  const [courseModal, setCourseModal] = useState<CourseModalState>(null);
  const [isDragging, setIsDragging] = useState(false);

  const rollbackCreatedCourse = useCallback(
    async (course: CourseListItem | null) => {
      if (!course) return;

      try {
        await apiFetch(`/courses/${course.id}`, {
          method: "DELETE",
        });
      } catch {
        // Ignore rollback failure. The primary action error will still be shown.
      }

      setCourses((prev) => prev.filter((item) => item.id !== course.id));
      setDraftsByCourse((prev) => {
        const next = { ...prev };
        delete next[course.id];
        return next;
      });
      if (currentCourse?.id === course.id) {
        setCurrentCourse(null);
      }
    },
    [
      setCourses,
      setCurrentCourse,
      setDraftsByCourse,
      currentCourse?.id,
    ]
  );

  const createDraftCourse = useCallback(
    async (name: string) => {
      const course = await apiFetch<CourseListItem>("/courses", {
        method: "POST",
        body: JSON.stringify({
          title: name,
          topic: name,
          status: COURSE_STATUS.DRAFT,
        }),
      });
      setCourses((prev) => [
        course,
        ...prev.filter((item) => item.id !== course.id),
      ]);
      setCurrentCourse(course);
      return course;
    },
    [setCourses, setCurrentCourse]
  );

  const handleFileAccepted = useCallback(
    async (file: File, setTopic: (value: string) => void) => {
      const inferredName = file.name.replace(/\.[^.]+$/, "") || "Imported Course";
      let createdCourse: CourseListItem | null = null;
      setError("");
      setIsForging(true);
      try {
        const course = await createDraftCourse(inferredName);
        createdCourse = course;

        const formData = new FormData();
        formData.append("file", file);
        await apiFetch(`/courses/upload-document?course_id=${course.id}`, {
          method: "POST",
          body: formData,
        });
        await loadCourseFiles(course.id);
        setFileActionMessage(`Added ${file.name}`);
        setTopic(inferredName || course.title);
      } catch (err) {
        await rollbackCreatedCourse(createdCourse);
        setError(
          err instanceof ApiError ? err.detail : "Course setup failed."
        );
      } finally {
        setIsForging(false);
      }
    },
    [createDraftCourse, loadCourseFiles, rollbackCreatedCourse, setError]
  );

  const handleRemoveCourseFile = useCallback(
    async (filename: string) => {
      if (!currentCourse) return;

      setRemovingFile(filename);
      setError("");
      setFileActionMessage("");
      try {
        await apiFetch(
          `/courses/${currentCourse.id}/files/${encodeURIComponent(filename)}`,
          { method: "DELETE" }
        );
        await loadCourseFiles(currentCourse.id);
        setFileActionMessage(`Removed ${filename}`);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.detail
            : "Failed to remove course material."
        );
      } finally {
        setRemovingFile(null);
      }
    },
    [currentCourse, loadCourseFiles, setError]
  );

  const handleRenameCourse = useCallback(async () => {
    if (!courseModal || courseModal.type !== "rename") return;

    const nextName = courseModal.draftName.trim();
    if (!nextName) {
      setCourseModal(null);
      return;
    }

    setCourseModal((prev: CourseModalState) =>
      prev && prev.type === "rename" ? { ...prev, submitting: true } : prev
    );
    setError("");

    try {
      if (courseModal.renameTarget === "course") {
        if (!courseModal.courseId) {
          throw new Error("Missing course id for rename.");
        }

        const updatedCourse = await apiFetch<{
          id?: number;
          courseTitle: string;
          topic?: string;
          status?: CourseStatus;
        }>(`/courses/${courseModal.courseId}`, {
          method: "PATCH",
          body: JSON.stringify({ title: nextName }),
        });

        setCourses((prev) =>
          prev.map((course) =>
            course.id === courseModal.courseId
              ? {
                  ...course,
                  title: updatedCourse.courseTitle,
                  topic: updatedCourse.topic ?? course.topic,
                  status: updatedCourse.status ?? course.status,
                }
              : course
          )
        );
      } else {
        const existingDraft = (courseModal.course.draft_json || {}) as DraftData;
        await apiFetch(`/courses/${courseModal.course.id}/draft`, {
          method: "PUT",
          body: JSON.stringify({
            draft: {
              ...existingDraft,
              topic: nextName,
              questions: existingDraft.questions || [],
              answers: existingDraft.answers || {},
              freeText: existingDraft.freeText || "",
            },
          }),
        });
        setDraftsByCourse((prev) => ({
          ...prev,
          [courseModal.course.id]: {
            ...(prev[courseModal.course.id] || {}),
            ...(existingDraft || {}),
            topic: nextName,
          },
        }));
        setCourses((prev) =>
          prev.map((course) =>
            course.id === courseModal.course.id
              ? { ...course, topic: nextName }
              : course
          )
        );
      }

      setCourseModal(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Failed to rename course."
      );
      setCourseModal((prev: CourseModalState) =>
        prev && prev.type === "rename" ? { ...prev, submitting: false } : prev
      );
    }
  }, [courseModal, setCourses, setDraftsByCourse, setError]);

  const handleDeleteCourse = useCallback(async () => {
    if (!courseModal || courseModal.type !== "delete") return;

    setCourseModal((prev: CourseModalState) =>
      prev && prev.type === "delete" ? { ...prev, submitting: true } : prev
    );
    setError("");

    try {
      await apiFetch(`/courses/${courseModal.course.id}`, {
        method: "DELETE",
      });

      setCourses((prev) => {
        const remainingCourses = prev.filter(
          (course) => course.id !== courseModal.course.id
        );
        if (currentCourse?.id === courseModal.course.id) {
          setCurrentCourse(remainingCourses[0] ?? null);
        }
        return remainingCourses;
      });

      setDraftsByCourse((prev) => {
        const next = { ...prev };
        delete next[courseModal.course.id];
        return next;
      });

      setCourseModal(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Failed to delete course."
      );
      setCourseModal((prev: CourseModalState) =>
        prev && prev.type === "delete" ? { ...prev, submitting: false } : prev
      );
    }
  }, [
    currentCourse?.id,
    courseModal,
    setCourses,
    setCurrentCourse,
    setDraftsByCourse,
    setError,
  ]);

  const handleTopicSubmit = useCallback(
    async (topic: string) => {
      const trimmedTopic = topic.trim();
      if (!trimmedTopic || isSubmittingTopic) return;
      let createdCourse: CourseListItem | null = null;

      setError("");
      setIsSubmittingTopic(true);
      try {
        const course = await createDraftCourse(trimmedTopic);
        createdCourse = course;

        await apiFetch(`/courses/${course.id}/draft`, {
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
        setDraftsByCourse((prev) => ({
          ...prev,
          [course.id]: {
            topic: trimmedTopic,
            questions: [],
            answers: {},
            freeText: "",
          },
        }));

        rememberPendingQuestionnaireNavigation(course.id, trimmedTopic);

        router.push(`/questionnaire?courseId=${course.id}`);
      } catch (err) {
        await rollbackCreatedCourse(createdCourse);
        setError(
          err instanceof ApiError ? err.detail : "Failed to start questionnaire."
        );
      } finally {
        setIsSubmittingTopic(false);
      }
    },
    [
      createDraftCourse,
      rollbackCreatedCourse,
      router,
      setDraftsByCourse,
      setError,
    ]
  );

  return {
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
  };
}
