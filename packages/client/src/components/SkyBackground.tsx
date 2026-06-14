import React, { useMemo } from "react";

function buildStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    x: ((Math.sin(i * 2.399) + 1) / 2) * 100,
    y: ((Math.cos(i * 3.711) + 1) / 2) * 60,
    size: 0.8 + (i % 4) * 0.35,
    opacity: 0.18 + (i % 6) * 0.07,
    twinkle: i % 3 === 0,
    delay: (i % 8) * 0.9,
  }));
}

interface Props {
  profileColor?: string;
}

export function SkyBackground({ profileColor }: Props) {
  const stars = useMemo(() => buildStars(90), []);

  return (
    <div aria-hidden style={{
      position: "absolute", inset: 0,
      overflow: "hidden", pointerEvents: "none", zIndex: 0,
    }}>
      {/* ── Base sky gradient ─────────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          linear-gradient(180deg,
            #07090F 0%,
            #0C0E17 10%,
            #11141F 22%,
            #171B28 36%,
            #1D2232 50%,
            #242A3B 64%,
            #2E3547 76%,
            #3A4054 85%,
            rgba(140,150,175,0.35) 93%,
            rgba(210,216,232,0.12) 100%
          )
        `,
      }} />

      {/* ── Profile color ambient glow ────────────────────────────── */}
      {profileColor && (
        <div style={{
          position: "absolute", top: "-5%", right: "10%",
          width: 600, height: 400, borderRadius: "50%",
          background: `radial-gradient(circle, ${profileColor}0D 0%, transparent 65%)`,
          filter: "blur(40px)",
          animation: "aurora 14s ease-in-out infinite",
        }} />
      )}

      {/* ── Aurora bands ─────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: "6%", left: "-10%", right: "-10%",
        height: 200,
        background: "linear-gradient(180deg, transparent, rgba(100,120,200,0.05) 40%, rgba(80,100,180,0.04) 70%, transparent)",
        filter: "blur(28px)",
        animation: "aurora 14s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", top: "20%", left: "15%", right: "-15%",
        height: 140,
        background: "linear-gradient(180deg, transparent, rgba(120,100,200,0.04) 50%, transparent)",
        filter: "blur(36px)",
        animation: "aurora 20s ease-in-out infinite reverse",
      }} />

      {/* ── Stars ────────────────────────────────────────────────── */}
      {stars.map((s, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          borderRadius: "50%",
          background: "white",
          opacity: s.opacity,
          boxShadow: s.twinkle ? `0 0 ${s.size * 3}px rgba(200,210,240,0.7)` : "none",
          animation: s.twinkle ? `blink ${3 + s.delay}s ease-in-out infinite` : "none",
          animationDelay: `${s.delay}s`,
        }} />
      ))}

      {/* ── Cloud mass — bottom left ──────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: -100, left: "-5%",
        width: "60%", height: 320,
        background: "radial-gradient(ellipse 100% 80% at 40% 85%, rgba(200,210,230,0.10) 0%, rgba(170,180,210,0.05) 50%, transparent 80%)",
        filter: "blur(52px)",
        animation: "cloudDrift 40s ease-in-out infinite",
      }} />

      {/* ── Cloud mass — bottom right ─────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: -60, right: "-5%",
        width: "50%", height: 260,
        background: "radial-gradient(ellipse 100% 80% at 60% 80%, rgba(190,200,225,0.08) 0%, rgba(160,172,200,0.03) 55%, transparent 80%)",
        filter: "blur(60px)",
        animation: "cloudDrift 55s ease-in-out infinite reverse",
      }} />

      {/* ── Bright horizon glow ───────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: -20, left: "20%", right: "20%",
        height: 180,
        background: "radial-gradient(ellipse at 50% 100%, rgba(220,228,248,0.08) 0%, transparent 70%)",
        filter: "blur(32px)",
      }} />

      {/* ── Vignette ─────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 45%, rgba(0,0,0,0.5) 100%)",
      }} />
    </div>
  );
}
