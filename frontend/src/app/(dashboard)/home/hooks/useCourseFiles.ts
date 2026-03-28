"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
export function useCourseFiles(currentCourseId: number | null) {
  const [courseFiles, setCourseFiles] = useState<string[]>([]);

  const loadCourseFiles = useCallback(async (courseId: number) => {
    try {
      const files = await apiFetch<string[]>(`/courses/${courseId}/files`);
      setCourseFiles(files);
    } catch {
      setCourseFiles([]);
    }
  }, []);

  useEffect(() => {
    if (!currentCourseId) {
      setCourseFiles([]);
      return;
    }
    void loadCourseFiles(currentCourseId);
  }, [currentCourseId, loadCourseFiles]);

  return {
    courseFiles,
    setCourseFiles,
    loadCourseFiles,
  };
}
