"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { CourseListItem } from "@/lib/apiTypes";
import {
  DEFAULT_LIBRARY_BACKGROUNDS,
  resolveCourseCardBackground,
} from "@/lib/courseCardBackground";
import type { CourseModalState } from "../types";
import { HomeCourseIcon } from "./HomeCourseIcon";

const LIB_BG_IMAGES = DEFAULT_LIBRARY_BACKGROUNDS;

export type HomeLibraryItem =
  | {
      kind: "course";
      key: string;
      course: CourseListItem;
      href: string;
      title: string;
      stateLabel: string;
      indexSeed: number;
    }
  | {
      kind: "draft";
      key: string;
      course: CourseListItem;
      href: string;
      title: string;
      stateLabel: string;
      indexSeed: number;
    };

interface HomeLibrarySectionProps {
  scrollRef: React.RefObject<HTMLDivElement>;
  libraryItems: HomeLibraryItem[];
  onScrollLibrary: (dir: "left" | "right") => void;
  onOpenCourseModal: (modal: NonNullable<CourseModalState>) => void;
  activeTab: "library" | "public";
  onTabChange: (tab: "library" | "public") => void;
}

export function HomeLibrarySection({
  scrollRef,
  libraryItems,
  onScrollLibrary,
  onOpenCourseModal,
  activeTab,
  onTabChange,
}: HomeLibrarySectionProps) {
  const [mobileActionItem, setMobileActionItem] = useState<HomeLibraryItem | null>(null);
  const [activeLongPressKey, setActiveLongPressKey] = useState<string | null>(null);
  const [canHover, setCanHover] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const applyCanHover = () => {
      setCanHover(media.matches);
    };

    applyCanHover();
    media.addEventListener("change", applyCanHover);
    return () => {
      media.removeEventListener("change", applyCanHover);
    };
  }, []);

  const startLongPress = (item: HomeLibraryItem) => {
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    setActiveLongPressKey(item.key);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setMobileActionItem(item);
    }, 450);
  };

  const cancelLongPress = () => {
    clearLongPressTimer();
    setActiveLongPressKey(null);
  };

  const closeMobileActions = () => {
    setMobileActionItem(null);
    setActiveLongPressKey(null);
  };

  const openRenameModal = (item: HomeLibraryItem) => {
    onOpenCourseModal({
      type: "rename",
      course: item.course,
      draftName: item.title,
      submitting: false,
      renameTarget: item.kind,
      courseId: item.kind === "course" ? item.course.id : undefined,
    });
  };

  const openDeleteModal = (item: HomeLibraryItem) => {
    onOpenCourseModal({
      type: "delete",
      course: item.course,
      submitting: false,
    });
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 md:text-3xl">
            Your Library
          </h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center rounded-full border border-white/85 bg-white/72 p-1 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              onClick={() => onTabChange("library")}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                activeTab === "library"
                  ? "bg-white text-brand-gray-700 shadow-sm"
                  : "text-brand-gray-500 hover:text-brand-gray-700"
              }`}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => onTabChange("public")}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] transition ${
                activeTab === "public"
                  ? "bg-white text-brand-gray-700 shadow-sm"
                  : "text-brand-gray-500 hover:text-brand-gray-700"
              }`}
            >
              Public
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onScrollLibrary("left")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-gray-200 bg-white text-brand-gray-400 shadow-sm transition hover:border-brand-gray-300 hover:text-brand-gray-600"
            >
              ‹
            </button>
            <button
              onClick={() => onScrollLibrary("right")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-gray-200 bg-white text-brand-gray-400 shadow-sm transition hover:border-brand-gray-300 hover:text-brand-gray-600"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {libraryItems.length === 0 ? (
        <div className="rounded-2xl border border-white/60 bg-white/60 px-5 py-8 text-sm text-brand-gray-500 shadow-sm backdrop-blur-sm md:px-6 md:py-10 min-h-[220px] flex items-center justify-center">
          No courses yet. Start by dropping a PDF or entering a topic.
        </div>
      ) : (
        <div
          ref={scrollRef}
          dir="ltr"
          className="flex snap-x gap-4 overflow-x-auto pb-4 pt-4 scrollbar-hide min-h-[220px]"
          style={{ scrollbarWidth: "none" }}
        >
          {libraryItems.map((item) => {
            const backgroundImage = resolveCourseCardBackground(
              item.course.id ?? item.key ?? item.title,
              LIB_BG_IMAGES
            );
            const shouldHideTopActions =
              activeLongPressKey === item.key || mobileActionItem !== null;

            return (
              <motion.div
                key={item.key}
                whileHover={{ y: -4 }}
                className="group relative w-40 shrink-0 snap-start md:w-48"
                onTouchStart={() => startLongPress(item)}
                onTouchEnd={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onTouchMove={cancelLongPress}
              >
                <div
                  className={`absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full border border-white/70 bg-white/80 p-1 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-md transition-all duration-200 ${
                    shouldHideTopActions
                      ? "pointer-events-none invisible opacity-0"
                      : canHover
                      ? "pointer-events-none invisible translate-y-1 opacity-0 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
                      : "pointer-events-none invisible opacity-0"
                  }`}
                >
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openRenameModal(item);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-teal-200/65 bg-teal-50/90 text-teal-700 transition-colors hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
                    aria-label="Rename course"
                    title="Rename"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4z" />
                    </svg>
                  </button>
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openDeleteModal(item);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-200/70 bg-rose-50/90 text-rose-600 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                    aria-label="Delete course"
                    title="Delete"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </div>

                <Link
                  href={item.href}
                  onClick={(event) => {
                    if (longPressTriggeredRef.current) {
                      event.preventDefault();
                      longPressTriggeredRef.current = false;
                    }
                  }}
                >
                  <div
                    className="flex h-36 items-center justify-center rounded-2xl bg-cover bg-center bg-no-repeat shadow-md transition-all hover:shadow-lg md:h-44"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                  >
                    <HomeCourseIcon />
                  </div>
                  <div className="mt-2 space-y-1 text-center">
                    <p className="truncate text-sm font-semibold text-brand-gray-600">
                      {item.title}
                    </p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {mobileActionItem && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-brand-gray-900/25 backdrop-blur-[1px]"
            onClick={closeMobileActions}
            aria-label="Close actions"
          />

          <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/80 bg-white/92 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.2)] backdrop-blur-xl">
            <p className="truncate text-sm font-semibold text-brand-gray-700">
              {mobileActionItem.title}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  openRenameModal(mobileActionItem);
                  closeMobileActions();
                }}
                className="rounded-xl border border-teal-200/70 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  openDeleteModal(mobileActionItem);
                  closeMobileActions();
                }}
                className="rounded-xl border border-rose-200/70 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600"
              >
                Delete
              </button>
            </div>

            <button
              type="button"
              onClick={closeMobileActions}
              className="mt-3 w-full rounded-xl border border-brand-gray-200 bg-white px-4 py-3 text-sm font-semibold text-brand-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
