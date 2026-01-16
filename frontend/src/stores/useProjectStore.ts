
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Project {
    id: number;
    name: string;
    folder_name?: string;
}

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
            name: 'project-storage',
        }
    )
);
