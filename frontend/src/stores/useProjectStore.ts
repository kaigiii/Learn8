/**
 * 檔案名稱: stores/useProjectStore.ts
 * 功能描述: 全域專案狀態管理 (Global Project State Management)
 * 
 * 使用 Zustand 管理當前選中的專案 (Project)。
 * 專案是 RAG 與檔案管理的邊界，此狀態決定了 API 請求時要帶入哪個 project_id。
 * 
 * 狀態 (State):
 * - currentProject: 當前活躍的專案物件 ({ id, name, folder_name })。
 */

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
