"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ProfileSettingsDialog from "@/features/profile/ProfileSettingsDialog";
import { useAuthStore } from "@/stores/app/useAuthStore";
import useUserStore, { selectAvailableCredits } from "@/stores/app/useUserStore";

interface TopStatsBarProps {
  backHref?: string;
  pageTitle?: string;
  showBackLogo?: boolean;
  backLogoSrc?: string;
  backLogoAlt?: string;
  backLogoClassName?: string;
  mascotSrc?: string;
  mascotAlt?: string;
  mascotImageClassName?: string;
  navLinks?: Array<{
    href: string;
    label: string;
    active?: boolean;
  }>;
  quickLinks?: Array<{
    href: string;
    label: string;
    active?: boolean;
    iconSrc?: string;
    iconAlt?: string;
  }>;
}

export default function TopStatsBar({
  backHref,
  pageTitle,
  showBackLogo = true,
  backLogoSrc,
  backLogoAlt,
  backLogoClassName,
  mascotSrc,
  mascotAlt,
  mascotImageClassName,
  navLinks = [],
  quickLinks = [],
}: TopStatsBarProps = {}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const pathname = usePathname();
  const authUser = useAuthStore((s) => s.user);
  const availableCredits = useUserStore(selectAvailableCredits);
  const creditBalance = authUser?.credits ?? availableCredits;
  const profileLabel =
    authUser?.full_name?.trim() ||
    authUser?.job_title?.trim() ||
    authUser?.education_level?.trim() ||
    "Learner";
  const pillClassName =
    "inline-flex h-10 items-center rounded-full border border-white/85 bg-white/92 px-3 text-sm font-heading font-bold text-brand-gray-700 shadow-sm transition";
  const navChipClassName =
    "inline-flex h-9 items-center rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.16em] transition";
  const quickChipClassName =
    "inline-flex h-10 items-center gap-0 rounded-full bg-white/92 px-2.5 text-sm font-heading font-bold leading-none text-brand-gray-700 shadow-sm transition hover:bg-white lg:gap-2 lg:px-3";
  const quickActiveClassName = "bg-white ring-1 ring-brand-teal/20";
  const isStoreActive = pathname === "/store" || pathname.startsWith("/store/");
  const isProfileActive = pathname === "/profile" || pathname.startsWith("/profile");

  return (
    <>
      <nav className="sticky top-0 z-50 flex min-h-[72px] items-center justify-between gap-2 bg-white bg-[url('/Tools_Overview.png')] bg-[length:100%_100%] bg-no-repeat px-4 py-3 shadow-[0_8px_24px_rgba(113,145,156,0.08)] md:gap-3 md:px-8">
        {/* Left: back arrow or avatar + logo */}
        <div className="relative flex min-w-0 items-center gap-3 md:flex-1">
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
              {showBackLogo ? (
                backLogoSrc ? (
                  <Image
                    src={backLogoSrc}
                    alt={backLogoAlt ?? "Page icon"}
                    width={40}
                    height={40}
                    className={backLogoClassName ?? "h-8 w-8 object-contain"}
                  />
                ) : (
                  <OwlLogoSmall />
                )
              ) : null}
              <span className="min-w-0 truncate font-heading text-lg font-extrabold leading-none text-brand-gray-700 max-[420px]:hidden md:text-[1.35rem]">
                {pageTitle}
              </span>
              {navLinks.length > 0 ? (
                <div className="ml-2 hidden min-w-0 items-center gap-2 md:flex">
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
                className="relative h-10 w-10 overflow-hidden rounded-full shadow-md transition hover:shadow-lg"
              >
                <MascotAvatar
                  src={mascotSrc}
                  alt={mascotAlt}
                  imageClassName={mascotImageClassName}
                />
              </button>

              <Link href="/home" className="flex items-center">
                <Image
                  src="/logs.png"
                  alt="Learn8"
                  width={280}
                  height={112}
                  priority
                  className="h-8 w-auto object-contain sm:h-11 md:h-12"
                />
              </Link>
            </>
          )}
        </div>

        {/* Right: stats */}
        <div className="flex min-w-0 flex-none items-center gap-1.5 sm:gap-2 md:gap-3">
          {quickLinks.length > 0 ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={`${link.href}-${link.label}-quick`}
                  href={link.href}
                  className={`${quickChipClassName} ${
                    link.active
                      ? quickActiveClassName
                      : ""
                  }`}
                >
                  {link.iconSrc ? (
                    <Image
                      src={link.iconSrc}
                      alt={link.iconAlt ?? ""}
                      width={24}
                      height={24}
                      className="h-6 w-6 object-contain"
                    />
                  ) : null}
                  <span className="hidden whitespace-nowrap lg:inline">{link.label}</span>
                </Link>
              ))}
            </div>
          ) : null}
          {navLinks.length > 0 ? (
            <div className="flex min-w-max items-center gap-2 md:hidden">
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
          {/* Credits */}
          <Link
            href="/store"
            className={`${pillClassName} flex-none gap-1.5 hover:bg-white ${
              isStoreActive ? quickActiveClassName : ""
            }`}
          >
            <span className="text-base leading-none">💎</span>
            <span className="hidden whitespace-nowrap text-sm leading-none md:inline">
              {creditBalance.toLocaleString()}
            </span>
          </Link>

          {/* Profile badge */}
          <Link
            href="/profile"
            className={`flex h-10 flex-none items-center gap-2 rounded-full border border-white/85 bg-white/92 px-2.5 shadow-sm transition hover:bg-white ${
              isProfileActive ? quickActiveClassName : ""
            }`}
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
function MascotAvatar({
  src = "/favicon.ico",
  alt = "Profile mascot",
  imageClassName,
}: {
  src?: string;
  alt?: string;
  imageClassName?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={40}
      height={40}
      className={`h-full w-full object-cover ${imageClassName ?? ""}`}
    />
  );
}

/* ── Small owl logo icon ── */
function OwlLogoSmall() {
  return (
    <div className="h-8 w-8 overflow-hidden rounded-full">
      <Image
        src="/favicon.ico"
        alt="Learn8 logo"
        width={32}
        height={32}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
