
/**
 * 檔案名稱: features/auth/components/LoginForm.tsx
 * 功能描述: 登入表單 (Login Component)
 * 
 * 提供使用者輸入 Email/Password 進行登入的介面，以及 "Dev Login" 快速通道。
 * 
 * 互動流程:
 * 1. 提交表單 -> 呼叫 `POST /auth/login`。
 * 2. 成功 -> 更新 `useAuthStore` 狀態 -> 導向 `/` (Dashboard)。
 * 3. 失敗 -> 顯示錯誤訊息。
 * 
 * 特殊功能:
 * - Dev Login: 方便開發者一鍵登入 (模擬帳號 dev@learna.ai)。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link';

export function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const login = useAuthStore((state) => state.login);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        try {
            // Direct call to API
            const res = await apiClient.post("/auth/login", { email, password });
            const token = res.data.access_token;

            // Fetch full user profile
            const userRes = await apiClient.get('/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            });

            login(token, userRes.data);
            router.push("/"); // Redirect to Dashboard
        } catch (err: any) {
            setError(err.response?.data?.detail || "Login failed");
        }
    };

    const handleDevLogin = async () => {
        try {
            const res = await apiClient.post("/auth/dev-login");
            const token = res.data.access_token;

            // Fetch full user profile
            const userRes = await apiClient.get('/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            });

            login(token, userRes.data);
            router.push("/");
        } catch (err: any) {
            setError("Dev login failed");
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Login to Learna</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                        <Button type="submit" className="w-full">Login</Button>
                    </form>
                    <div className="mt-4 text-center text-sm">
                        Don't have an account? <Link href="/register" className="text-blue-600 hover:underline">Create Account</Link>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                        <Button variant="outline" className="w-full" onClick={handleDevLogin}>
                            ⚡ Dev Login (Auto)
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
