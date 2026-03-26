"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { Project } from "@/lib/apiTypes";

export function useProjectFiles(currentProject: Project | null) {
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
    if (!currentProject) {
      setProjectFiles([]);
      return;
    }
    void loadProjectFiles(currentProject.id);
  }, [currentProject, loadProjectFiles]);

  return {
    projectFiles,
    setProjectFiles,
    loadProjectFiles,
  };
}
