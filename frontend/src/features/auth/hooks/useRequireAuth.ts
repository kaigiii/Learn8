/**
 * 檔案名稱: features/auth/hooks/useRequireAuth.ts
 * 功能描述: 認證保護 Hook (Authentication Guard Hook)
 * 
 * 用於保護需要登入才能訪問的頁面或組件。
 * 
 * 邏輯:
 * 1. 檢查 `useAuthStore` 中的 token。
 * 2. 若 token 不存在，自動導向至 `/login`。
 * 3. 回傳 `isAuthenticated` 狀態與當前使用者資訊。
 * 
 * 使用方式:
 * const { isAuthenticated } = useRequireAuth();
 * if (!isAuthenticated) return null;
 */

import { useAuthStore } from "@/stores/useAuthStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRequireAuth() {
    const { token, user } = useAuthStore();
    const router = useRouter();

    useEffect(() => {
        if (!token) {
            router.push("/login");
        }
    }, [token, router]);

    return { user, isAuthenticated: !!token };
}
