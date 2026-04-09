"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, apiFetch } from "@/lib/apiClient";

interface ForgotPasswordResponse {
  message: string;
  reset_token?: string;
  reset_path?: string;
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordPageClient() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [devResetPath, setDevResetPath] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setDevResetPath(null);

    if (!validateEmail(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiFetch<ForgotPasswordResponse>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSuccess(result.message);
      setDevResetPath(result.reset_path ?? null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.detail : "Unable to request password reset."
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
          Forgot your password?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-gray-500">
          Enter your email and we will generate a secure password reset link if
          the account exists.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gray-500">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jane.doe@email.com"
              className="mt-2 w-full rounded-2xl border border-brand-gray-200 bg-brand-gray-50 px-4 py-3 text-sm text-brand-gray-700 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
            />
          </label>

          {error && <p className="text-sm text-rose-500">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-brand-teal px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Preparing reset..." : "Send Reset Link"}
          </button>
        </form>

        {devResetPath && (
          <div className="mt-5 rounded-2xl border border-brand-teal/20 bg-brand-teal/5 px-4 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
              Dev Reset Link
            </p>
            <p className="mt-2 text-xs leading-relaxed text-brand-gray-500">
              `AUTH_DEBUG_EXPOSE_RESET_TOKEN` is enabled, so the reset path is
              shown here for local testing.
            </p>
            <Link
              href={devResetPath}
              className="mt-3 inline-flex rounded-xl bg-white px-3 py-2 text-sm font-semibold text-brand-teal shadow-sm transition hover:bg-brand-gray-50"
            >
              Open Reset Page
            </Link>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/auth/login" className="font-semibold text-brand-teal hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
