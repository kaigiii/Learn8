"use client";

import Link from "next/link";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import TopProgressBar from "@/components/ui/TopProgressBar";
import {
  DEFAULT_LIBRARY_BACKGROUNDS,
  resolveCourseCardBackground,
} from "@/lib/courseCardBackground";
import { useI18n } from "@/lib/i18n/useI18n";
import { HomeCourseIcon } from "./HomeCourseIcon";

const LIB_BG_IMAGES = DEFAULT_LIBRARY_BACKGROUNDS;

interface HomeCoursePanelProps {
  name: string;
  hasResumeCourse: boolean;
  activeCourseId: string | null;
  activeCourseNumericId: number | null;
  resumeLibraryIndex: number;
  resumeTitle: string;
  resumeNodeCount: number;
  activeProgress: number;
}

export function HomeCoursePanel({
  name,
  hasResumeCourse,
  activeCourseId,
  activeCourseNumericId,
  resumeLibraryIndex,
  resumeTitle,
  resumeNodeCount,
  activeProgress,
}: HomeCoursePanelProps) {
  const { t } = useI18n();
  const resumeBackgroundImage = resolveCourseCardBackground(
    activeCourseNumericId ?? activeCourseId ?? resumeTitle ?? resumeLibraryIndex,
    LIB_BG_IMAGES
  );

  return (
    <DeepGlassCard className="h-full min-h-[400px] px-7 py-7 md:px-8 md:py-8">
      <div className="flex h-full flex-col">
        <h2 className="mb-1 font-heading text-3xl font-extrabold text-brand-gray-700 md:text-4xl">
          {t("dashboard.welcomeBack", { name })}
        </h2>
        <p className="mt-3 mb-7 text-lg text-brand-gray-700 md:text-xl">{t("dashboard.continueYourCourse")}</p>

        {hasResumeCourse ? (
          <div className="flex items-start gap-5 rounded-2xl border border-[#9ecbd4]/18 bg-white/46 p-5 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm">
            <div
              className="shrink-0 flex h-36 w-32 items-center justify-center rounded-xl bg-cover bg-center bg-no-repeat shadow-md"
              style={{ backgroundImage: `url(${resumeBackgroundImage})` }}
            >
              <HomeCourseIcon progress={activeProgress} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <h3 className="mb-1 font-heading text-xl font-bold leading-tight text-brand-gray-700">
                {resumeTitle}
              </h3>
              <p className="mb-3 text-base text-brand-gray-400">{t("dashboard.nodes", { count: resumeNodeCount })}</p>

              <TopProgressBar progress={activeProgress} className="mb-2" />
              <p className="mb-4 text-xs font-semibold text-brand-gray-500">
                {t("dashboard.progressComplete", { progress: activeProgress })}
              </p>

              <div className="mt-auto">
                <Link href={`/courses/${activeCourseId}`}>
                  <GameButton variant="secondary" className="w-full text-lg">{t("dashboard.resume")}</GameButton>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col rounded-2xl border border-[#9ecbd4]/18 bg-white/46 p-4 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm">
            <p className="text-sm text-brand-gray-400">
              {t("dashboard.noActiveCourse")}
            </p>
          </div>
        )}
      </div>
    </DeepGlassCard>
  );
}
