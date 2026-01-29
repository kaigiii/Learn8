/**
 * 檔案名稱: frontend/src/features/dashboard/api/projectService.ts
 * 功能描述: 專案與檔案服務 (Project & File Service)
 */
import { apiClient } from '@/lib/api-client';

export interface Question {
    id: string;
    text: string;
    type: string;
    options?: string[];
}

export interface DraftData {
    topic?: string;
    questions?: Question[];
    answers?: Record<string, string>;
    freeText?: string;
}

export const projectService = {
    // --- Files ---
    /**
     * Upload multiple files to a project
     */
    uploadFiles: async (
        projectId: number | string,
        files: File[],
        onProgress?: (msg: string) => void
    ): Promise<number> => {
        let successCount = 0;
        for (const file of files) {
            if (onProgress) onProgress(`Ingesting ${file.name}...`);

            const formData = new FormData();
            formData.append('file', file);

            await apiClient.post(`/projects/upload-pdf?project_id=${projectId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            successCount++;
        }
        return successCount;
    },

    getFiles: async (projectId: number | string) => {
        const res = await apiClient.get(`/projects/${projectId}/files`);
        return res.data;
    },

    // --- Drafts ---
    getDraft: async (projectId: number | string) => {
        const res = await apiClient.get(`/projects/${projectId}/draft`);
        return res.data.draft || {};
    },

    updateDraft: async (projectId: number | string, draft: DraftData) => {
        return apiClient.put(`/projects/${projectId}/draft`, { draft });
    },

    // --- Questionnaire ---
    generateQuestionnaire: async (projectId: number | string, topic: string) => {
        const res = await apiClient.post<Question[]>(`/projects/${projectId}/questionnaire`, null, {
            params: { topic },
        });
        return res.data;
    },

    submitQuestionnaire: async (
        projectId: number | string,
        submission: { responses: { question_id: string; answer: string }[] },
        topic: string,
        questions: Question[]
    ) => {
        const res = await apiClient.post(`/projects/${projectId}/questionnaire/submit`, {
            submission,
            topic,
            questions,
        });
        return res.data;
    },

    // --- Course Generation ---
    generateSyllabus: async (projectId: number | string, topic: string) => {
        // GET or POST? Dashboard.tsx used POST /courses/generate-syllabus
        const generateUrl = `/courses/generate-syllabus?topic=${encodeURIComponent(topic)}&project_id=${projectId}`;
        const res = await apiClient.post(generateUrl);
        return res.data;
    }
};
