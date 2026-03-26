"use client";

export function HomeBackground() {
  const runeText =
    "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛝᛞᛟ";
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <svg
        viewBox="0 0 700 700"
        className="absolute -right-[180px] -bottom-[180px] h-[600px] w-[600px] opacity-20"
        fill="none"
      >
        <defs>
          <radialGradient id="dashPeach" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#FFF5EC" />
            <stop offset="60%" stopColor="#F5DECA" />
            <stop offset="100%" stopColor="#EDD0B5" />
          </radialGradient>
          <path id="dashRune" d="M 350,350 m -260,0 a 260,260 0 1,1 520,0 a 260,260 0 1,1 -520,0" />
        </defs>
        <circle cx="350" cy="350" r="300" fill="url(#dashPeach)" opacity="0.5" />
        <circle cx="350" cy="350" r="290" fill="none" stroke="#D4BC8B" strokeWidth="1" opacity="0.4" />
        <circle cx="350" cy="350" r="248" fill="none" stroke="#D4BC8B" strokeWidth="1" opacity="0.4" />
        <text fill="#C4A87A" fontSize="18" fontWeight="500" letterSpacing="4" opacity="0.35">
          <textPath href="#dashRune">{runeText}</textPath>
        </text>
      </svg>

      <svg viewBox="0 0 40 40" className="absolute bottom-8 right-8 h-7 w-7" fill="none">
        <path d="M20 0 L22 16 L40 20 L22 22 L20 40 L18 22 L0 20 L18 16 Z" fill="#D4A96A" opacity="0.5" />
      </svg>
    </div>
  );
}
