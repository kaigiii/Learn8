"use client";

export function ProfileToggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        on ? "bg-brand-teal" : "bg-brand-gray-200"
      }`}
    >
      <span
        className="inline-block rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{
          width: "18px",
          height: "18px",
          transform: on ? "translateX(22px)" : "translateX(3px)",
        }}
      />
    </button>
  );
}
