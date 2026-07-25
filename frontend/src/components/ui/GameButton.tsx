"use client";

import React from "react";

interface GameButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  pulse?: boolean;
}

export default function GameButton({
  children,
  variant = "primary",
  pulse = false,
  className = "",
  ...props
}: GameButtonProps) {
  const base =
    "relative font-heading font-bold uppercase tracking-wider rounded-xl px-8 py-3.5 shadow-lg transition-all duration-200 active:translate-y-0.5 active:shadow-md disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    primary:
      "bg-gradient-to-b from-[#7AC7C4] to-[#5fb3af] hover:from-[#88d1ce] hover:to-[#6bbdb9] border-b-4 border-[#4a9e9a] text-white",
    secondary:
      "bg-white border-2 border-b-4 border-brand-gray-200 hover:bg-brand-gray-50 hover:border-brand-gray-300 text-brand-gray-500 active:border-b-2",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${pulse ? "animate-pulse-subtle" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
