import { apiClient } from '@/lib/api-client';

export const projectService = {
    /**
     * Upload multiple files to a project
     * @param projectId Project ID in string or number format
     * @param files Array of File objects to upload
     * @param onProgress Optional callback for progress updates (e.g. "Ingesting file 1...")
     * @returns Promise resolving to the number of successfully uploaded files
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

    /**
     * Fetch files for a project
     */
    getFiles: async (projectId: number | string) => {
        const res = await apiClient.get(`/projects/${projectId}/files`);
        return res.data;
    }
};
