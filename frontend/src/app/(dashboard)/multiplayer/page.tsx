"use client";

import React, { useEffect, useState } from "react";

import TopStatsBar from "@/components/layout/TopStatsBar";
import { fetchArenaPublicCourses } from "@/lib/arena/api";
import type { ArenaPublicCourse } from "@/lib/apiTypes";
import { HomeArenaPanel } from "../home/components/HomeArenaPanel";
import { HomeArenaTopicsSection } from "../home/components/HomeArenaTopicsSection";
import { HomeBackground } from "../home/components/HomeBackground";

export default function MultiplayerPage() {
  const [courses, setCourses] = useState<ArenaPublicCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingCourses(true);
    setError(null);

    void fetchArenaPublicCourses()
      .then((items) => {
        if (!cancelled) {
          setCourses(items);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Arena topics");
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
          { href: "/multiplayer", label: "Multiplayer", active: true },
          { href: "/arena/leaderboard", label: "Leaderboard" },
        ]}
      />

      <HomeBackground />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8">
        <div className="max-w-xl">
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

        <HomeArenaTopicsSection courses={courses} />
      </div>
    </div>
  );
}
