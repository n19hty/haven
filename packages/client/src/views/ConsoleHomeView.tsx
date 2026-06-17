import React, { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RoomState, Player, GameMeta } from "@haven/shared";
import { ControllerInput } from "../games/registry";

interface Props {
  roomState: RoomState;
  myPlayer: Player;
  games?: GameMeta[];
  isHost?: boolean;
  onLaunch?: (gameId: string) => void;
  controllerInput?: ControllerInput;
  controllerCount?: number;
}

export function ConsoleHomeView({
  roomState, myPlayer, games = [], isHost = false, onLaunch,
  controllerInput, controllerCount = 0,
}: Props) {
  const { room } = roomState;

  // ── Time ──────────────────────────────────────────────────────────────────
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

  // ── Network / QR ──────────────────────────────────────────────────────────
  const [netBase, setNetBase] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/server-info")
      .then((r) => r.json())
      .then((info) => { if (info?.host) setNetBase(`http://${info.host}:${info.port}`); })
      .catch(() => {});
  }, []);
  const base    = netBase ?? window.location.origin;
  const joinUrl = `${base}?join=${room.code}`;
  const netAddr = base.replace(/^https?:\/\//, "");

  // ── Bluetooth pairing ─────────────────────────────────────────────────────
  const [btPhase, setBtPhase]       = useState<"idle" | "scanning">("idle");
  const [btSecsLeft, setBtSecsLeft] = useState(30);

  const startPairing = useCallback(async () => {
    try { await fetch("/api/bt/scan", { method: "POST" }); } catch { /* ok */ }
    setBtPhase("scanning");
    setBtSecsLeft(30);
  }, []);

  useEffect(() => {
    if (btPhase !== "scanning") return;
    const t = setInterval(() => {
      setBtSecsLeft((s) => {
        if (s <= 1) { clearInterval(t); setBtPhase("idle"); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [btPhase]);

  useEffect(() => { if (controllerCount > 0) setBtPhase("idle"); }, [controllerCount]);

  // ── Controller nav ────────────────────────────────────────────────────────
  // Only one action in the lobby: confirm = launch. We keep an explicit
  // "focused" boolean so the button shows a selection ring immediately.
  const [focused, setFocused] = useState(true);
  const canLaunchRef = useRef(isHost); canLaunchRef.current = isHost;
  const onLaunchRef  = useRef(onLaunch);  onLaunchRef.current = onLaunch;
  const gamesRef     = useRef(games);     gamesRef.current = games;
  const startPairingRef = useRef(startPairing); startPairingRef.current = startPairing;

  useEffect(() => {
    if (!controllerInput) return;
    return controllerInput((e) => {
      if (e.control === "confirm" && canLaunchRef.current) {
        const g = gamesRef.current[0];
        if (g) onLaunchRef.current?.(g.id);
      }
      if (e.control === "back") startPairingRef.current();
      // D-pad still acknowledged — keep focus ring visible
      if (["up","down","left","right"].includes(e.control)) setFocused(true);
    });
  }, [controllerInput]);

  // ── Update check ──────────────────────────────────────────────────────────
  const [updateInfo, setUpdateInfo]         = useState<{ latestMessage?: string } | null>(null);
  const [updating, setUpdating]             = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateStage, setUpdateStage]       = useState("Starting update…");
  const [serverRestarting, setServerRestarting] = useState(false);
  const failCountRef = useRef(0);
  const reloadedRef  = useRef(false);

  useEffect(() => {
    const check = () =>
      fetch("/api/check-update").then((r) => r.json())
        .then((d) => { if (!d.upToDate && !d.error) setUpdateInfo(d); })
        .catch(() => {});
    check();
    const t = setInterval(check, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  async function handleUpdate() {
    setUpdateInfo(null); setUpdating(true);
    setUpdateProgress(0); setUpdateStage("Starting update…");
    setServerRestarting(false);
    failCountRef.current = 0; reloadedRef.current = false;
    try { await fetch("/api/update", { method: "POST" }); } catch { /* expected */ }
  }

  useEffect(() => {
    if (!updating) return;
    const poll = async () => {
      try {
        const r = await fetch("/api/update-status");
        if (!r.ok) throw new Error();
        const d: { stage?: string; message?: string; progress?: number } = await r.json();
        failCountRef.current = 0; setServerRestarting(false);
        if (d.progress !== undefined) setUpdateProgress(d.progress);
        if (d.message) setUpdateStage(d.message);
        if (d.stage === "done" && !reloadedRef.current) {
          reloadedRef.current = true;
          setTimeout(() => window.location.reload(), 2500);
        }
      } catch {
        failCountRef.current += 1;
        if (failCountRef.current >= 3) setServerRestarting(true);
        if (failCountRef.current === 22 && !reloadedRef.current) {
          reloadedRef.current = true;
          setTimeout(() => window.location.reload(), 2000);
        }
      }
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, [updating]);

  const playableGame = games[0] ?? null;
  const canStart     = isHost && !!playableGame;

  return (
    <div style={s.root}>

      {/* ── Update overlay ──────────────────────────────────────────────── */}
      {updating && (
        <div style={s.overlay}>
          <p style={s.overlayTitle}>{serverRestarting ? "Restarting…" : "Updating Haven…"}</p>
          <p style={s.overlaySub}>{serverRestarting ? "New version coming up." : updateStage}</p>
          <div style={s.progressTrack}>
            <div style={{ ...s.progressFill, width: serverRestarting ? "90%" : `${updateProgress}%` }} />
          </div>
        </div>
      )}

      {/* ── Update banner ───────────────────────────────────────────────── */}
      {updateInfo && !updating && (
        <div style={s.banner}>
          <span style={s.bannerDot} />
          <span style={s.bannerLabel}>Update available</span>
          {updateInfo.latestMessage && (
            <span style={s.bannerMsg}>{updateInfo.latestMessage}</span>
          )}
          <button onClick={handleUpdate} style={{ ...s.btn, background: "#6366f1", color: "#fff", border: "none" }}>
            Update Now
          </button>
          <button onClick={() => setUpdateInfo(null)} style={s.btn}>Later</button>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={s.header}>
        <span style={s.logo}>haven</span>
        <div style={s.headerRight}>
          {controllerCount > 0 && (
            <span style={s.ctrlBadge}>
              <span style={s.ctrlDot} /> {controllerCount} controller{controllerCount > 1 ? "s" : ""}
            </span>
          )}
          <span style={s.clock}>{timeStr}</span>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main style={s.main}>

        {/* Left: QR + code */}
        <div style={s.leftCol}>
          <p style={s.label}>Scan to join</p>
          <div style={s.qrBox}>
            <QRCodeSVG value={joinUrl} size={qrSize()} bgColor="#fff" fgColor="#0c0c14" />
          </div>
          <div style={s.roomCode}>{room.code}</div>
          <p style={s.joinAddr}>{netAddr}</p>
        </div>

        {/* Divider */}
        <div style={s.divider} />

        {/* Right: players + game */}
        <div style={s.rightCol}>

          {/* Players */}
          <div style={s.section}>
            <p style={s.label}>Players — {room.players.length} / 4</p>
            <div style={s.playerGrid}>
              {[0, 1, 2, 3].map((i) => {
                const p   = room.players[i];
                const me  = p?.id === myPlayer.id;
                const col = p?.avatarColor ?? "rgba(255,255,255,0.08)";
                return (
                  <div key={i} style={{
                    ...s.playerSlot,
                    background: p ? `${col}10` : "rgba(255,255,255,0.02)",
                    border:     `1px solid ${p ? col + "35" : "rgba(255,255,255,0.07)"}`,
                  }}>
                    <div style={{ ...s.dot, background: p ? col : "rgba(255,255,255,0.12)" }} />
                    <div>
                      <div style={{ ...s.playerName, color: p ? "#f0f0f8" : "rgba(255,255,255,0.2)" }}>
                        {p ? (me ? `${p.name} (you)` : p.name) : `Player ${i + 1}`}
                      </div>
                      <div style={s.playerSub}>
                        {p ? (p.isHost ? "Host" : "Joined") : "Waiting…"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Game */}
          <div style={s.section}>
            <p style={s.label}>Game</p>
            {playableGame ? (
              <div style={{
                ...s.gameCard,
                border: focused && canStart
                  ? "2px solid #6366f1"
                  : "1px solid rgba(255,255,255,0.1)",
                boxShadow: focused && canStart
                  ? "0 0 0 4px rgba(99,102,241,0.2)"
                  : "none",
              }}>
                <div>
                  <div style={s.gameName}>{playableGame.name}</div>
                  <div style={s.gameSub}>
                    {playableGame.minPlayers}–{playableGame.maxPlayers} players
                    {room.players.length === 1 ? " · vs Computer" : ""}
                  </div>
                </div>
                {canStart ? (
                  <button
                    onClick={() => onLaunch?.(playableGame.id)}
                    style={{ ...s.launchBtn, ...(focused ? s.launchBtnFocused : {}) }}
                  >
                    {controllerCount > 0 ? "A  ·  Start" : "Start Game"}
                  </button>
                ) : (
                  <span style={s.hostWait}>Host picks</span>
                )}
              </div>
            ) : (
              <div style={{ ...s.gameCard, color: "rgba(255,255,255,0.3)", fontStyle: "italic", fontSize: "1.5vw" }}>
                No games available
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={s.footer}>
        {btPhase === "scanning" ? (
          <>
            <span style={s.btLabel}>Searching… {btSecsLeft}s · hold Xbox + pair</span>
            <div style={s.btTrack}>
              <div style={{ ...s.btFill, width: `${Math.round(((30 - btSecsLeft) / 30) * 100)}%` }} />
            </div>
            <button onClick={() => setBtPhase("idle")} style={s.btn}>Cancel</button>
          </>
        ) : (
          <button onClick={startPairing} style={s.btn}>
            🎮  {controllerCount > 0 ? "Pair another controller" : "Pair controller"}
          </button>
        )}
      </footer>

    </div>
  );
}

// QR code size: 20% of the shorter viewport side, 160–280px.
function qrSize(): number {
  if (typeof window === "undefined") return 200;
  return Math.max(160, Math.min(280, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.20)));
}

// ── Styles ─────────────────────────────────────────────────────────────────────
// All sizes use vw/vh so a 65" 1080p TV (1920×1080) gives readable scale.
// Minimums keep things usable on a laptop at dev time.

const s: Record<string, React.CSSProperties> = {
  root: {
    height: "100dvh",
    display: "flex", flexDirection: "column",
    background: "#0c0c14",
    color: "#f0f0f8",
    fontFamily: "'Inter', sans-serif",
    overflow: "hidden",
  },

  overlay: {
    position: "absolute", inset: 0, zIndex: 50,
    background: "rgba(0,0,0,0.95)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: "2vh",
  },
  overlayTitle: { fontSize: "clamp(24px, 3vw, 60px)", fontWeight: 800, margin: 0 },
  overlaySub:   { fontSize: "clamp(14px, 1.5vw, 28px)", color: "rgba(255,255,255,0.5)", margin: 0 },
  progressTrack: {
    width: "min(500px, 50vw)", height: "clamp(4px, 0.5vh, 8px)",
    background: "rgba(255,255,255,0.1)", borderRadius: 99, overflow: "hidden",
  },
  progressFill: {
    height: "100%", background: "#6366f1", borderRadius: 99,
    transition: "width 1.2s ease-out",
  },

  banner: {
    flexShrink: 0,
    display: "flex", alignItems: "center", gap: "clamp(8px, 1vw, 16px)",
    padding: "clamp(8px, 1vh, 16px) clamp(16px, 2vw, 32px)",
    background: "rgba(99,102,241,0.08)",
    borderBottom: "1px solid rgba(99,102,241,0.2)",
  },
  bannerDot: {
    width: "clamp(6px, 0.6vw, 10px)", height: "clamp(6px, 0.6vw, 10px)",
    borderRadius: "50%", background: "#6366f1", flexShrink: 0, display: "inline-block",
  },
  bannerLabel: { fontWeight: 700, fontSize: "clamp(12px, 1.2vw, 20px)" },
  bannerMsg:   { color: "rgba(255,255,255,0.5)", fontSize: "clamp(11px, 1vw, 18px)", flex: 1 },

  header: {
    flexShrink: 0,
    display: "flex", alignItems: "center",
    padding: "0 clamp(20px, 3vw, 48px)",
    height: "clamp(52px, 7vh, 80px)",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  logo: {
    fontSize: "clamp(22px, 3.5vw, 60px)",
    fontWeight: 900, letterSpacing: "-0.02em", flex: 1,
  },
  headerRight: { display: "flex", alignItems: "center", gap: "clamp(12px, 2vw, 32px)" },
  ctrlBadge: {
    display: "flex", alignItems: "center", gap: "0.5vw",
    fontSize: "clamp(11px, 1.1vw, 20px)",
    color: "#4ade80",
    padding: "0.3em 0.9em",
    background: "rgba(74,222,128,0.08)",
    border: "1px solid rgba(74,222,128,0.2)",
    borderRadius: 99,
  },
  ctrlDot: {
    width: "0.6vw", height: "0.6vw",
    minWidth: 7, minHeight: 7,
    borderRadius: "50%", background: "#4ade80", display: "inline-block",
  },
  clock: {
    fontSize: "clamp(14px, 2vw, 36px)",
    fontWeight: 700, fontVariantNumeric: "tabular-nums",
    color: "rgba(255,255,255,0.55)",
  },

  main: {
    flex: 1,
    display: "flex",
    padding: "clamp(16px, 3vh, 40px) clamp(20px, 3vw, 48px)",
    gap: "clamp(16px, 3vw, 48px)",
    minHeight: 0, overflow: "hidden",
  },

  // Left col — join info
  leftCol: {
    flexShrink: 0,
    width: "clamp(180px, 22vw, 360px)",
    display: "flex", flexDirection: "column",
    alignItems: "center",
    gap: "clamp(8px, 1.5vh, 20px)",
  },
  qrBox: {
    background: "#fff",
    padding: "clamp(8px, 1vw, 16px)",
    borderRadius: "clamp(8px, 1vw, 16px)",
    flexShrink: 0,
  },
  roomCode: {
    fontSize: "clamp(32px, 5.5vw, 100px)",
    fontWeight: 900,
    letterSpacing: "0.15em",
    color: "#fff",
    lineHeight: 1,
  },
  joinAddr: {
    fontSize: "clamp(9px, 0.9vw, 16px)",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    wordBreak: "break-all",
    margin: 0,
    fontFamily: "monospace",
  },

  divider: {
    width: 1, background: "rgba(255,255,255,0.07)", flexShrink: 0, alignSelf: "stretch",
  },

  // Right col — players + game
  rightCol: {
    flex: 1,
    display: "flex", flexDirection: "column",
    gap: "clamp(12px, 2.5vh, 32px)",
    justifyContent: "center",
    minWidth: 0,
  },
  section: { display: "flex", flexDirection: "column", gap: "clamp(6px, 1vh, 14px)" },

  label: {
    margin: 0,
    fontSize: "clamp(10px, 1vw, 17px)",
    fontWeight: 700, letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.35)",
  },

  playerGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "clamp(6px, 1vw, 14px)",
  },
  playerSlot: {
    display: "flex", alignItems: "center",
    gap: "clamp(8px, 1vw, 16px)",
    padding: "clamp(8px, 1.2vh, 18px) clamp(10px, 1.2vw, 20px)",
    borderRadius: "clamp(8px, 1vw, 16px)",
    transition: "background 0.3s, border-color 0.3s",
  },
  dot: {
    width: "clamp(8px, 0.9vw, 16px)", height: "clamp(8px, 0.9vw, 16px)",
    borderRadius: "50%", flexShrink: 0,
  },
  playerName: {
    fontSize: "clamp(13px, 1.6vw, 28px)",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  playerSub: {
    fontSize: "clamp(9px, 0.9vw, 15px)",
    color: "rgba(255,255,255,0.35)",
    marginTop: "0.2em",
  },

  gameCard: {
    display: "flex", alignItems: "center",
    gap: "clamp(12px, 2vw, 28px)",
    padding: "clamp(12px, 2vh, 24px) clamp(14px, 1.8vw, 28px)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "clamp(10px, 1.2vw, 20px)",
    transition: "border-color 0.15s, box-shadow 0.15s",
  },
  gameName: {
    fontSize: "clamp(16px, 2.2vw, 40px)",
    fontWeight: 800, marginBottom: "0.2em",
  },
  gameSub: {
    fontSize: "clamp(10px, 1vw, 18px)",
    color: "rgba(255,255,255,0.45)",
  },
  launchBtn: {
    marginLeft: "auto", flexShrink: 0,
    padding: "clamp(8px, 1.2vh, 18px) clamp(16px, 2vw, 36px)",
    fontSize: "clamp(12px, 1.5vw, 26px)",
    fontWeight: 800,
    background: "#6366f1",
    color: "#fff",
    border: "2px solid transparent",
    borderRadius: "clamp(8px, 0.8vw, 14px)",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
    transition: "transform 0.1s, box-shadow 0.15s",
  },
  launchBtnFocused: {
    boxShadow: "0 0 0 4px rgba(99,102,241,0.4), 0 0 24px rgba(99,102,241,0.3)",
    transform: "scale(1.03)",
  },
  hostWait: {
    marginLeft: "auto",
    fontSize: "clamp(11px, 1vw, 18px)",
    color: "rgba(255,255,255,0.3)",
    fontStyle: "italic",
  },

  footer: {
    flexShrink: 0,
    height: "clamp(44px, 7vh, 72px)",
    display: "flex", alignItems: "center",
    gap: "clamp(8px, 1.5vw, 24px)",
    padding: "0 clamp(20px, 3vw, 48px)",
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  btLabel: { fontSize: "clamp(10px, 1vw, 18px)", color: "rgba(255,255,255,0.45)" },
  btTrack: {
    width: "clamp(80px, 10vw, 180px)", height: "clamp(3px, 0.3vh, 5px)",
    background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden",
  },
  btFill: {
    height: "100%", background: "#6366f1", borderRadius: 99,
    transition: "width 1s linear",
  },

  btn: {
    padding: "clamp(6px, 0.8vh, 12px) clamp(12px, 1.5vw, 24px)",
    fontSize: "clamp(10px, 1vw, 18px)",
    fontWeight: 700,
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 99, cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
};
