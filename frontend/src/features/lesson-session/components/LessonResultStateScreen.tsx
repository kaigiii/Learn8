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
      ? "rounded-3xl border border-amber-200 bg-white/85 px-6 py-5 text-sm text-brand-gray-700 shadow-lg backdrop-blur"
      : "w-full max-w-lg rounded-3xl border border-white/70 bg-white/85 px-6 py-6 text-brand-gray-700 shadow-lg backdrop-blur";

  return (
    <div className="relative min-h-screen app-shared-bg">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
        <div className={wrapperClass}>
          {loading && (
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-gray-200 border-t-brand-teal" />
          )}
          <h1 className="font-heading text-2xl font-extrabold text-brand-gray-700">{title}</h1>
          {description && (
            <p className="mt-3 text-sm text-brand-gray-500">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
