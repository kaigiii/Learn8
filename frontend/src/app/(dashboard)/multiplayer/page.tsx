"use client";

import React, { useEffect, useState } from "react";

import TopStatsBar from "@/components/layout/TopStatsBar";
import { fetchPublicCourses } from "@/lib/courses/api";
import type { CourseListItem } from "@/lib/apiTypes";
import { HomeArenaPanel } from "../home/components/HomeArenaPanel";
import { MultiplayerTopicsSection } from "./components/MultiplayerTopicsSection";
import { HomeBackground } from "../home/components/HomeBackground";

export default function MultiplayerPage() {
  const [courses, setCourses] = useState<CourseListItem[]>([]);
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

        <MultiplayerTopicsSection courses={courses} />
      </div>
    </div>
  );
}
