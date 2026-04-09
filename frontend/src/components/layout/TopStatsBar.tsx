"use client";

import React, { useState } from "react";
import Link from "next/link";
import ProfileSettingsDialog from "@/features/profile/ProfileSettingsDialog";
import { useAuthStore } from "@/stores/app/useAuthStore";
import useUserStore, { selectAvailableCredits } from "@/stores/app/useUserStore";

interface TopStatsBarProps {
  backHref?: string;
  pageTitle?: string;
  showBackLogo?: boolean;
  navLinks?: Array<{
    href: string;
    label: string;
    active?: boolean;
  }>;
  quickLinks?: Array<{
    href: string;
    label: string;
    active?: boolean;
  }>;
}

export default function TopStatsBar({
  backHref,
  pageTitle,
  showBackLogo = true,
  navLinks = [],
  quickLinks = [],
}: TopStatsBarProps = {}) {
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
  const pillClassName =
    "inline-flex h-10 items-center rounded-full border border-white/85 bg-white/92 px-3 text-sm font-heading font-bold text-brand-gray-700 shadow-sm transition";
  const navChipClassName =
    "inline-flex h-9 items-center rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.16em] transition";

  return (
    <>
      <nav className="sticky top-0 z-50 flex min-h-[72px] items-center justify-between gap-3 border-b border-[#d9e7ec] bg-[rgba(248,252,253,0.96)] px-4 py-3 shadow-[0_8px_24px_rgba(113,145,156,0.08)] md:px-8">
        {/* Left: back arrow or avatar + logo */}
        <div className="relative flex min-w-0 items-center gap-3">
          {backHref ? (
            /* Back arrow mode (e.g. store, map) */
            <>
              <Link
                href={backHref}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e3edf0] bg-white text-brand-gray-600 shadow-sm transition hover:bg-[#f8fbfc]"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Link>
              {showBackLogo ? <OwlLogoSmall /> : null}
              <span className="truncate font-heading text-lg font-extrabold leading-none text-brand-gray-700 md:text-[1.35rem]">
                {pageTitle}
              </span>
              {navLinks.length > 0 ? (
                <div className="ml-2 hidden items-center gap-2 md:flex">
                  {navLinks.map((link) => (
                    <Link
                      key={`${link.href}-${link.label}`}
                      href={link.href}
                      className={`${navChipClassName} ${
                        link.active
                          ? "bg-brand-teal/12 text-brand-teal ring-1 ring-brand-teal/20"
                          : "border border-[#e3edf0] bg-white text-brand-gray-600 hover:bg-[#f8fbfc]"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            /* Default avatar + logo mode */
            <>
              <button
                onClick={() => setProfileOpen(true)}
                className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-brand-teal shadow-md transition hover:shadow-lg"
              >
                <MascotAvatar />
              </button>

              <Link href="/home" className="flex items-center gap-2">
                <span className="hidden font-heading text-lg font-extrabold leading-none text-brand-teal sm:inline md:text-[1.35rem]">
                  Learn8
                </span>
              </Link>
            </>
          )}
        </div>

        {/* Right: stats */}
        <div className="flex items-center gap-2 md:gap-3">
          {quickLinks.length > 0 ? (
            <div className="flex items-center gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={`${link.href}-${link.label}-quick`}
                  href={link.href}
                  className={`${navChipClassName} ${
                    link.active
                      ? "bg-brand-teal/12 text-brand-teal ring-1 ring-brand-teal/20"
                      : "border border-[#e3edf0] bg-white text-brand-gray-600 hover:bg-[#f8fbfc]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
          {navLinks.length > 0 ? (
            <div className="flex items-center gap-2 md:hidden">
              {navLinks.map((link) => (
                <Link
                  key={`${link.href}-${link.label}-mobile`}
                  href={link.href}
                  className={`${navChipClassName} ${
                    link.active
                      ? "bg-brand-teal/12 text-brand-teal ring-1 ring-brand-teal/20"
                      : "border border-[#e3edf0] bg-white text-brand-gray-600 hover:bg-[#f8fbfc]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ) : null}
          {/* Streak */}
          <div className={`${pillClassName} gap-1.5`}>
            <span className="text-base leading-none">⏱️</span>
            <span className="whitespace-nowrap text-sm leading-none">
              {goalLabel}
            </span>
          </div>

          {/* Credits */}
          <Link
            href="/store"
            className={`${pillClassName} gap-1.5 hover:bg-white`}
          >
            <span className="text-base leading-none">💎</span>
            <span className="whitespace-nowrap text-sm leading-none">
              {creditBalance.toLocaleString()}
            </span>
          </Link>

          {/* Profile badge */}
          <Link
            href="/profile"
            className="flex h-10 items-center gap-2 rounded-full border border-white/85 bg-white/92 px-2.5 shadow-sm transition hover:bg-white"
          >
            <div className="flex h-7 min-w-7 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 px-2 shadow-md">
              <span className="font-heading font-extrabold text-white text-[10px]">
                {authUser?.full_name?.trim()?.slice(0, 1).toUpperCase() || "P"}
              </span>
            </div>
            <span className="hidden max-w-[120px] truncate font-heading text-sm font-bold leading-none text-brand-gray-700 md:inline">
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
