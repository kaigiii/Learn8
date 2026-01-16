/**
 * 檔案名稱: lib/auth.ts
 * 功能描述: 認證輔助函式庫 (Authentication Helpers)
 * 
 * 提供處理 LocalStorage Token 存取與基本登入邏輯的純函式 (Pure Functions)。
 * 
 * 主要功能:
 * - getToken / setToken / removeToken: 管理瀏覽器端的 JWT 儲存。
 * - devLogin: 開發環境專用的快速登入函式 (繞過密碼驗證)。
 */
export const AUTH_TOKEN_KEY = "learna_auth_token";

export function getToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setToken(token: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function removeToken() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function isAuthenticated() {
    return !!getToken();
}

export async function devLogin() {
    try {
        const res = await fetch("http://localhost:8001/auth/dev-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        if (res.ok) {
            const data = await res.json();
            setToken(data.access_token);
            return true;
        }
    } catch (e) {
        console.error("Dev login failed", e);
    }
    return false;
}
