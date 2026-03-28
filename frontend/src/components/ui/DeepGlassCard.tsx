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
      className={`relative rounded-3xl border border-[#9ecbd4]/20 bg-white/56 backdrop-blur-xl shadow-[0_24px_70px_rgba(97,163,184,0.16)] ${className}`}
      {...props}
    >
      {/* Inner highlight edge */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/18 via-transparent to-transparent" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
