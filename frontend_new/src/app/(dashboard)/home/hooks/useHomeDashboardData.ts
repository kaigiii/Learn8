"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/apiClient";
import type { CourseListItem, DraftData, Project, UserProfile } from "@/lib/apiTypes";
import { useAuthStore } from "@/stores/app/useAuthStore";
import { useProjectStore } from "@/stores/app/useProjectStore";
import useUserStore from "@/stores/app/useUserStore";

export function useHomeDashboardData(token: string | null) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const syncFromProfile = useUserStore((s) => s.syncFromProfile);

  const [projects, setProjects] = useState<Project[]>([]);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [draftsByProject, setDraftsByProject] = useState<Record<number, DraftData>>({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const currentProject =
    projects.find((project) => project.id === currentProjectId) ?? null;

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const [profile, projectData, courseData] = await Promise.all([
          apiFetch<UserProfile>("/auth/me"),
          apiFetch<Project[]>("/projects"),
          apiFetch<CourseListItem[]>("/courses"),
        ]);
        const draftsByProjectMap = Object.fromEntries(
          projectData.map((project) => [project.id, project.draft_json || {}])
        );

        updateUser(profile);
        syncFromProfile(profile);
        setProjects(projectData);
        setCourses(courseData);
        setDraftsByProject(draftsByProjectMap);
        const persistedProjectId = useProjectStore.getState().currentProjectId;
        const resolvedProject =
          projectData.find((project) => project.id === persistedProjectId) ??
          projectData[0] ??
          null;
        setCurrentProject(resolvedProject);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.detail : "Failed to load dashboard."
        );
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [token, updateUser, syncFromProfile, setCurrentProject]);

  return {
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
  };
}
