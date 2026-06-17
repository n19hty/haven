import React, { useState, useEffect, useRef } from "react";
import { ControllerInput } from "../games/registry";

type Phase = "instructions" | "scanning" | "success" | "timeout";

interface Props {
  onClose: () => void;
  existingControllers: number;
  controllerInput?: ControllerInput;
}

const SCAN_SECS = 40;

export function BTWizard({ onClose, existingControllers, controllerInput }: Props) {
  const [phase, setPhase]     = useState<Phase>("instructions");
  const [secsLeft, setSecsLeft] = useState(SCAN_SECS);
  const phaseRef   = useRef(phase); phaseRef.current = phase;
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;

  // ── Start scanning ───────────────────────────────────────────────────────
  const startScan = async () => {
    try { await fetch("/api/bt/scan", { method: "POST" }); } catch { /* ok */ }
    setPhase("scanning");
    setSecsLeft(SCAN_SECS);
  };

  // ── Detect new gamepad ───────────────────────────────────────────────────
  useEffect(() => {
    const onConnect = () => {
      if (phaseRef.current === "scanning") setPhase("success");
    };
    window.addEventListener("gamepadconnected", onConnect);
    return () => window.removeEventListener("gamepadconnected", onConnect);
  }, []);

  // ── Countdown ────────────────────────────────────────────────────────────
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

  // ── Controller navigation inside the wizard ──────────────────────────────
  useEffect(() => {
    if (!controllerInput) return;
    return controllerInput((e) => {
      if (e.control === "back") { onCloseRef.current(); return; }
      if (e.control === "confirm") {
        if (phaseRef.current === "instructions") { startScan(); return; }
        if (phaseRef.current === "success")      { onCloseRef.current(); return; }
        if (phaseRef.current === "timeout")      { startScan(); return; }
      }
    });
  }, [controllerInput]); // eslint-disable-line

  const scanPct = Math.round(((SCAN_SECS - secsLeft) / SCAN_SECS) * 100);

  return (
    <div style={s.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.card}>

        {/* Header */}
        <div style={s.cardHeader}>
          <span style={s.cardTitle}>Pair a Controller</span>
          <button onClick={onClose} style={s.closeBtn} aria-label="Close">✕</button>
        </div>

        {/* ── Instructions ─────────────────────────────────────────────── */}
        {phase === "instructions" && (
          <div style={s.body}>
            <div style={s.heroIcon}>🎮</div>

            <p style={s.heading}>Put your Xbox controller in pairing mode</p>

            <div style={s.steps}>
              <Step n={1} icon="⏺">
                Hold the <b>Xbox button</b> (the glowing orb in the center) until the light starts flashing slowly.
              </Step>
              <Step n={2} icon="⬡">
                While it's flashing, press and release the <b>Sync button</b> — the small button on the top of the controller, above the USB-C port.
              </Step>
              <Step n={3} icon="📡">
                The light will flash rapidly. Keep the controller <b>within 3 feet</b> of the TV.
              </Step>
            </div>

            <div style={s.actions}>
              <button onClick={onClose} style={s.btnSecondary}>Cancel</button>
              <button onClick={startScan} style={s.btnPrimary}>
                Start Scanning →
              </button>
            </div>

            {controllerInput && (
              <p style={s.hint}>B · cancel &nbsp;·&nbsp; A · start scanning</p>
            )}
          </div>
        )}

        {/* ── Scanning ─────────────────────────────────────────────────── */}
        {phase === "scanning" && (
          <div style={s.body}>
            <div style={{ ...s.heroIcon, animation: "dotPulse 1.2s ease-in-out infinite" }}>📡</div>

            <p style={s.heading}>Searching for controller…</p>
            <p style={s.sub}>Make sure the light on the controller is flashing rapidly.</p>

            {/* Progress bar */}
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${scanPct}%` }} />
            </div>
            <p style={s.countdown}>{secsLeft}s remaining</p>

            <div style={s.actions}>
              <button onClick={onClose} style={s.btnSecondary}>Cancel</button>
            </div>
          </div>
        )}

        {/* ── Success ──────────────────────────────────────────────────── */}
        {phase === "success" && (
          <div style={s.body}>
            <div style={s.successRing}>✓</div>

            <p style={{ ...s.heading, color: "#4ade80" }}>Controller connected!</p>
            <p style={s.sub}>
              {existingControllers === 0
                ? "You're ready to play. Use the D-pad and A to navigate."
                : "Another controller is now connected."}
            </p>

            <div style={s.actions}>
              <button onClick={onClose} style={s.btnPrimary}>Done</button>
            </div>

            {controllerInput && <p style={s.hint}>A · done</p>}
          </div>
        )}

        {/* ── Timeout ──────────────────────────────────────────────────── */}
        {phase === "timeout" && (
          <div style={s.body}>
            <div style={s.errorIcon}>⚠️</div>

            <p style={s.heading}>No controller found</p>
            <p style={s.sub}>
              The controller wasn't in pairing mode, or it was too far away.
              <br />
              Follow the steps again and try once more.
            </p>

            <div style={s.tipBox}>
              <p style={s.tipTitle}>Quick tips</p>
              <ul style={s.tipList}>
                <li>Hold the Xbox button first, <em>then</em> press Sync while it's flashing</li>
                <li>The Sync button is on the top of the controller near the USB port</li>
                <li>Move the controller closer to the TV</li>
              </ul>
            </div>

            <div style={s.actions}>
              <button onClick={onClose} style={s.btnSecondary}>Cancel</button>
              <button onClick={startScan} style={s.btnPrimary}>Try Again</button>
            </div>

            {controllerInput && <p style={s.hint}>B · cancel &nbsp;·&nbsp; A · try again</p>}
          </div>
        )}

      </div>
    </div>
  );
}

function Step({ n, icon, children }: { n: number; icon: string; children: React.ReactNode }) {
  return (
    <div style={s.step}>
      <div style={s.stepNum}>{n}</div>
      <div style={s.stepIcon}>{icon}</div>
      <p style={s.stepText}>{children}</p>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, zIndex: 100,
    background: "rgba(0,0,0,0.82)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    width: "min(860px, 88vw)",
    background: "#12121b",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "clamp(16px, 2vw, 28px)",
    overflow: "hidden",
    color: "#f0f0f8",
    boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
  },
  cardHeader: {
    display: "flex", alignItems: "center",
    padding: "clamp(16px, 2.5vh, 28px) clamp(20px, 3vw, 36px)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  cardTitle: {
    flex: 1,
    fontSize: "clamp(16px, 2vw, 30px)",
    fontWeight: 800,
  },
  closeBtn: {
    background: "none", border: "none", cursor: "pointer",
    color: "rgba(255,255,255,0.4)",
    fontSize: "clamp(16px, 1.8vw, 26px)",
    padding: "4px 8px", lineHeight: 1,
    fontFamily: "'Inter', sans-serif",
    transition: "color 0.15s",
  },

  body: {
    padding: "clamp(20px, 3vh, 40px) clamp(20px, 3vw, 40px)",
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: "clamp(12px, 2vh, 22px)",
  },

  heroIcon: {
    fontSize: "clamp(40px, 6vw, 80px)",
    lineHeight: 1,
  },
  heading: {
    fontSize: "clamp(18px, 2.2vw, 36px)",
    fontWeight: 800, textAlign: "center",
    margin: 0, color: "#f0f0f8",
  },
  sub: {
    fontSize: "clamp(13px, 1.4vw, 22px)",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center", margin: 0, lineHeight: 1.5,
  },

  // Steps
  steps: {
    width: "100%",
    display: "flex", flexDirection: "column",
    gap: "clamp(8px, 1.2vh, 16px)",
    margin: "clamp(4px, 1vh, 12px) 0",
  },
  step: {
    display: "flex", alignItems: "flex-start",
    gap: "clamp(10px, 1.5vw, 20px)",
    padding: "clamp(10px, 1.5vh, 18px) clamp(14px, 2vw, 24px)",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "clamp(8px, 1vw, 14px)",
  },
  stepNum: {
    flexShrink: 0,
    width: "clamp(24px, 2.5vw, 40px)", height: "clamp(24px, 2.5vw, 40px)",
    borderRadius: "50%",
    background: "#6366f1",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "clamp(11px, 1.2vw, 18px)", fontWeight: 900, color: "#fff",
  },
  stepIcon: {
    flexShrink: 0,
    fontSize: "clamp(16px, 2vw, 28px)",
    lineHeight: 1.4,
  },
  stepText: {
    margin: 0,
    fontSize: "clamp(12px, 1.3vw, 20px)",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 1.5,
  },

  // Progress
  progressTrack: {
    width: "100%", height: "clamp(6px, 0.8vh, 12px)",
    background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden",
  },
  progressFill: {
    height: "100%", background: "#6366f1", borderRadius: 99,
    transition: "width 1s linear",
  },
  countdown: {
    margin: 0,
    fontSize: "clamp(13px, 1.4vw, 22px)",
    color: "rgba(255,255,255,0.4)",
    fontVariantNumeric: "tabular-nums",
  },

  // Success
  successRing: {
    width: "clamp(60px, 8vw, 110px)", height: "clamp(60px, 8vw, 110px)",
    borderRadius: "50%",
    background: "rgba(74,222,128,0.12)",
    border: "2px solid rgba(74,222,128,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "clamp(28px, 4vw, 56px)",
    color: "#4ade80",
    boxShadow: "0 0 48px rgba(74,222,128,0.2)",
  },

  // Timeout
  errorIcon: { fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1 },
  tipBox: {
    width: "100%",
    padding: "clamp(12px, 1.5vh, 20px) clamp(14px, 2vw, 24px)",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "clamp(8px, 1vw, 14px)",
  },
  tipTitle: {
    margin: "0 0 0.5em",
    fontSize: "clamp(11px, 1.1vw, 18px)",
    fontWeight: 700, color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase", letterSpacing: "0.1em",
  },
  tipList: {
    margin: 0, paddingLeft: "1.4em",
    display: "flex", flexDirection: "column",
    gap: "0.35em",
  },

  // Actions
  actions: {
    display: "flex", gap: "clamp(10px, 1.5vw, 20px)",
    marginTop: "clamp(4px, 1vh, 12px)",
  },
  btnPrimary: {
    padding: "clamp(10px, 1.5vh, 18px) clamp(20px, 3vw, 40px)",
    fontSize: "clamp(13px, 1.5vw, 24px)", fontWeight: 800,
    background: "#6366f1", color: "#fff",
    border: "none", borderRadius: "clamp(8px, 1vw, 14px)",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
    boxShadow: "0 0 0 3px rgba(99,102,241,0.3)",
  },
  btnSecondary: {
    padding: "clamp(10px, 1.5vh, 18px) clamp(20px, 3vw, 40px)",
    fontSize: "clamp(13px, 1.5vw, 24px)", fontWeight: 700,
    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "clamp(8px, 1vw, 14px)",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
  },

  hint: {
    margin: 0,
    fontSize: "clamp(9px, 0.9vw, 14px)",
    color: "rgba(255,255,255,0.22)",
    letterSpacing: "0.05em",
  },
};
