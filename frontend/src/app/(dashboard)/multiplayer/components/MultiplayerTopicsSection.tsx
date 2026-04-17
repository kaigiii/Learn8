"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { ArenaPublicCourse } from "@/lib/apiTypes";
import { HomeCourseIcon } from "../../home/components/HomeCourseIcon";
import { HOME_COURSE_CARD_GRADIENTS } from "../../home/visuals";

interface MultiplayerTopicsSectionProps {
  courses: ArenaPublicCourse[];
}

export function MultiplayerTopicsSection({ courses }: MultiplayerTopicsSectionProps) {
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
            Arena Topics
          </h2>
          <p className="mt-1 text-sm text-brand-gray-500">
            Pick a subject to enter the competitive matchmaking lobby.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden rounded-full bg-white/75 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-teal md:inline-block">
            {courses.length} subjects
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
            <Link key={course.id} href={`/arena/lobby/${course.id}`} className="block">
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
                    {course.topic}
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

        {courses.length === 0 && (
          <div className="rounded-2xl border border-white/60 bg-white/60 px-5 py-8 text-sm text-brand-gray-500 w-full">
            No arena topics available at the moment.
          </div>
        )}
      </div>
    </section>
  );
}
