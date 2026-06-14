import React, { useState, useEffect, useRef } from "react";
import { SkyBackground } from "../components/SkyBackground";

type Phase = "scanning" | "found" | "timeout";

interface Props {
  onContinue: () => void;
}

export function ControllerSetupView({ onContinue }: Props) {
  const [phase, setPhase]       = useState<Phase>("scanning");
  const [secsLeft, setSecsLeft] = useState(30);
  const advancedRef  = useRef(false);
  const continueRef  = useRef(onContinue);
  continueRef.current = onContinue;

  function advance() {
    if (advancedRef.current) return;
    advancedRef.current = true;
    setPhase("found");
    setTimeout(() => continueRef.current(), 1200);
  }

  function retry() {
    advancedRef.current = false;
    setPhase("scanning");
    setSecsLeft(30);
    fetch("/api/bt/scan", { method: "POST" }).catch(() => {});
  }

  // Auto-start BT scan immediately.
  useEffect(() => {
    fetch("/api/bt/scan", { method: "POST" }).catch(() => {});
  }, []);

  // Advance when the OS reports a gamepad connected (fires on first button press).
  useEffect(() => {
    window.addEventListener("gamepadconnected", advance);
    return () => window.removeEventListener("gamepadconnected", advance);
  }, []); // eslint-disable-line

  // Also poll in case a gamepad is already connected and waiting for a button.
  useEffect(() => {
    let raf: number;
    function tick() {
      if (advancedRef.current) return;
      for (const gp of navigator.getGamepads()) {
        if (gp?.buttons.some((b) => b.pressed)) { advance(); return; }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line

  // Countdown timer.
  useEffect(() => {
    if (phase !== "scanning") return;
    const t = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) { clearInterval(t); setPhase("timeout"); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const scanPct = Math.round(((30 - secsLeft) / 30) * 100);

  return (
    <div style={{
      height: "100dvh", position: "relative",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
    }}>
      <SkyBackground />

      {/* Logo */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginBottom: 56 }}>
        <div className="nunito" style={{
          fontSize: 52, fontWeight: 900, color: "#EEF4FF",
          letterSpacing: -2,
          textShadow: "0 0 60px rgba(255,255,255,0.55)",
          animation: "glow 4s ease-in-out infinite",
        }}>haven</div>
        <div className="mono" style={{
          fontSize: 9, color: "var(--sky-light)", letterSpacing: 4, opacity: 0.6, marginTop: 6,
        }}>ABOVE THE CLOUDS</div>
      </div>

      {phase === "scanning" && (
        <>
          <div style={{ position: "relative", zIndex: 1, fontSize: 52, marginBottom: 28, lineHeight: 1 }}>🎮</div>

          <p className="nunito" style={{
            position: "relative", zIndex: 1,
            fontSize: 20, fontWeight: 800, color: "var(--text)",
            margin: "0 0 10px", textAlign: "center",
          }}>
            Connecting your controller…
          </p>
          <p style={{
            position: "relative", zIndex: 1,
            fontSize: 13, color: "var(--text-dim)",
            margin: "0 0 32px", textAlign: "center", maxWidth: 300, lineHeight: 1.6,
          }}>
            Hold the Xbox button + pair button until the logo flashes rapidly.
          </p>

          {/* Progress bar */}
          <div style={{
            position: "relative", zIndex: 1,
            width: 260, height: 4, borderRadius: 4,
            background: "rgba(255,255,255,0.08)", overflow: "hidden",
            marginBottom: 10,
          }}>
            <div style={{
              height: "100%", borderRadius: 4,
              background: "linear-gradient(90deg, var(--sky), #818CF8)",
              width: `${scanPct}%`,
              transition: "width 1s linear",
            }} />
          </div>
          <span className="mono" style={{
            position: "relative", zIndex: 1,
            fontSize: 11, color: "var(--text-dim)", marginBottom: 48,
          }}>
            {secsLeft}s
          </span>

          <button
            onClick={() => continueRef.current()}
            style={{
              position: "relative", zIndex: 1,
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.22)", fontSize: 13,
              fontFamily: "'Nunito', sans-serif", fontWeight: 600,
            }}
          >
            Skip — play without controller
          </button>
        </>
      )}

      {phase === "found" && (
        <>
          <div style={{
            position: "relative", zIndex: 1,
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(52,211,153,0.15)",
            border: "2px solid rgba(52,211,153,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, marginBottom: 24,
            boxShadow: "0 0 40px rgba(52,211,153,0.25)",
            animation: "fadeIn 0.3s ease-out",
          }}>
            ✓
          </div>
          <p className="nunito" style={{
            position: "relative", zIndex: 1,
            fontSize: 22, fontWeight: 800, color: "#34D399",
            margin: 0, textAlign: "center",
            textShadow: "0 0 20px rgba(52,211,153,0.4)",
          }}>
            Controller connected!
          </p>
        </>
      )}

      {phase === "timeout" && (
        <>
          <div style={{ position: "relative", zIndex: 1, fontSize: 48, marginBottom: 24, opacity: 0.4 }}>🎮</div>
          <p className="nunito" style={{
            position: "relative", zIndex: 1,
            fontSize: 18, fontWeight: 800, color: "var(--text)",
            margin: "0 0 8px", textAlign: "center",
          }}>
            Couldn't find a controller
          </p>
          <p style={{
            position: "relative", zIndex: 1,
            fontSize: 13, color: "var(--text-dim)",
            margin: "0 0 36px", textAlign: "center", maxWidth: 280, lineHeight: 1.6,
          }}>
            Make sure the controller is in pairing mode and try again.
          </p>
          <button
            onClick={retry}
            className="nunito"
            style={{
              position: "relative", zIndex: 1,
              background: "rgba(56,189,248,0.1)",
              border: "1px solid rgba(56,189,248,0.3)",
              borderRadius: 100, padding: "13px 36px",
              fontSize: 15, fontWeight: 700,
              color: "var(--sky-light)", cursor: "pointer", marginBottom: 16,
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => continueRef.current()}
            style={{
              position: "relative", zIndex: 1,
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.22)", fontSize: 13,
              fontFamily: "'Nunito', sans-serif", fontWeight: 600,
            }}
          >
            Skip — play without controller
          </button>
        </>
      )}
    </div>
  );
}
