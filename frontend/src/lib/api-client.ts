/**
 * 檔案名稱: lib/api-client.ts
 * 功能描述: 全域 API 客戶端 (Global API Client)
 * 
 * 基於 Axios 封裝的 HTTP 客戶端，負責與後端 API 進行通訊。
 * 
 * 主要功能:
 * 1. Base URL 設定: 自動根據環境變數 `NEXT_PUBLIC_API_URL` 或預設值設定 API 根路徑。
 * 2. Request Interceptor: 自動在每個請求的 Header 中附加 `Authorization: Bearer {token}`。
 * 3. Response Interceptor: 統一處理 401 Unauthorized 錯誤 (自動登出並導向登入頁)。
 * 
 * 使用方式:
 * import { apiClient } from '@/lib/api-client';
 * const res = await apiClient.get('/courses');
 */

import axios from 'axios';
import { useAuthStore } from '@/stores/useAuthStore';

// Access env var or default
const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use((config) => {
    // We can't use hooks here directly, need to access store outside hook or pass token
    // Zustand store access outside components:
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Auto logout
            useAuthStore.getState().logout();
            // Optional: Redirect to login
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);
