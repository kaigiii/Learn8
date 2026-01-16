/**
 * 檔案名稱: stores/useAuthStore.ts
 * 功能描述: 全域認證狀態管理 (Global Auth State Management)
 * 
 * 使用 Zustand 實作的狀態管理庫，並透過 `persist` 中介軟體將狀態同步至 LocalStorage。
 * 
 * 狀態 (State):
 * - token: JWT Access Token。
 * - user: 當前登入的使用者資訊 ({ email })。
 * 
 * 動作 (Actions):
 * - login: 設定 token 與 user 並寫入儲存。
 * - logout: 清除所有認證資訊。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    email: string;
}

interface AuthState {
    token: string | null;
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            login: (token, user) => set({ token, user }),
            logout: () => set({ token: null, user: null }),
        }),
        {
            name: 'auth-storage',
        }
    )
);
