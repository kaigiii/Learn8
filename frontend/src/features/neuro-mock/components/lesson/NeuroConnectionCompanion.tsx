"use client";

import { motion } from "framer-motion";

type NeuroConnectionCompanionProps = {
  step: number;
  reduced?: boolean;
};

/** The established Learn8 mascot, surrounded by a purpose-built SVG connection sequence. */
export function NeuroConnectionCompanion({ step, reduced = false }: NeuroConnectionCompanionProps) {
  const wearing = step >= 1 || reduced;
  const placing = step === 1 && !reduced;
  const aligning = step >= 2 || reduced;
  const calibrated = step >= 3 || reduced;
  const ready = step >= 4 || reduced;
  const loop = (duration: number) => ({ duration: reduced ? 0 : duration, repeat: reduced ? 0 : Infinity, ease: "easeInOut" as const });

  return <motion.svg viewBox="0 0 560 420" role="img" aria-label="學習夥伴戴上 Neuro Link 頭帶並校準四個接點" className="h-full w-full overflow-visible">
    <defs>
      <linearGradient id="companion-band" x1="165" y1="120" x2="395" y2="152" gradientUnits="userSpaceOnUse"><stop stopColor="#408E91" /><stop offset=".48" stopColor="#7AC7C4" /><stop offset="1" stopColor="#408E91" /></linearGradient>
      <filter id="companion-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="7" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    </defs>

    <motion.g aria-hidden="true" initial={{ opacity: 0, scale: .72 }} animate={{ opacity: wearing ? .9 : .25, scale: 1 }} transition={{ duration: reduced ? 0 : .8 }}>
      {[128, 166, 204].map((radius, index) => <motion.circle key={radius} cx="280" cy="211" r={radius} fill="none" stroke={index === 1 ? "#58CC02" : "#7AC7C4"} strokeWidth={index === 1 ? "1.5" : "1"} strokeDasharray={index === 1 ? "5 7" : undefined} style={{ transformOrigin: "280px 211px" }} animate={reduced ? {} : { rotate: index % 2 ? -360 : 360, opacity: [.18, .58, .18] }} transition={loop(14 + index * 4)} opacity=".35" />)}
    </motion.g>


    <g transform="translate(-280 -210) scale(2)">
      <motion.g initial={{ opacity: 0, y: -34, scale: .86 }} animate={reduced ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: wearing ? [0, -3, 0] : -22, scale: 1 }} transition={wearing && !reduced ? loop(3.8) : { type: "spring", damping: 15, stiffness: 105 }}>
        <ellipse cx="280" cy="347" rx="116" ry="16" fill="#245B5F" opacity=".14" />
        <motion.circle cx="280" cy="211" r="126" fill="#D8FFFA" initial={{ opacity: 0, scale: .65 }} animate={wearing ? { opacity: [.08, .28, .08], scale: [1, 1.08, 1] } : { opacity: .04, scale: .85 }} transition={loop(3.4)} />
        <image href="/neuro-link-mascot.webp" x="110" y="10" width="340" height="385" preserveAspectRatio="xMidYMid meet" />

        <motion.g initial={{ opacity: 0, y: -128, rotate: -15, scale: .9 }} animate={reduced ? { opacity: 1, y: -12, rotate: 0, scale: 1 } : !wearing ? { opacity: .12, y: -96, rotate: -10, scale: .9 } : placing ? { opacity: 1, y: [-120, 3, -21, -12], rotate: [-15, 5, -2, 0], scale: [.9, 1.06, .98, 1] } : { opacity: 1, y: [-12, -14, -12], rotate: 0, scale: 1 }} transition={placing ? { duration: 1.35, times: [0, .58, .8, 1], ease: "easeOut" } : wearing ? loop(3.8) : { duration: .45 }}>
          <path d="M208 158 Q212 113 243 111 Q280 127 317 111 Q348 113 352 158" fill="none" stroke="#0D2E33" strokeWidth="18" strokeLinecap="round" opacity=".28" />
          <path d="M208 153 Q212 108 243 106 Q280 122 317 106 Q348 108 352 153" fill="none" stroke="#EDF9F7" strokeWidth="14" strokeLinecap="round" />
          <path d="M210 150 Q214 112 243 111 Q280 125 317 111 Q346 112 350 150" fill="none" stroke="#2D7B7E" strokeWidth="8" strokeLinecap="round" opacity=".98" />
          <path d="M226 133 Q280 150 334 133" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity=".92" />
          <motion.path d="M218 137 Q280 157 342 137" fill="none" stroke="#E5FFFC" strokeWidth="2" strokeLinecap="round" strokeDasharray="8 20" animate={aligning && !reduced ? { strokeDashoffset: [0, -84] } : { strokeDashoffset: 0 }} transition={loop(1.35)} opacity={aligning ? .95 : .25} />
          <motion.path d="M224 122 Q280 145 336 122" fill="none" stroke="#58CC02" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 5" initial={{ pathLength: 0, opacity: 0 }} animate={aligning ? { pathLength: 1, opacity: [.18, .8, .18] } : { pathLength: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : 1.6, repeat: aligning && !reduced ? Infinity : 0, repeatDelay: .35 }} />
          <motion.path d="M213 149 C204 159 204 177 214 187" fill="none" stroke="#E8F7F4" strokeWidth="9" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: wearing ? 1 : 0 }} transition={{ duration: reduced ? 0 : .4, delay: reduced ? 0 : .82 }} />
          <motion.path d="M213 149 C204 159 204 177 214 187" fill="none" stroke="#24585C" strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: wearing ? 1 : 0 }} transition={{ duration: reduced ? 0 : .4, delay: reduced ? 0 : .82 }} />
          <motion.path d="M347 149 C356 159 356 177 346 187" fill="none" stroke="#E8F7F4" strokeWidth="9" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: wearing ? 1 : 0 }} transition={{ duration: reduced ? 0 : .4, delay: reduced ? 0 : .9 }} />
          <motion.path d="M347 149 C356 159 356 177 346 187" fill="none" stroke="#24585C" strokeWidth="5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: wearing ? 1 : 0 }} transition={{ duration: reduced ? 0 : .4, delay: reduced ? 0 : .9 }} />
          <motion.rect x="257" y="101" width="46" height="23" rx="11.5" fill="#143E43" stroke="#FFFFFF" strokeWidth="3" animate={aligning && !reduced ? { filter: ["brightness(1)", "brightness(1.35)", "brightness(1)"] } : {}} transition={loop(1.7)} />
          <rect x="261" y="105" width="38" height="15" rx="7.5" fill="#D8F1EC" />
          <motion.path d="M269 113 H274 L277 108 L281 117 L286 111 L291 113" fill="none" stroke="#31575A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: aligning ? 1 : 0 }} transition={{ duration: reduced ? 0 : .5, delay: reduced ? 0 : .38 }} />
          {[244, 280, 316].map((x, index) => <motion.circle key={x} cx={x} cy="121" r="2.4" fill="#58CC02" initial={{ opacity: 0, scale: .2 }} animate={aligning ? { opacity: [0, 1, .35, 1], scale: [.4, 1.35, .75, 1] } : { opacity: 0, scale: .2 }} transition={{ duration: reduced ? 0 : 1.25, delay: reduced ? 0 : index * .18, repeat: aligning && !reduced ? Infinity : 0, repeatDelay: .45 }} />)}
          <circle cx="228" cy="139" r="5" fill="#152A2E" stroke="#A2C4C0" strokeWidth="1.5" /><circle cx="332" cy="139" r="5" fill="#152A2E" stroke="#A2C4C0" strokeWidth="1.5" />
          <ellipse cx="214" cy="187" rx="7" ry="9" fill="#22383B" stroke="#89AAA7" strokeWidth="1.5" /><ellipse cx="346" cy="187" rx="7" ry="9" fill="#22383B" stroke="#89AAA7" strokeWidth="1.5" />
        </motion.g>
        <motion.circle cx="280" cy="113" r="32" fill="none" stroke="#7AC7C4" strokeWidth="1.4" initial={{ opacity: 0, scale: .3 }} animate={aligning ? { opacity: [0, .8, 0], scale: [.3, 1.8, 2.3] } : { opacity: 0, scale: .3 }} transition={{ duration: reduced ? 0 : 1.25, repeat: aligning && !reduced ? Infinity : 0, repeatDelay: .7 }} />
      </motion.g>

      {[
      { id: "TP9", x: 214, y: 175, lx: 76, ly: 121 },
      { id: "AF7", x: 246, y: 116, lx: 150, ly: 70 },
      { id: "AF8", x: 314, y: 116, lx: 365, ly: 70 },
      { id: "TP10", x: 346, y: 175, lx: 433, ly: 121 },
      ].map((contact, index) => {
      const active = calibrated || step >= index + 2;
        return <motion.g key={contact.id} initial={{ opacity: 0, scale: .3 }} animate={{ opacity: active ? 1 : .22, scale: active && !reduced ? [1, 1.15, 1] : 1 }} transition={{ duration: reduced ? 0 : .48, delay: reduced ? 0 : index * .28 }}>
          <path d={`M${contact.x} ${contact.y} L${contact.lx + 25} ${contact.ly + 8}`} fill="none" stroke="#408E91" strokeWidth="1.5" strokeDasharray="3 4" opacity=".75" />
          <motion.circle cx={contact.x} cy={contact.y} r="13" fill="#7AC7C4" fillOpacity=".2" stroke="#7AC7C4" strokeWidth="2.5" animate={active && !reduced ? { r: [9, 14, 9], opacity: [.7, 1, .7] } : {}} transition={loop(1.45 + index * .1)} filter={active ? "url(#companion-glow)" : undefined} />
          <circle cx={contact.x} cy={contact.y} r="4" fill={active ? "#58CC02" : "#7AC7C4"} />
          <circle cx={contact.x} cy={contact.y} r="2" fill="#F1FFFD" opacity=".9" />
        </motion.g>;
      })}
    </g>

  </motion.svg>;
}
