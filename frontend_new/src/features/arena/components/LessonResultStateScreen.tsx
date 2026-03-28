"use client";

interface LessonResultStateScreenProps {
  title: string;
  description?: string;
  tone?: "neutral" | "warning";
  loading?: boolean;
}

export function LessonResultStateScreen({
  title,
  description,
  tone = "neutral",
  loading = false,
}: LessonResultStateScreenProps) {
  const wrapperClass =
    tone === "warning"
      ? "rounded-3xl border border-amber-200 bg-white/10 px-6 py-5 text-sm text-white shadow-lg backdrop-blur"
      : "w-full max-w-lg rounded-3xl border border-white/10 bg-white/10 px-6 py-6 text-white shadow-lg backdrop-blur";

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#0f0f23]">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
        <div className={wrapperClass}>
          {loading && (
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-yellow-300" />
          )}
          <h1 className="font-heading text-2xl font-extrabold text-white">{title}</h1>
          {description && (
            <p className="mt-3 text-sm text-white/70">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
