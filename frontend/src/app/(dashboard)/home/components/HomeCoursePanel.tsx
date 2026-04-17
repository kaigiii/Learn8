"use client";

import Link from "next/link";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import TopProgressBar from "@/components/ui/TopProgressBar";
import { HomeCourseIcon } from "./HomeCourseIcon";
import { HOME_COURSE_CARD_GRADIENTS } from "../visuals";

interface HomeCoursePanelProps {
  name: string;
  hasResumeCourse: boolean;
  activeCourseId: string | null;
  activeCourseNumericId: number | null;
  resumeTitle: string;
  resumeNodeCount: number;
  activeProgress: number;
}

export function HomeCoursePanel({
  name,
  hasResumeCourse,
  activeCourseId,
  activeCourseNumericId,
  resumeTitle,
  resumeNodeCount,
  activeProgress,
}: HomeCoursePanelProps) {
  return (
    <DeepGlassCard className="h-full min-h-[400px] px-7 py-7 md:px-8 md:py-8">
      <div className="flex h-full flex-col">
        <h2 className="mb-1 font-heading text-3xl font-extrabold text-brand-gray-700 md:text-4xl">
          Welcome back, {name}!
        </h2>
        <p className="mt-3 mb-7 text-lg text-brand-gray-400 md:text-xl">Continue your course</p>

        {hasResumeCourse ? (
          <div className="mt-auto translate-y-4 flex items-start gap-5 rounded-2xl border border-[#9ecbd4]/18 bg-white/46 p-5 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm md:translate-y-6">
            <div
                className={`shrink-0 flex h-36 w-32 items-center justify-center rounded-xl bg-gradient-to-br ${
                HOME_COURSE_CARD_GRADIENTS[
                  (activeCourseNumericId ?? 0) % HOME_COURSE_CARD_GRADIENTS.length
                ]
              } shadow-md`}
            >
              <HomeCourseIcon progress={activeProgress} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="mb-1 font-heading text-xl font-bold leading-tight text-brand-gray-700">
                {resumeTitle}
              </h3>
              <p className="mb-3 text-base text-brand-gray-400">{resumeNodeCount} nodes</p>

              <TopProgressBar progress={activeProgress} className="mb-2" />
              <p className="mb-4 text-xs font-semibold text-brand-gray-500">
                {activeProgress}% Complete
              </p>

              <div className="mt-auto">
                <Link href={`/courses/${activeCourseId}`}>
                  <GameButton variant="secondary" className="w-full text-lg">Resume</GameButton>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-auto translate-y-4 flex flex-col rounded-2xl border border-[#9ecbd4]/18 bg-white/46 p-4 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm md:translate-y-6">
            <p className="text-sm text-brand-gray-400">
              No active course ready yet.
            </p>
          </div>
        )}
      </div>
    </DeepGlassCard>
  );
}
