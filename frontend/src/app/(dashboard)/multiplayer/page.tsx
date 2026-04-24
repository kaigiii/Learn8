"use client";

import React, { useEffect, useState } from "react";

import TopStatsBar from "@/components/layout/TopStatsBar";
import { apiFetch } from "@/lib/apiClient";
import { fetchPublicCourses } from "@/lib/courses/api";
import type { CourseListItem, CoursePath } from "@/lib/apiTypes";
import { NODE_STATUS } from "@/lib/domain/statuses";
import { HomeArenaPanel } from "../home/components/HomeArenaPanel";
import { MultiplayerTopicsSection } from "./components/MultiplayerTopicsSection";
import { HomeBackground } from "../home/components/HomeBackground";

export default function MultiplayerPage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [courseProgressById, setCourseProgressById] = useState<Record<number, number>>({});
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCourses(true);
    setError(null);

    void fetchPublicCourses()
      .then((items) => {
        if (!cancelled) {
          setCourses(items);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load topics");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingCourses(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (courses.length === 0) {
      setCourseProgressById({});
      return;
    }

    let cancelled = false;

    const loadProgress = async () => {
      const progressEntries = await Promise.all(
        courses.map(async (course) => {
          try {
            const coursePath = await apiFetch<CoursePath>(`/courses/${course.id}`);
            const nodes = coursePath.units.flatMap((unit) => unit.nodes);
            const total = nodes.length;
            const completed = nodes.filter(
              (node) => node.status === NODE_STATUS.COMPLETED
            ).length;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            return [course.id, progress] as const;
          } catch {
            return [course.id, 0] as const;
          }
        })
      );

      if (!cancelled) {
        setCourseProgressById(Object.fromEntries(progressEntries));
      }
    };

    void loadProgress();

    return () => {
      cancelled = true;
    };
  }, [courses]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <TopStatsBar
        backHref="/home"
        pageTitle="Multiplayer"
        quickLinks={[
          {
            href: "/multiplayer",
            label: "Multiplayer",
            active: true,
            iconSrc: "/svg/multiplayer-controller.svg",
            iconAlt: "Multiplayer",
          },
          {
            href: "/arena/leaderboard",
            label: "Leaderboard",
            iconSrc: "/svg/leaderboard-logo.svg",
            iconAlt: "Leaderboard",
          },
        ]}
      />

      <HomeBackground />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8">
        <div className="w-full">
          <HomeArenaPanel />
        </div>

        {loadingCourses ? (
          <div className="rounded-2xl border border-white/60 bg-white/65 px-4 py-3 text-sm text-brand-gray-600 shadow-sm backdrop-blur">
            Loading Arena public topics...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <MultiplayerTopicsSection
          courses={courses}
          courseProgressById={courseProgressById}
        />
      </div>
    </div>
  );
}
