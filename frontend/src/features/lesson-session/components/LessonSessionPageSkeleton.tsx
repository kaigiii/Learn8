"use client";

export function LessonSessionPageSkeleton() {
  return (
    <div className="flex flex-1 gap-8 px-8 pb-4">
      <div className="flex flex-1 flex-col min-w-0">
        <div className="rounded-[30px] border border-white/50 bg-white/60 p-8 shadow-lg shadow-teal-200/15 backdrop-blur-xl">
          <div className="mb-5 h-4 w-28 animate-pulse rounded-full bg-brand-teal/15" />
          <div className="mb-4 h-10 w-4/5 animate-pulse rounded-3xl bg-brand-gray-200/70" />
          <div className="mb-2 h-4 w-full animate-pulse rounded-full bg-brand-gray-100/90" />
          <div className="mb-2 h-4 w-11/12 animate-pulse rounded-full bg-brand-gray-100/80" />
          <div className="h-4 w-8/12 animate-pulse rounded-full bg-brand-gray-100/70" />

          <div className="mt-8 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-3xl border border-white/70 bg-white/75 px-5 py-4"
              >
                <div className="h-5 w-5 animate-pulse rounded-full bg-brand-gray-200/80" />
                <div className="h-4 flex-1 animate-pulse rounded-full bg-brand-gray-100/90" />
              </div>
            ))}
          </div>

          <div className="mt-8 h-14 w-48 animate-pulse rounded-2xl bg-brand-teal/20" />
        </div>
      </div>

      <div className="w-[360px] flex-shrink-0 pt-2">
        <div
          className="overflow-hidden rounded-3xl border border-white/50 bg-white/60 shadow-lg shadow-teal-200/15 backdrop-blur-xl"
          style={{ height: "calc(100vh - 80px)" }}
        >
          <div className="flex items-center gap-3 px-6 pt-6 pb-4">
            <div className="h-14 w-14 animate-pulse rounded-full bg-brand-teal/15" />
            <div className="flex-1">
              <div className="mb-2 h-4 w-32 animate-pulse rounded-full bg-brand-gray-200/80" />
              <div className="h-3 w-40 animate-pulse rounded-full bg-brand-gray-100/80" />
            </div>
          </div>
          <div className="space-y-3 px-5 pb-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={`h-12 animate-pulse rounded-2xl ${
                  index % 2 === 0
                    ? "w-[78%] bg-white/75"
                    : "ml-auto w-[62%] bg-brand-teal/15"
                }`}
              />
            ))}
          </div>
          <div className="mx-5 mt-auto h-px bg-gradient-to-r from-transparent via-brand-teal/20 to-transparent" />
          <div className="flex gap-2 px-5 py-3">
            <div className="h-10 flex-1 animate-pulse rounded-xl bg-white/75" />
            <div className="h-10 w-10 animate-pulse rounded-xl bg-white/75" />
            <div className="h-10 w-10 animate-pulse rounded-xl bg-brand-teal/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
