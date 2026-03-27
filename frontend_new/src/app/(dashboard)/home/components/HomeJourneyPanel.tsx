"use client";

import Link from "next/link";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import TopProgressBar from "@/components/ui/TopProgressBar";
import type { Project } from "@/lib/apiTypes";
import { HomeCourseIcon } from "./HomeCourseIcon";
import { HOME_COURSE_CARD_GRADIENTS } from "../visuals";

interface HomeJourneyPanelProps {
  name: string;
  currentProject: Project | null;
  hasResumeCourse: boolean;
  activeCourseId: string | null;
  activeCourseNumericId: number | null;
  resumeTitle: string;
  resumeNodeCount: number;
  activeProgress: number;
}

export function HomeJourneyPanel({
  name,
  currentProject,
  hasResumeCourse,
  activeCourseId,
  activeCourseNumericId,
  resumeTitle,
  resumeNodeCount,
  activeProgress,
}: HomeJourneyPanelProps) {
  return (
    <DeepGlassCard className="h-full min-h-[360px] px-6 py-6 md:px-8 md:py-8">
      <div className="flex h-full flex-col">
        <h2 className="mb-1 font-heading text-2xl font-extrabold text-brand-gray-700 md:text-3xl">
          Welcome back, {name}!
        </h2>
        <p className="mb-5 text-sm text-brand-gray-400">Continue your journey</p>
        {currentProject && (
          <p className="mb-4 text-xs text-brand-gray-500">Project: {currentProject.name}</p>
        )}

        {hasResumeCourse ? (
          <div className="flex flex-1 items-start gap-5">
            <div
                className={`shrink-0 flex h-32 w-28 items-center justify-center rounded-xl bg-gradient-to-br ${
                HOME_COURSE_CARD_GRADIENTS[
                  (activeCourseNumericId ?? 0) % HOME_COURSE_CARD_GRADIENTS.length
                ]
              } shadow-md`}
            >
              <HomeCourseIcon />
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="mb-1 font-heading text-lg font-bold leading-tight text-brand-gray-700">
                {resumeTitle}
              </h3>
              <p className="mb-3 text-sm text-brand-gray-400">{resumeNodeCount} nodes</p>

              <TopProgressBar progress={activeProgress} className="mb-2" />
              <p className="mb-4 text-xs font-semibold text-brand-gray-500">
                {activeProgress}% Complete
              </p>

              <div className="mt-auto">
                <Link href={`/courses/${activeCourseId}`}>
                  <GameButton className="w-full text-base">Resume</GameButton>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <p className="text-sm text-brand-gray-400">
              No generated course for this project yet.
            </p>
          </div>
        )}
      </div>
    </DeepGlassCard>
  );
}
