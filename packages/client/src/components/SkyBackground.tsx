import React, { useMemo } from "react";

// Deterministic star positions — same every render
function buildStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    x: ((Math.sin(i * 2.399) + 1) / 2) * 100,
    y: ((Math.cos(i * 3.711) + 1) / 2) * 55,   // only top 55% of screen
    size: 0.8 + (i % 4) * 0.35,
    opacity: 0.15 + (i % 6) * 0.07,
    twinkle: i % 3 === 0,
    delay: (i % 8) * 0.9,
  }));
}

export function SkyBackground() {
  const stars = useMemo(() => buildStars(80), []);

  return (
    <div aria-hidden style={{
      position: "absolute", inset: 0,
      overflow: "hidden", pointerEvents: "none",
      zIndex: 0,
    }}>

      {/* ── Sky gradient ─────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          linear-gradient(180deg,
            #08090B 0%,
            #0E1013 12%,
            #16181C 26%,
            #1E2126 42%,
            #262A30 58%,
            #2F343B 70%,
            #3C4148 80%,
            rgba(120,128,138,0.4) 89%,
            rgba(205,212,222,0.18) 95%,
            rgba(228,233,239,0.08) 100%
          )
        `,
      }} />

      {/* ── Aurora bands ─────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: "8%", left: "-10%", right: "-10%",
        height: 180,
        background: "linear-gradient(180deg, transparent, rgba(220,224,230,0.06) 40%, rgba(200,206,214,0.05) 70%, transparent)",
        filter: "blur(24px)",
        animation: "aurora 12s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", top: "18%", left: "20%", right: "-20%",
        height: 120,
        background: "linear-gradient(180deg, transparent, rgba(210,215,222,0.04) 50%, transparent)",
        filter: "blur(32px)",
        animation: "aurora 18s ease-in-out infinite reverse",
      }} />

      {/* ── Stars ────────────────────────────────────────────────────── */}
      {stars.map((s, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          borderRadius: "50%",
          background: "white",
          opacity: s.opacity,
          boxShadow: s.twinkle ? `0 0 ${s.size * 3}px rgba(240,243,247,0.6)` : "none",
          animation: s.twinkle ? `blink ${3 + s.delay}s ease-in-out infinite` : "none",
          animationDelay: `${s.delay}s`,
        }} />
      ))}

      {/* ── Cloud mass — bottom left ──────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: -120, left: "-8%",
        width: "65%", height: 340,
        background: "radial-gradient(ellipse 100% 80% at 40% 85%, rgba(225,229,235,0.11) 0%, rgba(195,201,210,0.06) 50%, transparent 80%)",
        filter: "blur(48px)",
        animation: "cloudDrift 38s ease-in-out infinite",
      }} />

      {/* ── Cloud mass — bottom right ─────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: -80, right: "-5%",
        width: "55%", height: 280,
        background: "radial-gradient(ellipse 100% 80% at 60% 80%, rgba(215,219,226,0.09) 0%, rgba(185,191,200,0.04) 55%, transparent 80%)",
        filter: "blur(56px)",
        animation: "cloudDrift 52s ease-in-out infinite reverse",
      }} />

      {/* ── Bright cloud highlight — mid bottom ──────────────────────── */}
      <div style={{
        position: "absolute", bottom: -30, left: "25%", right: "25%",
        height: 160,
        background: "radial-gradient(ellipse at 50% 100%, rgba(232,236,241,0.1) 0%, transparent 70%)",
        filter: "blur(30px)",
      }} />

      {/* ── Sun glow — upper left ─────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: "-10%", left: "15%",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(245,247,250,0.06) 0%, rgba(210,215,222,0.03) 35%, transparent 65%)",
        filter: "blur(40px)",
        animation: "aurora 20s ease-in-out infinite",
      }} />

      {/* ── Vignette edges ───────────────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 110% 110% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
      }} />
    </div>
  );
}
