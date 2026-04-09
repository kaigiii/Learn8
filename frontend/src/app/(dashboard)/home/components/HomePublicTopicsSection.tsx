"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { CourseListItem } from "@/lib/apiTypes";
import { HomeCourseIcon } from "./HomeCourseIcon";
import { HOME_COURSE_CARD_GRADIENTS } from "../visuals";

interface HomePublicTopicsSectionProps {
  courses: CourseListItem[];
}

export function HomePublicTopicsSection({ courses }: HomePublicTopicsSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (courses.length === 0) {
    return null;
  }

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
          <p className="mt-1 text-sm text-brand-gray-500">
            Browse these high-quality, pre-built subjects ready for learning and competition.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden rounded-full bg-white/75 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-teal md:inline-block">
            {courses.length} topics
          </span>
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

      <div
        ref={scrollRef}
        dir="ltr"
        className="flex snap-x gap-4 overflow-x-auto pb-4 pt-4 scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {courses.map((course, index) => {
          const gradient =
            HOME_COURSE_CARD_GRADIENTS[index % HOME_COURSE_CARD_GRADIENTS.length] ??
            "from-teal-100 to-cyan-50";

          return (
            <Link key={course.id} href={`/courses/${course.id}`} className="block">
              <motion.div
                whileHover={{ y: -4 }}
                className="relative w-40 shrink-0 snap-start cursor-pointer md:w-48"
              >
                <div
                  className={`flex h-36 flex-col items-center justify-center rounded-2xl bg-gradient-to-br shadow-md transition-all hover:shadow-lg md:h-44 ${gradient}`}
                >
                  <div className="mb-2">
                    <HomeCourseIcon />
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-teal/80">
                    Public Course
                  </p>
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
    </section>
  );
}
