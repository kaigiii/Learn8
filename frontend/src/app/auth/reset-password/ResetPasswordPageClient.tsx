"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/apiClient";

const PASSWORD_RULES = [
  "At least 8 characters",
  "One uppercase letter",
  "One lowercase letter",
  "One number",
  "One special character",
];

function validatePassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export default function ResetPasswordPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token.trim()) {
      setError("Reset token is required.");
      return;
    }
    if (!validatePassword(password)) {
      setError(
        "Use at least 8 characters, with uppercase, lowercase, a number, and a special character."
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiFetch<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: token.trim(),
          password,
        }),
      });
      setSuccess(result.message);
      setTimeout(() => {
        router.replace("/auth/login");
      }, 1200);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Unable to reset password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden app-shared-bg px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/88 p-8 shadow-[0_24px_60px_rgba(31,41,55,0.14)] backdrop-blur-xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal">
          Account Recovery
        </p>
        <h1 className="mt-3 font-heading text-3xl font-extrabold text-brand-gray-700">
          Set a new password
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-gray-500">
          Enter the reset token and choose a new password for your account.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray-500">
              Reset Token
            </span>
            <input
              type="text"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste your reset token"
              className="mt-2 w-full rounded-2xl border border-brand-gray-200 bg-brand-gray-50 px-4 py-3 text-sm text-brand-gray-700 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray-500">
              New Password
            </span>
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-2xl border border-brand-gray-200 bg-brand-gray-50 px-4 py-3 pr-12 text-sm text-brand-gray-700 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-3 text-xs font-semibold text-brand-gray-400 transition hover:text-brand-gray-600"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray-500">
              Confirm Password
            </span>
            <div className="relative mt-2">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full rounded-2xl border border-brand-gray-200 bg-brand-gray-50 px-4 py-3 pr-12 text-sm text-brand-gray-700 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute inset-y-0 right-3 text-xs font-semibold text-brand-gray-400 transition hover:text-brand-gray-600"
              >
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <div className="rounded-2xl border border-brand-teal/15 bg-brand-teal/5 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-teal">
              Password Requirements
            </p>
            <div className="mt-2 grid gap-1">
              {PASSWORD_RULES.map((rule) => (
                <p key={rule} className="text-xs text-brand-gray-500">
                  {rule}
                </p>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-rose-500">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-brand-teal px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/auth/login" className="font-semibold text-brand-teal hover:underline">
            Back to sign in
          </Link>
          <Link href="/auth/forgot-password" className="text-brand-gray-500 hover:text-brand-gray-700">
            Request another link
          </Link>
        </div>
      </div>
    </div>
  );
}
