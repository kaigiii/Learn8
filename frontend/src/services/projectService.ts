/**
 * 檔案名稱: frontend/src/services/projectService.ts
 * 功能描述: 專案與檔案服務 (Project & File Service)
 * 
 * 此服務層負責處理所有與 "專案 (Project)" 及 "檔案 (File)" 相關的後端 API 呼叫。
 * 它是前端 UI 與 `/api/v1/projects` Endpoints 之間的橋樑。
 * 
 * 主要功能:
 *     1. uploadFiles (大量檔案上傳)
 *         - 封裝了多檔案上傳的邏輯。
 *         - 由於後端 API 設計為單檔上傳 (`/upload-pdf`)，前端需透過迴圈 (Loop) 逐一發送請求。
 *         - 提供 `onProgress` 回調函式，讓 UI (如 Dashboard) 能即時顯示 "Ingesting file X..." 的進度。
 * 
 *     2. getFiles (檔案列表)
 *         - 取得特定專案已上傳的檔案清單。
 * 
 * 教學筆記 (Code Translation):
 *     - `const formData = new FormData();`: 建立 Multipart Form 資料，模擬 HTML 表單上傳行為。
 *     - `formData.append('file', file);`: 將二進位檔案加入表單。
 *     - `apiClient.post(..., { headers: { 'Content-Type': 'multipart/form-data' } })`:
 *       明確告知後端這是一個檔案上傳請求，而非一般的 JSON。
 */
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
