import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";
import Link from "next/link";

export default function ArenaPreviewPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#edf7fb] via-[#c9e6f2] to-[#a3d5e8]">
      <TopStatsBar backHref="/home" pageTitle="Arena" />

      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <DeepGlassCard className="px-7 py-8 md:px-10 md:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-teal">
            Future Surface
          </p>
          <h1 className="mt-3 font-heading text-4xl font-extrabold text-brand-gray-700 md:text-5xl">
            Arena Is Being Built As A Full Multiplayer System
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-brand-gray-500 md:text-base">
            The previous live battle prototype has been retired. This entry now points
            toward the future Arena platform: ranked play, private rooms, official-topic
            battles, richer player strength signals, and a tighter connection back into
            Learn8 lessons.
          </p>
        </DeepGlassCard>

        <div className="grid gap-6 md:grid-cols-2">
          <DeepGlassCard className="px-6 py-6">
            <h2 className="font-heading text-2xl font-bold text-brand-gray-700">
              Planned Capabilities
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-brand-gray-500">
              <li>Private rooms with room codes and host controls</li>
              <li>Ranked and casual official-topic battles for 2-8 players</li>
              <li>Player strength, rank badges, season progress, and history</li>
              <li>Post-match analysis that reconnects players to Learn8 lessons</li>
            </ul>
          </DeepGlassCard>

          <DeepGlassCard className="px-6 py-6">
            <h2 className="font-heading text-2xl font-bold text-brand-gray-700">
              Current Status
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-brand-gray-500">
              The production Arena experience has not been opened yet. We have
              intentionally removed the previous battle demo so the next release can
              launch on a clean, maintainable foundation.
            </p>

            <div className="mt-6">
              <Link href="/home">
                <GameButton className="w-full text-base">Back To Home</GameButton>
              </Link>
            </div>
          </DeepGlassCard>
        </div>
      </main>
    </div>
  );
}
