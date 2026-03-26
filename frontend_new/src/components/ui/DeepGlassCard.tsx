import React from "react";

interface DeepGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export default function DeepGlassCard({
  children,
  className = "",
  ...props
}: DeepGlassCardProps) {
  return (
    <div
      className={`relative rounded-3xl border border-white/40 bg-white/60 backdrop-blur-xl shadow-2xl ring-1 ring-white/20 ${className}`}
      {...props}
    >
      {/* Inner highlight edge */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/30 via-transparent to-transparent" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
