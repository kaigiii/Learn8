"use client";

export function CourseMapBackground() {
  return <MapBackgroundGlow />;
}

function MapBackgroundGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <svg
        viewBox="0 0 700 700"
        className="absolute -right-[160px] -bottom-[160px] h-[520px] w-[520px] opacity-[0.08]"
        fill="none"
      >
        <defs>
          <radialGradient id="mapPeach" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#D4EEE8" />
            <stop offset="60%" stopColor="#B5DDD4" />
            <stop offset="100%" stopColor="#9ACEC3" />
          </radialGradient>
          <path id="mapRune" d="M 350,350 m -260,0 a 260,260 0 1,1 520,0 a 260,260 0 1,1 -520,0" />
        </defs>
        <circle cx="350" cy="350" r="300" fill="url(#mapPeach)" opacity="0.5" />
        <circle cx="350" cy="350" r="290" fill="none" stroke="#7AC7C4" strokeWidth="1" opacity="0.3" />
        <circle cx="350" cy="350" r="240" fill="none" stroke="#7AC7C4" strokeWidth="0.5" opacity="0.2" strokeDasharray="8 6" />
        <text fill="#7AC7C4" fontSize="18" fontWeight="500" letterSpacing="4" opacity="0.3">
          <textPath href="#mapRune">
            ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟ
          </textPath>
        </text>
      </svg>

      <div
        className="absolute -left-[100px] -top-[100px] h-[400px] w-[400px] rounded-full opacity-[0.06]"
        style={{ background: "radial-gradient(circle, rgba(122,199,196,0.6) 0%, transparent 70%)" }}
      />

      <div
        className="absolute right-[5%] top-[35%] h-[200px] w-[200px] rounded-full opacity-[0.05]"
        style={{ background: "radial-gradient(circle, rgba(212,238,232,0.8) 0%, transparent 75%)" }}
      />
    </div>
  );
}
