
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
            login(res.data.access_token, { email });
            router.push("/"); // Redirect to Dashboard
        } catch (err: any) {
            setError(err.response?.data?.detail || "Login failed");
        }
    };

    const handleDevLogin = async () => {
        try {
            const res = await apiClient.post("/auth/dev-login");
            login(res.data.access_token, { email: "dev@learna.ai" });
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
