"use client";

import React, { useState } from "react";
import Link from "next/link";
import ProfileSettingsDialog from "@/features/profile/ProfileSettingsDialog";
import { useAuthStore } from "@/stores/app/useAuthStore";
import useUserStore, { selectAvailableCredits } from "@/stores/app/useUserStore";

interface TopStatsBarProps {
  backHref?: string;
  pageTitle?: string;
}

export default function TopStatsBar({ backHref, pageTitle }: TopStatsBarProps = {}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const authUser = useAuthStore((s) => s.user);
  const availableCredits = useUserStore(selectAvailableCredits);
  const creditBalance = authUser?.credits ?? availableCredits;
  const goalLabel = authUser?.daily_learning_goal_minutes
    ? `${authUser.daily_learning_goal_minutes} min/day`
    : "Set Goal";
  const profileLabel =
    authUser?.full_name?.trim() ||
    authUser?.job_title?.trim() ||
    authUser?.education_level?.trim() ||
    "Learner";

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-8 py-3 bg-white/70 backdrop-blur-lg border-b border-white/40 shadow-sm">
        {/* Left: back arrow or avatar + logo */}
        <div className="flex items-center gap-3 relative">
          {backHref ? (
            /* Back arrow mode (e.g. store, map) */
            <>
              <Link
                href={backHref}
                className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-brand-gray-50 transition text-brand-gray-600"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Link>
              <OwlLogoSmall />
              <span className="font-heading text-xl font-extrabold text-brand-gray-700">
                {pageTitle}
              </span>
            </>
          ) : (
            /* Default avatar + logo mode */
            <>
              <button
                onClick={() => setProfileOpen(true)}
                className="relative h-11 w-11 rounded-full overflow-hidden border-2 border-brand-teal shadow-md hover:shadow-lg transition"
              >
                <MascotAvatar />
              </button>

              <Link href="/home" className="flex items-center gap-2">
                <span className="font-heading text-xl font-extrabold text-brand-teal hidden sm:inline">
                  Learn8
                </span>
              </Link>
            </>
          )}
        </div>

        {/* Right: stats */}
        <div className="flex items-center gap-4 md:gap-6">
          {/* Streak */}
          <div className="flex items-center gap-1.5">
            <span className="text-lg">⏱️</span>
            <span className="font-heading font-bold text-brand-gray-700 text-sm md:text-base">
              {goalLabel}
            </span>
          </div>

          {/* Credits */}
          <Link
            href="/store"
            className="flex items-center gap-1.5 hover:opacity-80 transition"
          >
            <span className="text-lg">💎</span>
            <span className="font-heading font-bold text-brand-gray-700 text-sm md:text-base">
              {creditBalance.toLocaleString()}
            </span>
          </Link>

          {/* Profile badge */}
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-full px-2 py-1.5 transition hover:bg-white/55"
          >
            <div className="h-8 min-w-8 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center shadow-md px-2">
              <span className="font-heading font-extrabold text-white text-[10px]">
                {authUser?.full_name?.trim()?.slice(0, 1).toUpperCase() || "P"}
              </span>
            </div>
            <span className="font-heading font-bold text-brand-gray-700 text-sm md:text-base hidden md:inline">
              {profileLabel}
            </span>
          </Link>
        </div>
      </nav>

      {/* Profile modal */}
      {profileOpen && (
        <ProfileSettingsDialog onClose={() => setProfileOpen(false)} />
      )}
    </>
  );
}

/* ── Small mascot avatar ── */
function MascotAvatar() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" fill="none">
      <rect width="64" height="64" rx="32" fill="#E8F5F4" />
      <ellipse cx="32" cy="36" rx="16" ry="18" fill="#C4A882" />
      <ellipse cx="32" cy="34" rx="12" ry="14" fill="#E8D5B7" />
      <circle cx="26" cy="29" r="5" fill="white" />
      <circle cx="38" cy="29" r="5" fill="white" />
      <circle cx="26" cy="29" r="5.5" fill="none" stroke="#6B6B6B" strokeWidth="1.2" />
      <circle cx="38" cy="29" r="5.5" fill="none" stroke="#6B6B6B" strokeWidth="1.2" />
      <line x1="31" y1="29" x2="33" y2="29" stroke="#6B6B6B" strokeWidth="1.2" />
      <circle cx="27" cy="29" r="2.5" fill="#333" />
      <circle cx="37" cy="29" r="2.5" fill="#333" />
      <circle cx="28" cy="28" r="0.8" fill="white" />
      <circle cx="38" cy="28" r="0.8" fill="white" />
      <polygon points="32,33 30,36 34,36" fill="#E8734A" />
      <polygon points="25,22 28,17 30,24" fill="#C4A882" />
      <polygon points="39,22 36,17 34,24" fill="#C4A882" />
    </svg>
  );
}

/* ── Small owl logo icon ── */
function OwlLogoSmall() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none">
      <circle cx="16" cy="16" r="15" fill="#7AC7C4" opacity="0.2" />
      <ellipse cx="16" cy="18" rx="9" ry="10" fill="#C4A882" />
      <ellipse cx="16" cy="17" rx="7" ry="8" fill="#E8D5B7" />
      <circle cx="13" cy="14" r="3" fill="white" />
      <circle cx="19" cy="14" r="3" fill="white" />
      <circle cx="13.5" cy="14" r="1.5" fill="#333" />
      <circle cx="18.5" cy="14" r="1.5" fill="#333" />
      <polygon points="16,16 14.5,18 17.5,18" fill="#E8734A" />
    </svg>
  );
}
