"use client";

import type React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { CourseListItem } from "@/lib/apiTypes";
import type { CourseModalState } from "../types";
import { HomeCourseIcon } from "./HomeCourseIcon";

const LIB_BG_IMAGES = [
  "/library-bg/blue.png",
  "/library-bg/green.png",
  "/library-bg/red.png",
  "/library-bg/yellow.png",
];

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

      {libraryItems.length === 0 ? (
        <div className="rounded-2xl border border-white/60 bg-white/60 px-5 py-8 text-sm text-brand-gray-500 shadow-sm backdrop-blur-sm md:px-6 md:py-10">
          No courses yet. Start by dropping a PDF or entering a topic.
        </div>
      ) : (
        <div
          ref={scrollRef}
          dir="ltr"
          className="flex snap-x gap-4 overflow-x-auto pb-4 pt-4 scrollbar-hide"
          style={{ scrollbarWidth: "none" }}
        >
          {libraryItems.map((item, index) => {
            const backgroundImage =
              LIB_BG_IMAGES[index % LIB_BG_IMAGES.length] ?? LIB_BG_IMAGES[0];

            return (
              <motion.div
                key={item.key}
                whileHover={{ y: -4 }}
                className="group relative w-40 shrink-0 snap-start md:w-48"
              >
                <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full border border-white/70 bg-white/80 p-1 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur-md md:pointer-events-none md:invisible md:translate-y-1 md:opacity-0 md:transition-all md:duration-200 md:group-hover:pointer-events-auto md:group-hover:visible md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:visible md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100">
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
                      onOpenCourseModal({
                        type: "delete",
                        course: item.course,
                        submitting: false,
                      });
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

                <Link href={item.href}>
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
    </section>
  );
}
