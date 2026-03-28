"use client";

import type React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { CourseListItem } from "@/lib/apiTypes";
import type { CourseModalState } from "../types";
import { HomeCourseIcon } from "./HomeCourseIcon";
import { HOME_COURSE_CARD_GRADIENTS } from "../visuals";

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
}

export function HomeLibrarySection({
  scrollRef,
  libraryItems,
  onScrollLibrary,
  onOpenCourseModal,
}: HomeLibrarySectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 md:text-3xl">
          Your Library
        </h2>
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

      <div
        ref={scrollRef}
        dir="ltr"
        className="flex snap-x gap-4 overflow-x-auto pb-4 pt-4 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {libraryItems.map((item) => {
          const gradient =
            HOME_COURSE_CARD_GRADIENTS[item.indexSeed % HOME_COURSE_CARD_GRADIENTS.length] ??
            "from-teal-100 to-cyan-50";

          return (
            <motion.div
              key={item.key}
              whileHover={{ y: -4 }}
              className="relative w-40 shrink-0 snap-start md:w-48"
            >
              <div className="absolute right-2 top-2 z-20 flex gap-2">
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenCourseModal({
                      type: "rename",
                      course: item.course,
                      draftName: item.title,
                      submitting: false,
                      renameTarget: item.kind,
                      courseId: item.kind === "course" ? item.course.id : undefined,
                    });
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef6f8]/72 text-brand-gray-600 shadow-[0_6px_16px_rgba(97,163,184,0.12)] backdrop-blur transition hover:bg-[#f7fbfc]"
                  aria-label="Rename course"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenCourseModal({
                      type: "delete",
                      course: item.course,
                      submitting: false,
                    });
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-50/78 text-rose-500 shadow-[0_6px_16px_rgba(244,114,182,0.12)] backdrop-blur transition hover:bg-rose-50"
                  aria-label="Delete course"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>

              <Link href={item.href}>
                <div
                  className={`flex h-36 items-center justify-center rounded-2xl bg-gradient-to-br shadow-md transition-all hover:shadow-lg md:h-44 ${gradient} ${
                    item.kind === "draft"
                      ? "border border-[#9ecbd4]/28 shadow-[0_14px_34px_rgba(97,163,184,0.16)]"
                      : ""
                  }`}
                >
                  <HomeCourseIcon />
                </div>
                <div className="mt-2 space-y-1 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-teal/80">
                    {item.stateLabel}
                  </p>
                  <p className="truncate text-sm font-semibold text-brand-gray-600">
                    {item.title}
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}

        {libraryItems.length === 0 && (
          <div className="rounded-2xl border border-white/60 bg-white/60 px-5 py-8 text-sm text-brand-gray-500">
            No courses yet. Start by dropping a PDF or entering a topic.
          </div>
        )}
      </div>
    </section>
  );
}
