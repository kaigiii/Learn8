"use client";

import Link from "next/link";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import GameButton from "@/components/ui/GameButton";

export function HomeDuoPanel() {
  return (
    <DeepGlassCard className="h-full min-h-[360px] px-6 py-6 md:px-7 md:py-7">
      <div className="flex h-full flex-col">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 md:text-3xl">
              Duo Arena
            </h2>
            <p className="mt-1 text-sm text-brand-gray-400">
              Launch the separate live battle experience.
            </p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-inner">
            <DuoIcon />
          </div>
        </div>

        <div className="flex-1 rounded-2xl border border-[#9ecbd4]/18 bg-white/46 p-4 shadow-[0_12px_30px_rgba(97,163,184,0.10)] backdrop-blur-sm">
          <p className="text-sm leading-relaxed text-brand-gray-500">
            Use this entry when you want the deployed two-player mode. It stays separate from the Learn8 backend flow.
          </p>
        </div>

        <Link href="/duo" className="mt-4">
          <GameButton className="w-full text-base">Enter Duo</GameButton>
        </Link>
      </div>
    </DeepGlassCard>
  );
}

function DuoIcon() {
  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" fill="none">
      <circle cx="28" cy="28" r="10" fill="#64748B" opacity="0.35" />
      <circle cx="52" cy="28" r="10" fill="#334155" opacity="0.35" />
      <rect x="16" y="42" width="24" height="20" rx="10" fill="#64748B" opacity="0.45" />
      <rect x="40" y="42" width="24" height="20" rx="10" fill="#334155" opacity="0.45" />
      <circle cx="40" cy="36" r="4" fill="#0F172A" opacity="0.55" />
    </svg>
  );
}
