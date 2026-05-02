"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook, FaApple } from "react-icons/fa";
import { ApiError, apiFetch } from "@/lib/apiClient";
import type { AuthTokenResponse, UserProfile } from "@/lib/apiTypes";
import { establishAuthenticatedSession } from "@/lib/auth/profileSync";
import { isProfileOnboardingComplete } from "@/lib/auth/onboarding";
import { resolvePreferredAuthenticatedHref } from "@/lib/navigation/intents";
import { useAuthStore } from "@/stores/app/useAuthStore";

type AuthTab = "signup" | "login";
type AuthFieldErrors = Partial<
  Record<"email" | "password" | "confirmPassword", string>
>;

const PASSWORD_RULES = [
  "At least 8 characters",
  "One uppercase letter",
  "One lowercase letter",
  "One number",
  "One special character",
];

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export default function LoginPageClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AuthTab>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = useAuthStore((s) => s.token);
  const authUser = useAuthStore((s) => s.user);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  useEffect(() => {
    if (!authHydrated) return;
    if (token) {
      router.replace(
        isProfileOnboardingComplete(authUser)
          ? resolvePreferredAuthenticatedHref("/home")
          : "/auth/welcome"
      );
    }
  }, [authHydrated, authUser, router, token]);

  useEffect(() => {
    setError("");
    setFieldErrors({});
  }, [activeTab]);

  const validateAuthForm = (): boolean => {
    const nextErrors: AuthFieldErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!validateEmail(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (activeTab === "signup" && !validatePassword(password)) {
      nextErrors.password =
        "Use at least 8 characters, with uppercase, lowercase, a number, and a special character.";
    }

    if (activeTab === "signup") {
      if (!confirmPassword) {
        nextErrors.confirmPassword = "Please confirm your password.";
      } else if (password !== confirmPassword) {
        nextErrors.confirmPassword = "Passwords do not match.";
      }
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateAuthForm()) return;
    setIsSubmitting(true);

    try {
      if (activeTab === "signup") {
        await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        });
      }

      const tokenRes = await apiFetch<AuthTokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      setSession(tokenRes.access_token, null);
      const profile = await apiFetch<UserProfile>("/auth/me");
      establishAuthenticatedSession(tokenRes.access_token, profile);

      router.replace(
        !isProfileOnboardingComplete(profile)
          ? "/auth/welcome"
          : resolvePreferredAuthenticatedHref("/home")
      );
    } catch (err) {
      clearSession();
      setError(
        err instanceof ApiError ? err.detail : "Unable to connect to the server."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestLogin = async () => {
    setError("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const randHex = Math.random().toString(36).substring(2, 8);
      const guestEmail = `guest_${randHex}@guest.learn8.ai`;
      const guestPassword = `Guest!${randHex}${Math.floor(100 + Math.random() * 900)}`;

      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: guestEmail,
          password: guestPassword,
        }),
      });

      const tokenRes = await apiFetch<AuthTokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: guestEmail,
          password: guestPassword,
        }),
      });

      setSession(tokenRes.access_token, null);
      const profile = await apiFetch<UserProfile>("/auth/me");
      establishAuthenticatedSession(tokenRes.access_token, profile);

      router.replace(
        !isProfileOnboardingComplete(profile)
          ? "/auth/welcome"
          : resolvePreferredAuthenticatedHref("/home")
      );
    } catch (err) {
      clearSession();
      setError(
        err instanceof ApiError ? err.detail : "Unable to connect to the server."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDevLogin = async () => {
    setError("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const tokenRes = await apiFetch<AuthTokenResponse>("/auth/dev-login", {
        method: "POST",
      });

      setSession(tokenRes.access_token, null);
      const profile = await apiFetch<UserProfile>("/auth/me");
      establishAuthenticatedSession(tokenRes.access_token, profile);

      router.replace(
        isProfileOnboardingComplete(profile)
          ? resolvePreferredAuthenticatedHref("/home")
          : "/auth/welcome"
      );
    } catch (err) {
      clearSession();
      setError(
        err instanceof ApiError ? err.detail : "Unable to connect to the server."
      );
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#d9ecf6] bg-[url('/backgrounds/LogInBg.png')] bg-cover bg-center bg-no-repeat">

      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-wrap items-center justify-center gap-8 px-4 py-10 lg:flex-nowrap lg:justify-between lg:gap-20 lg:px-10">
        <section className="flex w-full max-w-xl flex-col items-start shrink-0 lg:max-w-[760px]">
          <div className="mb-8 flex items-center gap-5">
            <div className="h-20 w-20 overflow-hidden rounded-full shadow-md">
              <Image
                src="/icons/icon.ico"
                alt="Learn8 icon"
                width={80}
                height={80}
                priority
                className="h-full w-full object-cover"
              />
            </div>
            <Image
              src="/icons/logs.png"
              alt="Learn8"
              width={360}
              height={144}
              priority
              className="h-20 w-auto object-contain drop-shadow-[0_2px_8px_rgba(52,144,220,0.28)]"
            />
          </div>

          <h1 className="mb-3 font-heading text-4xl font-extrabold leading-tight text-brand-gray-700 md:text-[3rem] lg:text-[3.9rem]">
            Stop Reading,{" "}
            <span className="block">Start Playing.</span>
          </h1>
          <p className="mb-8 text-brand-gray-500 text-lg lg:max-w-[650px] lg:text-[1.45rem] lg:leading-relaxed">
            Convert your notes into a dynamic Skill Tree and master any subject through immersive mini-games.
          </p>

          <div className="mb-4 flex w-full justify-center lg:justify-start lg:pl-12">
            <MascotOwl />
          </div>
          <p className="text-brand-gray-600 font-semibold text-sm lg:pl-12 lg:text-base">
            Start building your next course today!
          </p>
        </section>

        <section className="w-full max-w-[470px] shrink-0 rounded-2xl bg-white px-9 py-11 shadow-xl lg:ml-auto">
          <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 text-center mb-6">
            {activeTab === "signup" ? "Create Your Account" : "Welcome Back"}
          </h2>

          <div className="flex border-b border-brand-gray-200 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab("signup")}
              className={`flex-1 pb-2 text-center font-semibold transition ${
                activeTab === "signup"
                  ? "text-brand-gray-700 border-b-2 border-brand-gray-700"
                  : "text-brand-gray-400"
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("login")}
              className={`flex-1 pb-2 text-center font-semibold transition ${
                activeTab === "login"
                  ? "text-brand-gray-700 border-b-2 border-brand-gray-700"
                  : "text-brand-gray-400"
              }`}
            >
              Log In
            </button>
          </div>

          <form onSubmit={handleAuth} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-brand-gray-500 mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="jane.doe@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={`w-full rounded-lg border bg-brand-gray-50 px-4 py-2.5 text-sm text-brand-gray-700 placeholder:text-brand-gray-400 outline-none transition ${
                  fieldErrors.email
                    ? "border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                    : "border-brand-gray-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                }`}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-rose-500">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-brand-gray-500 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    activeTab === "signup" ? "new-password" : "current-password"
                  }
                  className={`w-full rounded-lg border bg-brand-gray-50 px-4 py-2.5 pr-12 text-sm text-brand-gray-700 placeholder:text-brand-gray-400 outline-none transition ${
                    fieldErrors.password
                      ? "border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                      : "border-brand-gray-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-3 text-xs font-semibold text-brand-gray-400 transition hover:text-brand-gray-600"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-rose-500">{fieldErrors.password}</p>
              )}
              {activeTab === "signup" && (
                <div className="mt-2 rounded-lg border border-brand-teal/15 bg-brand-teal/5 px-3 py-2">
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
              )}
            </div>

            {activeTab === "signup" && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-brand-gray-500 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className={`w-full rounded-lg border bg-brand-gray-50 px-4 py-2.5 pr-12 text-sm text-brand-gray-700 placeholder:text-brand-gray-400 outline-none transition ${
                      fieldErrors.confirmPassword
                        ? "border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-200"
                        : "border-brand-gray-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute inset-y-0 right-3 text-xs font-semibold text-brand-gray-400 transition hover:text-brand-gray-600"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-xs text-rose-500">
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-rose-500">{error}</p>}

            {activeTab === "login" && (
              <div className="flex items-center justify-between gap-3 text-xs">
                <p className="leading-relaxed text-brand-gray-400">
                  Use the email and password you registered with.
                </p>
                <Link
                  href="/auth/forgot-password"
                  className="shrink-0 font-semibold text-brand-teal hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full rounded-xl bg-brand-teal px-6 py-3 font-heading font-bold text-white uppercase tracking-wide shadow-md hover:opacity-90 active:translate-y-0.5 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? activeTab === "signup"
                  ? "Creating..."
                  : "Signing In..."
                : activeTab === "signup"
                ? "Create Account"
                : "Sign In"}
            </button>

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-brand-teal bg-white/40 px-6 py-3 font-heading font-bold uppercase tracking-wide text-brand-teal hover:bg-brand-teal/5 transition disabled:cursor-not-allowed disabled:opacity-60 shadow-sm"
            >
              Guest Login (訪客登入)
            </button>

            <button
              type="button"
              onClick={handleDevLogin}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-brand-teal/30 bg-brand-teal/5 px-6 py-3 font-heading font-bold uppercase tracking-wide text-brand-teal shadow-sm transition hover:bg-brand-teal/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Dev Login
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-brand-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-brand-gray-400">Social login coming later</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <SocialButton label="Google" icon={<FcGoogle className="h-5 w-5" />} />
            <SocialButton label="Facebook" icon={<FaFacebook className="h-5 w-5 text-[#1877F2]" />} />
            <SocialButton label="Apple" icon={<FaApple className="h-5 w-5 text-brand-gray-700" />} />
          </div>
        </section>
      </main>
    </div>
  );
}

function SocialButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled
      aria-label={`${label} login coming soon`}
      className="flex items-center justify-center rounded-xl border border-brand-gray-200 bg-brand-gray-50 py-3 shadow-sm opacity-60"
    >
      {icon}
    </button>
  );
}

function MascotOwl() {
  return (
    <div className="flex h-56 w-56 items-center justify-center rounded-full bg-transparent lg:h-60 lg:w-60">
      <Image
        src="/icons/full_icon.ico"
        alt="Learn8 mascot"
        width={240}
        height={240}
        className="h-56 w-56 object-contain mix-blend-multiply lg:h-60 lg:w-60"
      />
    </div>
  );
}
