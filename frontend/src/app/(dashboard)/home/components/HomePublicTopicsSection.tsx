"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { CourseListItem } from "@/lib/apiTypes";
import {
  DEFAULT_LIBRARY_BACKGROUNDS,
  resolveCourseCardBackground,
} from "@/lib/courseCardBackground";
import { HomeCourseIcon } from "./HomeCourseIcon";

const LIB_BG_IMAGES = DEFAULT_LIBRARY_BACKGROUNDS;

interface HomePublicTopicsSectionProps {
  courses: CourseListItem[];
  activeTab: "library" | "public";
  onTabChange: (tab: "library" | "public") => void;
}

export function HomePublicTopicsSection({
  courses,
  activeTab,
  onTabChange,
}: HomePublicTopicsSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLibrary = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "right" ? 260 : -260,
      behavior: "smooth",
    });
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 md:text-3xl">
            Official Public Topics
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
              onClick={() => scrollLibrary("left")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-gray-200 bg-white text-brand-gray-400 shadow-sm transition hover:border-brand-gray-300 hover:text-brand-gray-600"
            >
              ‹
            </button>
            <button
              onClick={() => scrollLibrary("right")}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-gray-200 bg-white text-brand-gray-400 shadow-sm transition hover:border-brand-gray-300 hover:text-brand-gray-600"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-white/60 bg-white/60 px-5 py-8 text-sm text-brand-gray-500 shadow-sm backdrop-blur-sm md:px-6 md:py-10 min-h-[220px] flex items-center justify-center">
          No official topics available yet.
        </div>
      ) : (
        <div
          ref={scrollRef}
          dir="ltr"
          className="flex snap-x gap-4 overflow-x-auto pb-4 pt-4 scrollbar-hide min-h-[220px]"
          style={{ scrollbarWidth: "none" }}
        >
          {courses.map((course) => {
            const backgroundImage = resolveCourseCardBackground(
              course.id ?? course.title,
              LIB_BG_IMAGES
            );

            return (
              <Link key={course.id} href={`/courses/${course.id}`} className="block">
                <motion.div
                  whileHover={{ y: -4 }}
                  className="relative w-40 shrink-0 snap-start cursor-pointer md:w-48"
                >
                  <div
                    className="flex h-36 flex-col items-center justify-center rounded-2xl bg-cover bg-center bg-no-repeat shadow-md transition-all hover:shadow-lg md:h-44"
                    style={{ backgroundImage: `url(${backgroundImage})` }}
                  >
                    <div className="mb-2">
                      <HomeCourseIcon />
                    </div>
                  </div>
                  <div className="mt-2 space-y-1 text-center">
                    <p
                      className="truncate text-sm font-semibold text-brand-gray-600"
                      title={course.title}
                    >
                      {course.title}
                    </p>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
