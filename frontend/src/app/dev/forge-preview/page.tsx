"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ForgeStatus from "@/components/feedback/ForgeStatus";
import GameButton from "@/components/ui/GameButton";

type PreviewVariant =
  | "questionnaire"
  | "syllabus"
  | "lesson"
  | "remedial"
  | "error";

const PREVIEW_VARIANTS: PreviewVariant[] = [
  "questionnaire",
  "syllabus",
  "lesson",
  "remedial",
  "error",
];

function getPreviewConfig(variant: PreviewVariant) {
  switch (variant) {
    case "syllabus":
      return {
        title: "Forging your personalised syllabus...",
        subtitle:
          "We are translating your answers into a learner profile and shaping a course path around it.",
        statusMessage: "Synthesising the next course arc for this learner...",
        progress: 58,
      };
    case "lesson":
      return {
        title: "Forging lesson stages...",
        subtitle:
          "We are assembling the next lesson node and preparing the interactive stages.",
        statusMessage: "Building practice stages and calibrating difficulty...",
        progress: 44,
      };
    case "remedial":
      return {
        title: "Generating your targeted remedial lesson...",
        subtitle:
          "We are shaping a shorter follow-up lesson around the stages you missed.",
        statusMessage: "Preparing a focused recovery path from the failed stages...",
        progress: 72,
      };
    case "error":
      return {
        title: "Generation interrupted",
        subtitle:
          "The generation paused after a disconnect or backend restart. Retry when you are ready.",
        statusMessage: "The background job stalled before the next update arrived.",
        progress: 36,
        error:
          "The background job stalled before the next update arrived.",
      };
    case "questionnaire":
    default:
      return {
        title: "Generating your personalised questionnaire...",
        subtitle:
          "We are analysing your topic and preparing a short set of questions to shape the course path.",
        statusMessage: "Shaping a tailored set of prompts for this course...",
        progress: 40,
      };
  }
}

function ForgePreviewPageContent() {
  const searchParams = useSearchParams();
  const variantParam = searchParams.get("variant");
  const variant = PREVIEW_VARIANTS.includes(variantParam as PreviewVariant)
    ? (variantParam as PreviewVariant)
    : "questionnaire";

  const preview = useMemo(() => getPreviewConfig(variant), [variant]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]">
      <main className="relative z-10 flex min-h-dvh flex-1 flex-col">
        <div className="flex flex-1 flex-col">
          <ForgeStatus
            error={preview.error}
            title={preview.title}
            subtitle={preview.subtitle}
            statusMessage={preview.statusMessage}
            progress={preview.progress}
            actions={
              <>
                <GameButton variant="secondary">Retry</GameButton>
                <GameButton variant="secondary">Cancel</GameButton>
              </>
            }
          />
        </div>
      </main>

      <div className="fixed bottom-4 left-4 z-30 rounded-3xl border border-[#9ecbd4]/20 bg-white/72 px-4 py-4 shadow-[0_20px_50px_rgba(97,163,184,0.18)] backdrop-blur-xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-brand-teal">
          Dev Preview
        </p>
        <div className="flex flex-wrap gap-2">
          {PREVIEW_VARIANTS.map((item) => (
            <Link
              key={item}
              href={`/dev/forge-preview?variant=${item}`}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                item === variant
                  ? "bg-brand-teal text-white shadow"
                  : "bg-white/70 text-brand-gray-600 hover:bg-white/90"
              }`}
            >
              {item}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ForgePreviewPage() {
  return (
    <Suspense fallback={null}>
      <ForgePreviewPageContent />
    </Suspense>
  );
}
