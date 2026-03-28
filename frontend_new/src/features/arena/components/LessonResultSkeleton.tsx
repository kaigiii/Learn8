"use client";

export function LessonResultSkeleton() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f0f23]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,215,0,0.12) 0%, rgba(255,180,50,0.05) 40%, transparent 70%)",
        }}
      />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <div className="mb-6 h-12 w-72 animate-pulse rounded-3xl bg-white/10" />
        <div className="mb-8 h-48 w-48 animate-pulse rounded-full bg-white/10 shadow-[0_0_80px_rgba(255,215,0,0.08)]" />
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur">
          <div className="mb-5 grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="text-center">
                <div className="mx-auto mb-2 h-3 w-14 animate-pulse rounded-full bg-white/10" />
                <div className="mx-auto h-8 w-20 animate-pulse rounded-2xl bg-white/15" />
              </div>
            ))}
          </div>
          <div className="mb-2 flex items-center justify-between">
            <div className="h-3 w-10 animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-10 animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="h-5 w-full animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="mt-6 h-14 w-full max-w-lg animate-pulse rounded-2xl bg-brand-green/30" />
      </div>
    </div>
  );
}
