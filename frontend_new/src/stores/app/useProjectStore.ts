import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project } from "@/lib/apiTypes";

interface ProjectState {
  currentProjectId: number | null;
  setCurrentProject: (project: Project | null) => void;
  setCurrentProjectId: (projectId: number | null) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      setCurrentProject: (project) =>
        set({ currentProjectId: project?.id ?? null }),
      setCurrentProjectId: (projectId) => set({ currentProjectId: projectId }),
    }),
    {
      name: "learn8-project",
    }
  )
);
