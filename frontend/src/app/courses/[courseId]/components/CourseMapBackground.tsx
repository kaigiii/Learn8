"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

export function CourseMapBackground() {
  return (
    <>
      <MapBackgroundGlow />
      <MapFloatingParticles />
    </>
  );
}

function MapFloatingParticles() {
  const [viewportHeight, setViewportHeight] = useState(900);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewportHeight = () => {
      setViewportHeight(window.innerHeight + 40);
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        id: index,
        x: 5 + Math.random() * 90,
        size: 3 + Math.random() * 5,
        delay: Math.random() * 8,
        duration: 10 + Math.random() * 12,
        opacity: 0.08 + Math.random() * 0.15,
        type: index % 4,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden="true">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute"
          style={{ left: `${particle.x}%`, bottom: -20 }}
          animate={{
            y: [0, -viewportHeight],
            x: [0, (particle.id % 2 === 0 ? 1 : -1) * (15 + Math.random() * 25)],
            rotate: [0, 180 + Math.random() * 180],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {particle.type === 0 && (
            <div
              className="rounded-full bg-brand-teal"
              style={{ width: particle.size, height: particle.size, opacity: particle.opacity }}
            />
          )}
          {particle.type === 1 && (
            <div
              className="rounded-full border border-brand-teal"
              style={{
                width: particle.size * 1.5,
                height: particle.size * 1.5,
                opacity: particle.opacity,
              }}
            />
          )}
          {particle.type === 2 && (
            <div
              className="bg-amber-400"
              style={{
                width: particle.size,
                height: particle.size,
                opacity: particle.opacity,
                transform: "rotate(45deg)",
                borderRadius: 1,
              }}
            />
          )}
          {particle.type === 3 && (
            <svg
              viewBox="0 0 24 24"
              fill="#7AC7C4"
              style={{
                width: particle.size * 1.8,
                height: particle.size * 1.8,
                opacity: particle.opacity,
              }}
            >
              <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
            </svg>
          )}
        </motion.div>
      ))}

      {Array.from({ length: 14 }, (_, index) => (
        <motion.div
          key={`sparkle-${index}`}
          className="absolute rounded-full bg-white"
          style={{
            width: 2 + Math.random() * 3,
            height: 2 + Math.random() * 3,
            left: `${8 + Math.random() * 84}%`,
            top: `${10 + Math.random() * 80}%`,
          }}
          animate={{ opacity: [0, 0.4, 0], scale: [0.5, 1.2, 0.5] }}
          transition={{
            duration: 2 + Math.random() * 3,
            delay: Math.random() * 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
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
