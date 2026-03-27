"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";
import type { CourseListItem, CoursePath, DraftData, Project } from "@/lib/apiTypes";
import type { ProjectModalState } from "../types";

interface UseHomeProjectActionsParams {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setCourses: React.Dispatch<React.SetStateAction<CourseListItem[]>>;
  setDraftsByProject: React.Dispatch<
    React.SetStateAction<Record<number, DraftData>>
  >;
  setError: React.Dispatch<React.SetStateAction<string>>;
  loadProjectFiles: (projectId: number) => Promise<void>;
}

export function useHomeProjectActions({
  currentProject,
  setCurrentProject,
  projects,
  setProjects,
  setCourses,
  setDraftsByProject,
  setError,
  loadProjectFiles,
}: UseHomeProjectActionsParams) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isForging, setIsForging] = useState(false);
  const [isSubmittingTopic, setIsSubmittingTopic] = useState(false);
  const [removingFile, setRemovingFile] = useState<string | null>(null);
  const [fileActionMessage, setFileActionMessage] = useState("");
  const [projectModal, setProjectModal] = useState<ProjectModalState>(null);
  const [isDragging, setIsDragging] = useState(false);

  const createProject = useCallback(
    async (name: string) => {
      const project = await apiFetch<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setProjects((prev) => [
        project,
        ...prev.filter((item) => item.id !== project.id),
      ]);
      setCurrentProject(project);
      return project;
    },
    [setCurrentProject, setProjects]
  );

  const resolveProjectForNewJourney = useCallback(
    async (name: string) => createProject(name),
    [createProject]
  );

  const handleFileAccepted = useCallback(
    async (file: File, setTopic: (value: string) => void) => {
      const inferredName = file.name.replace(/\.[^.]+$/, "") || "Imported Project";
      setError("");
      setIsForging(true);
      try {
        const project = await resolveProjectForNewJourney(inferredName);

        const formData = new FormData();
        formData.append("file", file);
        await apiFetch(`/projects/upload-document?project_id=${project.id}`, {
          method: "POST",
          body: formData,
        });
        await loadProjectFiles(project.id);
        setFileActionMessage(`Added ${file.name}`);
        setTopic(inferredName || project.name);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Forge setup failed.");
      } finally {
        setIsForging(false);
      }
    },
    [loadProjectFiles, resolveProjectForNewJourney, setError]
  );

  const handleRemoveProjectFile = useCallback(
    async (filename: string) => {
      if (!currentProject) return;

      setRemovingFile(filename);
      setError("");
      setFileActionMessage("");
      try {
        await apiFetch(
          `/projects/${currentProject.id}/files/${encodeURIComponent(filename)}`,
          { method: "DELETE" }
        );
        await loadProjectFiles(currentProject.id);
        setFileActionMessage(`Removed ${filename}`);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.detail : "Failed to remove project file."
        );
      } finally {
        setRemovingFile(null);
      }
    },
    [currentProject, loadProjectFiles, setError]
  );

  const handleRenameProject = useCallback(async () => {
    if (!projectModal || projectModal.type !== "rename") return;

    const nextName = projectModal.draftName.trim();
    if (!nextName || nextName === projectModal.project.name) {
      setProjectModal(null);
      return;
    }

    setProjectModal((prev) =>
      prev && prev.type === "rename" ? { ...prev, submitting: true } : prev
    );
    setError("");

    try {
      const updated = await apiFetch<Project>(`/projects/${projectModal.project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: nextName }),
      });

      setProjects((prev) =>
        prev.map((project) =>
          project.id === updated.id ? { ...project, name: updated.name } : project
        )
      );

      if (currentProject?.id === updated.id) {
        setCurrentProject(updated);
      }

      setProjectModal(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to rename project.");
      setProjectModal((prev) =>
        prev && prev.type === "rename" ? { ...prev, submitting: false } : prev
      );
    }
  }, [currentProject?.id, projectModal, setCurrentProject, setError, setProjects]);

  const handleDeleteProject = useCallback(async () => {
    if (!projectModal || projectModal.type !== "delete") return;

    setProjectModal((prev) =>
      prev && prev.type === "delete" ? { ...prev, submitting: true } : prev
    );
    setError("");

    try {
      await apiFetch(`/projects/${projectModal.project.id}`, {
        method: "DELETE",
      });

      const remainingProjects = projects.filter(
        (project) => project.id !== projectModal.project.id
      );
      setProjects(remainingProjects);

      if (currentProject?.id === projectModal.project.id) {
        setCurrentProject(remainingProjects[0] ?? null);
      }

      setCourses((prev) =>
        prev.filter((course) => course.project_id !== projectModal.project.id)
      );
      setDraftsByProject((prev) => {
        const next = { ...prev };
        delete next[projectModal.project.id];
        return next;
      });

      setProjectModal(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Failed to delete project.");
      setProjectModal((prev) =>
        prev && prev.type === "delete" ? { ...prev, submitting: false } : prev
      );
    }
  }, [
    currentProject?.id,
    projectModal,
    projects,
    setCourses,
    setCurrentProject,
    setDraftsByProject,
    setError,
    setProjects,
  ]);

  const handleTopicSubmit = useCallback(
    async (topic: string) => {
      const trimmedTopic = topic.trim();
      if (!trimmedTopic) return;

      setError("");
      setIsSubmittingTopic(true);
      try {
        const project = await resolveProjectForNewJourney(trimmedTopic);

        await apiFetch(`/projects/${project.id}/draft`, {
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
        setDraftsByProject((prev) => ({
          ...prev,
          [project.id]: {
            topic: trimmedTopic,
            questions: [],
            answers: {},
            freeText: "",
          },
        }));

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            "learn8_pending_questionnaire",
            JSON.stringify({
              projectId: project.id,
              topic: trimmedTopic,
            })
          );
        }

        router.push("/questionnaire");
      } catch (err) {
        setError(
          err instanceof ApiError ? err.detail : "Failed to start questionnaire."
        );
      } finally {
        setIsSubmittingTopic(false);
      }
    },
    [resolveProjectForNewJourney, router, setDraftsByProject, setError]
  );

  return {
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
  };
}
