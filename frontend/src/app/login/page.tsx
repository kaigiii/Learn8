/**
 * 檔案名稱: app/login/page.tsx
 * 功能描述: 登入頁面路由 (Login Page Route)
 * 
 * 對應 `/login` 路徑。
 * 純粹的頁面容器，負責渲染 `LoginForm` 組件。
 */

import { LoginForm } from "@/features/auth/components/LoginForm";

export default function LoginPage() {
    return <LoginForm />;
}
