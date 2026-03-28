"use client";

export function ProfileStatBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-gradient-to-b from-white/60 to-brand-gray-50 border border-brand-gray-100 rounded-xl px-2 py-3 text-center">
      <p className="text-[10px] text-brand-gray-400 leading-tight mb-1">{label}</p>
      <p className="font-heading font-extrabold text-brand-gray-700 text-sm">
        {value}
      </p>
    </div>
  );
}
