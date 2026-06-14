import React, { useState, useEffect, useRef, useCallback } from "react";
import { SkyBackground } from "../components/SkyBackground";

interface Props {
  onContinue: () => void;
}

export function ControllerSetupView({ onContinue }: Props) {
  const [phase, setPhase] = useState<"waiting" | "scanning">("waiting");
  const [secsLeft, setSecsLeft] = useState(30);
  const continueRef = useRef(onContinue);
  continueRef.current = onContinue;

  // Advance when a gamepad connects (fires on first button press after connect).
  useEffect(() => {
    const handler = () => continueRef.current();
    window.addEventListener("gamepadconnected", handler);
    return () => window.removeEventListener("gamepadconnected", handler);
  }, []);

  // Poll for button presses on already-connected gamepads (Chrome only surfaces
  // gamepads after a button press, so this also handles the first press).
  useEffect(() => {
    let raf: number;
    function tick() {
      for (const gp of navigator.getGamepads()) {
        if (gp?.buttons.some((b) => b.pressed)) { continueRef.current(); return; }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Any key press also advances (keyboard / dev mode).
  useEffect(() => {
    const handler = () => continueRef.current();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const startPairing = useCallback(async () => {
    try { await fetch("/api/bt/scan", { method: "POST" }); } catch { /* expected offline */ }
    setPhase("scanning");
    setSecsLeft(30);
  }, []);

  useEffect(() => {
    if (phase !== "scanning") return;
    const t = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) { clearInterval(t); setPhase("waiting"); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const scanPct = phase === "scanning" ? Math.round(((30 - secsLeft) / 30) * 100) : 0;

  return (
    <div style={{
      height: "100dvh", position: "relative",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', sans-serif",
      animation: "fadeIn 0.6s ease-out",
    }}>
      <SkyBackground />

      {/* Logo */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginBottom: 52 }}>
        <div className="nunito" style={{
          fontSize: 60, fontWeight: 900, color: "#EEF4FF",
          letterSpacing: -2,
          textShadow: "0 0 60px rgba(255,255,255,0.6)",
          animation: "glow 4s ease-in-out infinite",
        }}>haven</div>
        <div className="mono" style={{
          fontSize: 10, color: "var(--sky-light)", letterSpacing: 4, opacity: 0.7, marginTop: 8,
        }}>ABOVE THE CLOUDS</div>
      </div>

      <div style={{ position: "relative", zIndex: 1, fontSize: 64, marginBottom: 36, lineHeight: 1 }}>
        🎮
      </div>

      {phase === "waiting" ? (
        <>
          <p className="nunito" style={{
            position: "relative", zIndex: 1,
            fontSize: 22, fontWeight: 800, color: "var(--text)",
            margin: "0 0 10px",
            animation: "dotPulse 2s ease-in-out infinite",
            textAlign: "center",
          }}>
            Press any button to continue
          </p>
          <p style={{
            position: "relative", zIndex: 1,
            fontSize: 13, color: "var(--text-dim)", margin: "0 0 40px",
            textAlign: "center",
          }}>
            No controller? Pair one first.
          </p>
          <button
            onClick={startPairing}
            className="nunito"
            style={{
              position: "relative", zIndex: 1,
              background: "rgba(56,189,248,0.1)",
              border: "1px solid rgba(56,189,248,0.3)",
              borderRadius: 100,
              padding: "13px 36px", fontSize: 15, fontWeight: 700,
              color: "var(--sky-light)", cursor: "pointer",
              marginBottom: 16, transition: "all 0.2s",
            }}
          >
            Pair a new controller
          </button>
        </>
      ) : (
        <>
          <p className="nunito" style={{
            position: "relative", zIndex: 1,
            fontSize: 20, fontWeight: 800, color: "var(--text)",
            margin: "0 0 8px", textAlign: "center",
          }}>
            Searching for controller…
          </p>
          <p style={{
            position: "relative", zIndex: 1,
            fontSize: 13, color: "var(--text-dim)",
            margin: "0 0 28px", textAlign: "center", maxWidth: 320,
          }}>
            Hold Xbox button + pair button until the logo flashes rapidly.
          </p>
          <div style={{
            position: "relative", zIndex: 1,
            width: 280, height: 4, borderRadius: 4,
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
            fontSize: 11, color: "var(--text-dim)", marginBottom: 40,
          }}>
            {secsLeft}s remaining
          </span>
        </>
      )}

      <button
        onClick={onContinue}
        style={{
          position: "relative", zIndex: 1,
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.25)", fontSize: 13,
          fontFamily: "'Nunito', sans-serif", fontWeight: 600,
          marginTop: 8,
        }}
      >
        Skip — play without controller
      </button>
    </div>
  );
}
