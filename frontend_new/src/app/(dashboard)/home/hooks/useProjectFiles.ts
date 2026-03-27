"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

export function useProjectFiles(currentProjectId: number | null) {
  const [projectFiles, setProjectFiles] = useState<string[]>([]);

  const loadProjectFiles = useCallback(async (projectId: number) => {
    try {
      const files = await apiFetch<string[]>(`/projects/${projectId}/files`);
      setProjectFiles(files);
    } catch {
      setProjectFiles([]);
    }
  }, []);

  useEffect(() => {
    if (!currentProjectId) {
      setProjectFiles([]);
      return;
    }
    void loadProjectFiles(currentProjectId);
  }, [currentProjectId, loadProjectFiles]);

  return {
    projectFiles,
    setProjectFiles,
    loadProjectFiles,
  };
}
