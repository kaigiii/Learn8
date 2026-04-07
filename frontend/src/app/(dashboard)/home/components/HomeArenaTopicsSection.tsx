"use client";

import React from "react";

import DeepGlassCard from "@/components/ui/DeepGlassCard";
import type { ArenaPublicCourse } from "@/lib/apiTypes";

interface HomeArenaTopicsSectionProps {
  courses: ArenaPublicCourse[];
}

export function HomeArenaTopicsSection({ courses }: HomeArenaTopicsSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 md:text-3xl">
            Arena Public Topics
          </h2>
          <p className="mt-1 text-sm text-brand-gray-500">
            Browse the official subjects currently available for Arena competition.
          </p>
        </div>
        <span className="rounded-full bg-white/75 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-teal">
          {courses.length} topics
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {courses.map((course) => (
          <DeepGlassCard key={course.id} className="px-5 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-teal">
              {course.difficulty}
            </p>
            <h3 className="mt-3 font-heading text-2xl font-bold text-brand-gray-700">
              {course.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-brand-gray-500">
              {course.description || course.topic}
            </p>
            {course.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {course.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-gray-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </DeepGlassCard>
        ))}

        {courses.length === 0 ? (
          <DeepGlassCard className="px-5 py-5 text-sm text-brand-gray-500">
            Public Arena topics will appear here once they are published and Arena-enabled.
          </DeepGlassCard>
        ) : null}
      </div>
    </section>
  );
}
