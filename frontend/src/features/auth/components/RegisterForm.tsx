
/**
 * 檔案名稱: features/auth/components/RegisterForm.tsx
 * 功能描述: 註冊表單 (Register Component)
 * 
 * 提供使用者註冊新帳戶的介面。
 * 
 * 互動流程:
 * 1. 提交表單 -> 呼叫 `POST /auth/register`。
 * 2. 成功 -> 導向 `/login` 或直接登入。
 * 3. 失敗 -> 顯示錯誤訊息。
 */
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authService } from "../api/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from 'next/link';
import { Mail, Lock, User, Phone, Check, AlertCircle, Chrome } from "lucide-react";
import { motion } from "framer-motion";

export function RegisterForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");

    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Password Strength
    const [passStrength, setPassStrength] = useState({
        length: false,
        hasUpper: false,
        hasLower: false,
        hasNumber: false
    });

    const router = useRouter();

    useEffect(() => {
        setPassStrength({
            length: password.length >= 8,
            hasUpper: /[A-Z]/.test(password),
            hasLower: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
        });
    }, [password]);

    const isPasswordValid = Object.values(passStrength).every(Boolean);
    const passwordsMatch = password === confirmPassword && password !== "";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!isPasswordValid) {
            setError("Password does not meet requirements.");
            return;
        }

        if (!passwordsMatch) {
            setError("Passwords do not match.");
            return;
        }

        setIsLoading(true);

        try {
            await authService.register({
                email,
                password,
                full_name: fullName,
                phone_number: phoneNumber
            });
            setSuccess(true);
            setTimeout(() => {
                router.push('/login');
            }, 1500);
        } catch (err: any) {
            setError(err.request?.response ? JSON.parse(err.request.response).detail : "Registration failed");
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        // Placeholder for Google OAuth
        alert("Google Login connection needs to be configured in Cloud Console.");
    };

    if (success) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center space-y-4"
                >
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                        <Check className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">Welcome to Learn8!</h2>
                    <p className="text-slate-600">Your account has been created successfully.</p>
                    <p className="text-sm text-slate-400">Redirecting to login...</p>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => router.push('/login')}>
                        Go to Login
                    </Button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-50 items-center justify-center p-4">
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
            >
                <div className="bg-blue-600 p-8 text-center text-white">
                    <h1 className="text-3xl font-bold mb-2">Create Account</h1>
                    <p className="opacity-90">Join thousands of learners today</p>
                </div>

                <div className="p-8 space-y-6">
                    {/* Google Login */}
                    <Button variant="outline" className="w-full py-6 flex items-center gap-3 text-slate-700 font-medium hover:bg-slate-50" onClick={handleGoogleLogin}>
                        <Chrome className="w-5 h-5 text-red-500" />
                        Sign up with Google
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-2 text-slate-400">Or continue with email</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-600 uppercase">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="John Doe"
                                        className="pl-9"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-600 uppercase">Phone</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="+1 234..."
                                        className="pl-9"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600 uppercase">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    type="email"
                                    placeholder="you@example.com"
                                    required
                                    className="pl-9"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600 uppercase">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    className="pl-9"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            {/* Password Strength Meter */}
                            {password && (
                                <div className="text-xs flex flex-wrap gap-2 pt-1">
                                    <span className={passStrength.length ? "text-green-600 flex items-center" : "text-slate-400"}>
                                        {passStrength.length ? <Check className="w-3 h-3 mr-1" /> : <div className="w-3 h-3 border border-slate-300 rounded-full mr-1" />} 8+ chars
                                    </span>
                                    <span className={passStrength.hasUpper ? "text-green-600 flex items-center" : "text-slate-400"}>
                                        {passStrength.hasUpper ? <Check className="w-3 h-3 mr-1" /> : <div className="w-3 h-3 border border-slate-300 rounded-full mr-1" />} Uppercase
                                    </span>
                                    <span className={passStrength.hasLower ? "text-green-600 flex items-center" : "text-slate-400"}>
                                        {passStrength.hasLower ? <Check className="w-3 h-3 mr-1" /> : <div className="w-3 h-3 border border-slate-300 rounded-full mr-1" />} Lowercase
                                    </span>
                                    <span className={passStrength.hasNumber ? "text-green-600 flex items-center" : "text-slate-400"}>
                                        {passStrength.hasNumber ? <Check className="w-3 h-3 mr-1" /> : <div className="w-3 h-3 border border-slate-300 rounded-full mr-1" />} Number
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600 uppercase">Confirm Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    className={`pl-9 ${confirmPassword && !passwordsMatch ? "border-red-300 focus-visible:ring-red-500" : ""}`}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                            {confirmPassword && !passwordsMatch && (
                                <p className="text-xs text-red-500 flex items-center mt-1">
                                    <AlertCircle className="w-3 h-3 mr-1" /> Passwords do not match
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 py-6 text-lg shadow-lg shadow-blue-200" disabled={isLoading}>
                            {isLoading ? "Creating Account..." : "Create Account"}
                        </Button>
                    </form>

                    <div className="text-center text-sm text-slate-500">
                        Already have an account? <Link href="/login" className="text-blue-600 font-semibold hover:underline">Log in</Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
