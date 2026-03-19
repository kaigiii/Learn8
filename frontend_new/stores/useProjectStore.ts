import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project } from "@/lib/types";

interface ProjectState {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProject: null,
      setCurrentProject: (project) => set({ currentProject: project }),
    }),
    {
      name: "learn8-project",
    }
  )
);
