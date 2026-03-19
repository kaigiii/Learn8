"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FcGoogle } from "react-icons/fc";
import { FaFacebook, FaApple } from "react-icons/fa";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthTokenResponse, UserProfile } from "@/lib/types";
import { useAuthStore } from "@/stores/useAuthStore";
import useUserStore from "@/stores/useUserStore";

type AuthTab = "signup" | "login";

export default function LoginScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AuthTab>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = useAuthStore((s) => s.token);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const syncFromProfile = useUserStore((s) => s.syncFromProfile);

  useEffect(() => {
    if (token) {
      router.replace("/home");
    }
  }, [router, token]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (activeTab === "signup") {
        await apiFetch("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
          }),
        });
      }

      const tokenRes = await apiFetch<AuthTokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setSession(tokenRes.access_token, null);
      const profile = await apiFetch<UserProfile>("/auth/me");
      setSession(tokenRes.access_token, profile);
      syncFromProfile(profile);

      router.replace(activeTab === "signup" ? "/auth/welcome" : "/home");
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
    <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8] overflow-hidden">
      <ParticleField />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 gap-8 flex-wrap lg:flex-nowrap max-w-7xl mx-auto w-full">
        <section className="flex flex-col items-start max-w-md shrink-0">
          <div className="flex items-center gap-2 mb-6">
            <OwlIcon className="h-10 w-10 text-brand-teal" />
            <span className="font-heading text-2xl font-extrabold text-brand-gray-700">
              Learn8
            </span>
          </div>

          <h1 className="font-heading text-4xl md:text-[2.6rem] leading-tight font-extrabold text-brand-gray-700 mb-3">
            Stop Reading,{" "}
            <span className="block">Start Playing.</span>
          </h1>
          <p className="text-brand-gray-500 text-lg mb-8">
            Convert your notes into a dynamic Skill Tree and master any subject through immersive mini-games.
          </p>

          <div className="mb-4 flex justify-center w-full">
            <MascotOwl />
          </div>
          <p className="text-brand-gray-600 font-semibold text-sm">
            Start your learning journey today!
          </p>
        </section>

        <section className="flex flex-col items-center bg-white/70 backdrop-blur-md rounded-2xl shadow-lg px-10 py-10 w-80 shrink-0">
          <div className="flex gap-3 mb-6 text-lg font-heading font-bold">
            <button
              onClick={() => setActiveTab("signup")}
              className={`pb-1 transition ${
                activeTab === "signup"
                  ? "text-brand-teal border-b-2 border-brand-teal"
                  : "text-brand-gray-400"
              }`}
            >
              Sign Up
            </button>
            <span className="text-brand-gray-300">/</span>
            <button
              onClick={() => setActiveTab("login")}
              className={`pb-1 transition ${
                activeTab === "login"
                  ? "text-brand-teal border-b-2 border-brand-teal"
                  : "text-brand-gray-400"
              }`}
            >
              Log In
            </button>
          </div>

          {activeTab === "signup" ? (
            <>
              <p className="text-brand-gray-600 text-center mb-6">
                New here?
                <br />
                Create your account.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("signup")}
                className="w-full rounded-xl bg-brand-green px-6 py-3 font-heading font-bold text-white uppercase tracking-wide shadow-md hover:bg-brand-green-dark active:translate-y-0.5 transition mb-4"
              >
                Start Your Journey
              </button>
              <button
                onClick={() => setActiveTab("login")}
                className="text-brand-teal font-semibold hover:underline text-sm"
              >
                LOG IN
              </button>
            </>
          ) : (
            <>
              <p className="text-brand-gray-600 text-center mb-6">
                Ready to continue?
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className="w-full rounded-xl bg-brand-green px-6 py-3 font-heading font-bold text-white uppercase tracking-wide shadow-md hover:bg-brand-green-dark active:translate-y-0.5 transition mb-4"
              >
                Log In
              </button>
              <button
                onClick={() => setActiveTab("signup")}
                className="text-brand-teal font-semibold hover:underline text-sm"
              >
                SIGN UP
              </button>
            </>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-xl px-8 py-10 w-96 shrink-0">
          <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 text-center mb-6">
            Begin Your Mastery
          </h2>

          <div className="flex border-b border-brand-gray-200 mb-6">
            <button
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
                {activeTab === "signup" ? "Email or Username" : "Email"}
              </label>
              <input
                type="text"
                placeholder="jane.doe@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-brand-gray-200 bg-brand-gray-50 px-4 py-2.5 text-sm text-brand-gray-700 placeholder:text-brand-gray-400 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-brand-gray-500 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-brand-gray-200 bg-brand-gray-50 px-4 py-2.5 text-sm text-brand-gray-700 placeholder:text-brand-gray-400 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30 outline-none transition"
              />
            </div>

            {error && <p className="text-sm text-rose-500">{error}</p>}

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
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-brand-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-brand-gray-400">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <SocialButton icon={<FcGoogle className="h-5 w-5" />} />
            <SocialButton icon={<FaFacebook className="h-5 w-5 text-[#1877F2]" />} />
            <SocialButton icon={<FaApple className="h-5 w-5 text-brand-gray-700" />} />
          </div>
        </section>
      </main>
    </div>
  );
}

function SocialButton({ icon }: { icon: React.ReactNode }) {
  return (
    <button className="flex items-center justify-center rounded-xl border border-brand-gray-200 bg-white py-3 shadow-sm transition hover:border-brand-gray-300 hover:shadow">
      {icon}
    </button>
  );
}

function ParticleField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="absolute h-2 w-2 rounded-full bg-white/35"
          style={{
            left: `${(i * 17) % 100}%`,
            top: `${(i * 29) % 100}%`,
          }}
        />
      ))}
    </div>
  );
}

function OwlIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
      <path d="M7 16V9.5A5 5 0 0 1 12 4.5a5 5 0 0 1 5 5V16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9.5" cy="11" r="1.5" fill="currentColor" />
      <circle cx="14.5" cy="11" r="1.5" fill="currentColor" />
      <path d="M12 12.8l-1.2 2h2.4l-1.2-2Z" fill="currentColor" />
    </svg>
  );
}

function MascotOwl() {
  return (
    <div className="flex h-48 w-48 items-center justify-center rounded-full bg-white/50 shadow-inner">
      <OwlIcon className="h-24 w-24 text-brand-teal" />
    </div>
  );
}
