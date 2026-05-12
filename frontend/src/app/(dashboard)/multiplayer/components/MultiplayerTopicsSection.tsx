"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { CourseListItem } from "@/lib/apiTypes";
import {
  DEFAULT_LIBRARY_BACKGROUNDS,
  resolveCourseCardBackground,
} from "@/lib/courseCardBackground";
import { HomeCourseIcon } from "../../home/components/HomeCourseIcon";
import { useI18n } from "@/lib/i18n/useI18n";
import type { TranslationKey } from "@/lib/i18n/translations";

const LIB_BG_IMAGES = DEFAULT_LIBRARY_BACKGROUNDS;

interface MultiplayerTopicsSectionProps {
  courses: CourseListItem[];
  courseProgressById: Record<number, number>;
}

function courseSlugFromTitle(title: string): string {
  return title.toLowerCase().replace(/ /g, "-").replace(/&/g, "and");
}

function translateCourseTitle(
  t: (key: TranslationKey) => string,
  title: string
): string {
  const slug = courseSlugFromTitle(title);
  const key = `arena.course.${slug}` as TranslationKey;
  const result = t(key);
  return result === key ? title : result;
}

export function MultiplayerTopicsSection({
  courses,
  courseProgressById,
}: MultiplayerTopicsSectionProps) {
  const { t } = useI18n();
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
            {t("multiplayer.arenaTopics")}
          </h2>
          <p className="mt-1 text-sm text-brand-gray-500">
            {t("multiplayer.arenaTopicsSubtitle")}
          </p>
        </div>
        <div className="flex items-center gap-4">
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
                    <HomeCourseIcon progress={courseProgressById[course.id] ?? 0} />
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-center">
                  <p
                    className="truncate text-sm font-semibold text-brand-gray-600"
                    title={translateCourseTitle(t, course.title)}
                  >
                    {translateCourseTitle(t, course.title)}
                  </p>
                </div>
              </motion.div>
            </Link>
          );
        })}

        {courses.length === 0 && (
          <div className="rounded-2xl border border-white/60 bg-white/60 px-5 py-8 text-sm text-brand-gray-500 w-full">
            {t("multiplayer.noTopics")}
          </div>
        )}
      </div>
    </section>
  );
}
