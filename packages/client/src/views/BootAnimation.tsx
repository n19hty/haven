import React, { useState, useEffect } from "react";
import { SkyBackground } from "../components/SkyBackground";
import { useGamepads } from "../hooks/useGamepads";

interface Props { onComplete: () => void; }
type Phase = "logo" | "text" | "ready" | "out";

export function BootAnimation({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("logo");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("text"),  900);
    const t2 = setTimeout(() => setPhase("ready"), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function advance() {
    if (phase !== "ready") return;
    setPhase("out");
    setTimeout(onComplete, 600);
  }

  useEffect(() => {
    const onKey = () => advance();
    if (phase === "ready") window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]); // eslint-disable-line

  // A controller button counts as "press anywhere to enter".
  useGamepads(() => advance());

  return (
    <div
      onClick={advance}
      style={{
        height: "100dvh", position: "relative",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: phase === "ready" ? "pointer" : "default",
        opacity: phase === "out" ? 0 : 1,
        transform: phase === "out" ? "scale(1.05)" : "scale(1)",
        transition: phase === "out" ? "opacity 0.6s ease, transform 0.6s ease" : "none",
        overflow: "hidden", userSelect: "none",
      }}
    >
      <SkyBackground />

      {/* Soft glow behind logo */}
      <div aria-hidden style={{
        position: "absolute", top: "44%", left: "50%",
        transform: "translate(-50%,-50%)",
        width: 460, height: 460, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(200,210,225,0.05) 45%, transparent 70%)",
        animation: "glow 4s ease-in-out infinite",
        zIndex: 1,
      }} />

      {/* Logo rising from clouds */}
      <div className="nunito" style={{
        position: "relative", zIndex: 2,
        fontSize: 76, fontWeight: 900, color: "#F5F7FA",
        letterSpacing: -2, lineHeight: 1, marginBottom: 28,
        textShadow: "0 0 50px rgba(255,255,255,0.45), 0 4px 30px rgba(0,0,0,0.4)",
        animation: "ascend 1.1s cubic-bezier(0.2,0,0.15,1) forwards",
        opacity: 0,
      }}>
        haven
      </div>

      {/* Press anywhere to enter — centered, blinking, below logo */}
      {phase === "ready" && (
        <div className="nunito" style={{
          position: "relative", zIndex: 2,
          fontSize: 15, fontWeight: 700, color: "var(--text-mid)",
          letterSpacing: 2,
          animation: "blink 1.3s ease-in-out infinite",
        }}>
          Press anywhere to enter
        </div>
      )}

      {/* Boot log */}
      {phase !== "logo" && (
        <div style={{
          position: "absolute", bottom: 56, left: 0, right: 0, zIndex: 2,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
        }}>
          {["AWAKENING SYSTEMS ········ OK", "REACHING THE SKY ········· READY", "HAVEN ···················· ONLINE"].map((line, i) => (
            <div key={i} className="mono" style={{
              fontSize: 11, color: "var(--text-dim)", letterSpacing: 1,
              animation: `fadeIn 0.5s ease-out ${0.5 + i * 0.22}s both`,
            }}>{line}</div>
          ))}
        </div>
      )}

    </div>
  );
}
