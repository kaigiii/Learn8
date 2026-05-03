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
    iconText?: string;
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
  const userHandle = (authUser?.full_name || authUser?.email || "").trim().toLowerCase();

  const [invites, setInvites] = useState<any[]>([]);

  React.useEffect(() => {
    if (!authUser) return;
    const interval = setInterval(() => {
      import("@/lib/apiClient").then(({ apiFetch }) => {
        apiFetch<any>("/social/friends/arena-invites")
          .then((data) => {
            if (data.status === "ok" && data.invites) {
              setInvites(data.invites);
            }
          })
          .catch((err) => console.error(err));
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [authUser]);

  const handleAcceptInvite = async (inviteId: number, roomCode: string) => {
    try {
      const { apiFetch } = await import("@/lib/apiClient");
      await apiFetch<any>(`/social/friends/arena-invites/${inviteId}/respond?action=accept`, {
        method: "POST",
      });
      // CALL ROOM JOIN
      try {
        await apiFetch<any>("/arena/rooms/join", {
          method: "POST",
          body: JSON.stringify({ roomCode }),
        });
      } catch (err) {
        console.error("Room join failed", err);
      }
      window.location.href = `/arena/lobby/${roomCode}`;
    } catch (err) {
      console.error(err);
    }
  };

  const handleIgnoreInvite = async (inviteId: number) => {
    try {
      const { apiFetch } = await import("@/lib/apiClient");
      await apiFetch<any>(`/social/friends/arena-invites/${inviteId}/respond?action=ignore`, {
        method: "POST",
      });
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    } catch (err) {
      console.error(err);
    }
  };
  const emailLocalPart = (authUser?.email || "").trim().toLowerCase().split("@")[0] ?? "";
  const isDevAccount =
    userHandle === "dev" ||
    emailLocalPart === "dev" ||
    userHandle.startsWith("dev ") ||
    userHandle.startsWith("dev-") ||
    userHandle.startsWith("dev_");
  const profileLabel =
    authUser?.full_name?.trim() ||
    authUser?.job_title?.trim() ||
    authUser?.education_level?.trim() ||
    "Learner";
  const avatarUrl = authUser?.avatar_url?.trim() || "/avatar/chicken.png";
  const pillClassName =
    "inline-flex h-10 items-center rounded-full border border-white/85 bg-white/92 px-3 text-sm font-heading font-bold text-brand-gray-700 shadow-sm transition";
  const navChipClassName =
    "inline-flex h-9 items-center rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.16em] transition";
  const quickChipClassName =
    "inline-flex h-10 items-center gap-0 rounded-full bg-white/92 px-2.5 text-sm font-heading font-bold leading-none text-brand-gray-700 shadow-sm transition hover:bg-white lg:gap-2 lg:px-3";
  const quickActiveClassName = "bg-white ring-1 ring-brand-teal/20";
  const socialLink = {
    href: "/social",
    label: "Social",
    iconText: "👥",
    active: pathname === "/social" || pathname.startsWith("/social/"),
  };
  const withSocial = quickLinks.some((link) => link.href === "/social")
    ? quickLinks
    : [socialLink, ...quickLinks];

  const resolvedQuickLinks: Array<{
    href: string;
    label: string;
    active?: boolean;
    iconSrc?: string;
    iconAlt?: string;
    iconText?: string;
  }> = isDevAccount
    ? [
        {
          href: "/admin",
          label: "Admin",
          iconText: "⚙️",
          active: pathname === "/admin" || pathname.startsWith("/admin/"),
        },
        ...withSocial,
      ]
    : withSocial;
  const isStoreActive = pathname === "/store" || pathname.startsWith("/store/");
  const isProfileActive = pathname === "/profile" || pathname.startsWith("/profile");

  return (
    <>
      <nav className="sticky top-0 z-50 flex min-h-[72px] items-center justify-between gap-2 bg-white bg-[url('/backgrounds/Tools_Overview.png')] bg-[length:100%_100%] bg-no-repeat px-4 py-3 shadow-[0_8px_24px_rgba(113,145,156,0.08)] md:gap-3 md:px-8">
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
                  src="/icons/logs.png"
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
          {resolvedQuickLinks.length > 0 ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {resolvedQuickLinks.map((link) => (
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
                  ) : link.iconText ? (
                    <span className="text-base leading-none">{link.iconText}</span>
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
            <span className="whitespace-nowrap text-sm leading-none">
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
            <div className="relative flex h-7 min-w-7 items-center justify-center overflow-hidden rounded-full bg-white px-2 shadow-md">
              <AvatarImage
                src={avatarUrl}
                alt="Profile avatar"
                size="28px"
              />
            </div>
            <span className="max-w-[120px] truncate font-heading text-sm font-bold leading-none text-brand-gray-700">
              {profileLabel}
            </span>
          </Link>
        </div>
      </nav>

      {/* Profile modal */}
      {profileOpen && (
        <ProfileSettingsDialog onClose={() => setProfileOpen(false)} />
      )}

      {/* Real-time Arena Lobby Invitation Alert */}
      {invites && invites.map((invite) => (
        <div
          key={invite.id}
          className="fixed bottom-4 right-4 z-[9999] w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50/95 p-4 backdrop-blur shadow-2xl transition duration-300"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">⚔️</span>
            <p className="text-sm font-bold text-brand-gray-700">
              <span className="text-brand-teal font-extrabold">{invite.inviter_name}</span> has invited you to a private Arena Room!
            </p>
          </div>
          <p className="text-xs text-brand-gray-500 font-mono mt-1">Room Code: {invite.room_code}</p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => handleIgnoreInvite(invite.id)}
              className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold transition shadow-sm"
            >
              Ignore
            </button>
            <button
              onClick={() => handleAcceptInvite(invite.id, invite.room_code)}
              className="px-3 py-1.5 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl text-xs font-bold transition shadow-sm"
            >
              Join (加入房間)
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

function AvatarImage({
  src,
  alt,
  size,
}: {
  src: string;
  alt: string;
  size: string;
}) {
  const [imageSrc, setImageSrc] = useState(src);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      sizes={size}
      className="object-cover"
      onError={() => setImageSrc("/avatar/chicken.png")}
    />
  );
}

/* ── Small mascot avatar ── */
function MascotAvatar({
  src = "/icons/favicon.ico",
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
        src="/icons/favicon.ico"
        alt="Learn8 logo"
        width={32}
        height={32}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
