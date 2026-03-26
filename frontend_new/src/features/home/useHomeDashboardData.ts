"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/apiClient";
import type { CourseListItem, DraftData, Project, UserProfile } from "@/lib/apiTypes";
import { useAuthStore } from "@/stores/useAuthStore";
import { useProjectStore } from "@/stores/useProjectStore";
import useUserStore from "@/stores/useUserStore";

export function useHomeDashboardData(token: string | null) {
  const updateUser = useAuthStore((s) => s.updateUser);
  const currentProject = useProjectStore((s) => s.currentProject);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const syncFromProfile = useUserStore((s) => s.syncFromProfile);

  const [projects, setProjects] = useState<Project[]>([]);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [draftsByProject, setDraftsByProject] = useState<Record<number, DraftData>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        const [profile, projectData, courseData] = await Promise.all([
          apiFetch<UserProfile>("/auth/me"),
          apiFetch<Project[]>("/projects"),
          apiFetch<CourseListItem[]>("/courses"),
        ]);
        const draftEntries = await Promise.all(
          projectData.map(async (project) => {
            try {
              const response = await apiFetch<{ draft?: DraftData }>(
                `/projects/${project.id}/draft`
              );
              return [project.id, response.draft || {}] as const;
            } catch {
              return [project.id, {}] as const;
            }
          })
        );

        updateUser(profile);
        syncFromProfile(profile);
        setProjects(projectData);
        setCourses(courseData);
        setDraftsByProject(Object.fromEntries(draftEntries));
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
  };
}
