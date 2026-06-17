import React, { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RoomState, Player, GameMeta } from "@haven/shared";
import { ControllerInput } from "../games/registry";
import { BTWizard } from "../components/BTWizard";

interface Props {
  roomState: RoomState;
  myPlayer: Player;
  games?: GameMeta[];
  isHost?: boolean;
  onLaunch?: (gameId: string) => void;
  controllerInput?: ControllerInput;
  controllerCount?: number;
}

const UPCOMING = [
  { id: "racer",   name: "Night Racer",   icon: "🏎",  color: "#60A5FA", sub: "Racing" },
  { id: "battle",  name: "Battle Grid",   icon: "⚔️",  color: "#F87171", sub: "Strategy" },
  { id: "puzzle",  name: "Mind Bender",   icon: "🧩",  color: "#A78BFA", sub: "Puzzle" },
  { id: "ghost",   name: "Ghost Network", icon: "👻",  color: "#34D399", sub: "Action" },
];

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

  // ── Bluetooth pairing wizard ──────────────────────────────────────────────
  const [btWizardOpen, setBtWizardOpen] = useState(false);

  // ── Game shelf + controller nav ───────────────────────────────────────────
  const allItems = [
    ...games.map((g) => ({ id: g.id, name: g.name, icon: g.thumbnail ?? "🎮", color: "#6366f1", sub: `${g.minPlayers}–${g.maxPlayers} players`, playable: true })),
    ...UPCOMING.map((g) => ({ ...g, playable: false })),
  ];

  const [selected, setSelected] = useState(0);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const allItemsRef = useRef(allItems); allItemsRef.current = allItems;
  const isHostRef   = useRef(isHost);   isHostRef.current   = isHost;
  const onLaunchRef = useRef(onLaunch); onLaunchRef.current = onLaunch;

  useEffect(() => {
    if (!controllerInput) return;
    return controllerInput((e) => {
      const items = allItemsRef.current;
      if (e.control === "left")  setSelected((s) => Math.max(0, s - 1));
      if (e.control === "right") setSelected((s) => Math.min(items.length - 1, s + 1));
      if (e.control === "confirm") {
        const item = items[selectedRef.current];
        if (item?.playable && isHostRef.current) onLaunchRef.current?.(item.id);
      }
      if (e.control === "back") setBtWizardOpen(true);
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

  const selectedItem = allItems[selected] ?? allItems[0];
  const canStart     = isHost && !!selectedItem?.playable;

  return (
    <div style={s.root}>
      {btWizardOpen && (
        <BTWizard
          onClose={() => setBtWizardOpen(false)}
          existingControllers={controllerCount}
          controllerInput={controllerInput}
        />
      )}

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
          {updateInfo.latestMessage && <span style={s.bannerMsg}>{updateInfo.latestMessage}</span>}
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
              <span style={s.ctrlDot} />{controllerCount} controller{controllerCount > 1 ? "s" : ""}
            </span>
          )}
          <span style={s.clock}>{timeStr}</span>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main style={s.main}>

        {/* Left: QR + join code */}
        <div style={s.leftCol}>
          <p style={s.label}>Scan to join</p>
          <div style={s.qrBox}>
            <QRCodeSVG value={joinUrl} size={qrPx()} bgColor="#fff" fgColor="#0c0c14" />
          </div>
          <div style={s.roomCode}>{room.code}</div>
          <p style={s.joinAddr}>{netAddr}</p>
        </div>

        {/* Divider */}
        <div style={s.divider} />

        {/* Right: players + game shelf */}
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
                    border: `1px solid ${p ? col + "35" : "rgba(255,255,255,0.07)"}`,
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

          {/* Game shelf */}
          <div style={s.section}>
            <p style={s.label}>Select Game</p>
            <div style={s.shelf}>
              {allItems.map((item, i) => {
                const isSel = i === selected;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelected(i)}
                    style={{
                      ...s.tile,
                      borderColor:  isSel ? (item.playable ? "#6366f1" : "rgba(255,255,255,0.3)") : "rgba(255,255,255,0.07)",
                      background:   isSel ? (item.playable ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.06)") : "rgba(255,255,255,0.03)",
                      boxShadow:    isSel && item.playable ? "0 0 0 3px rgba(99,102,241,0.25), 0 8px 24px rgba(0,0,0,0.4)" : "none",
                      transform:    isSel ? "scale(1.04)" : "scale(1)",
                      opacity:      item.playable ? 1 : 0.5,
                    }}
                  >
                    <span style={s.tileIcon}>{item.icon}</span>
                    <span style={s.tileName}>{item.name}</span>
                    <span style={s.tileSub}>
                      {item.playable ? item.sub : "Coming soon"}
                    </span>
                    {!item.playable && isSel && (
                      <span style={s.soonBadge}>SOON</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action row below shelf */}
            <div style={s.shelfAction}>
              {controllerCount > 0 && (
                <span style={s.hint}>← → select · A launch</span>
              )}
              <div style={{ flex: 1 }} />
              {canStart ? (
                <button
                  onClick={() => onLaunch?.(selectedItem.id)}
                  style={s.launchBtn}
                >
                  {controllerCount > 0 ? "A  ·  Launch" : "Launch Game"}
                </button>
              ) : selectedItem?.playable ? (
                <span style={s.hostWait}>Host picks the game</span>
              ) : (
                <span style={s.hostWait}>Not available yet</span>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={s.footer}>
        <button onClick={() => setBtWizardOpen(true)} style={s.btn}>
          🎮  {controllerCount > 0 ? "Pair another controller" : "Pair controller"}
        </button>
      </footer>

    </div>
  );
}

function qrPx(): number {
  if (typeof window === "undefined") return 180;
  return Math.max(140, Math.min(260, Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.18)));
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    height: "100dvh", display: "flex", flexDirection: "column",
    background: "#0c0c14", color: "#f0f0f8",
    fontFamily: "'Inter', sans-serif", overflow: "hidden",
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
  logo: { fontSize: "clamp(22px, 3.5vw, 56px)", fontWeight: 900, letterSpacing: "-0.02em", flex: 1 },
  headerRight: { display: "flex", alignItems: "center", gap: "clamp(12px, 2vw, 32px)" },
  ctrlBadge: {
    display: "flex", alignItems: "center", gap: "0.6em",
    fontSize: "clamp(11px, 1.1vw, 20px)", color: "#4ade80",
    padding: "0.3em 0.9em",
    background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)",
    borderRadius: 99,
  },
  ctrlDot: {
    width: "0.6em", height: "0.6em",
    borderRadius: "50%", background: "#4ade80", display: "inline-block",
  },
  clock: {
    fontSize: "clamp(14px, 2vw, 36px)", fontWeight: 700,
    fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.55)",
  },

  main: {
    flex: 1, display: "flex", minHeight: 0, overflow: "hidden",
    padding: "clamp(14px, 2.5vh, 36px) clamp(20px, 3vw, 48px)",
    gap: "clamp(16px, 3vw, 48px)",
  },

  leftCol: {
    flexShrink: 0, width: "clamp(160px, 20vw, 320px)",
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: "clamp(8px, 1.2vh, 18px)",
  },
  qrBox: {
    background: "#fff", flexShrink: 0,
    padding: "clamp(8px, 1vw, 14px)",
    borderRadius: "clamp(8px, 1vw, 14px)",
  },
  roomCode: {
    fontSize: "clamp(30px, 5vw, 96px)", fontWeight: 900,
    letterSpacing: "0.15em", color: "#fff", lineHeight: 1,
  },
  joinAddr: {
    fontSize: "clamp(9px, 0.85vw, 15px)", color: "rgba(255,255,255,0.3)",
    textAlign: "center", wordBreak: "break-all", margin: 0, fontFamily: "monospace",
  },

  divider: { width: 1, background: "rgba(255,255,255,0.07)", flexShrink: 0, alignSelf: "stretch" },

  rightCol: {
    flex: 1, display: "flex", flexDirection: "column",
    gap: "clamp(12px, 2.5vh, 28px)", justifyContent: "center", minWidth: 0,
  },
  section: { display: "flex", flexDirection: "column", gap: "clamp(6px, 1vh, 12px)" },

  label: {
    margin: 0, fontSize: "clamp(10px, 1vw, 16px)", fontWeight: 700,
    letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)",
  },

  playerGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: "clamp(6px, 0.8vw, 12px)",
  },
  playerSlot: {
    display: "flex", alignItems: "center", gap: "clamp(8px, 1vw, 14px)",
    padding: "clamp(8px, 1.2vh, 16px) clamp(10px, 1.2vw, 18px)",
    borderRadius: "clamp(8px, 1vw, 14px)",
    transition: "background 0.3s, border-color 0.3s",
  },
  dot: { width: "clamp(8px, 0.8vw, 14px)", height: "clamp(8px, 0.8vw, 14px)", borderRadius: "50%", flexShrink: 0 },
  playerName: { fontSize: "clamp(13px, 1.5vw, 26px)", fontWeight: 700, lineHeight: 1.2 },
  playerSub:  { fontSize: "clamp(9px, 0.85vw, 14px)", color: "rgba(255,255,255,0.35)", marginTop: "0.2em" },

  // ── Game shelf ──
  shelf: {
    display: "flex", gap: "clamp(8px, 1vw, 16px)",
    overflowX: "auto", paddingBottom: 4,
    // hide scrollbar — navigation is via D-pad
    scrollbarWidth: "none",
  },
  tile: {
    flexShrink: 0,
    width: "clamp(110px, 12vw, 190px)", height: "clamp(110px, 14vh, 180px)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: "clamp(4px, 0.6vh, 8px)",
    border: "2px solid", borderRadius: "clamp(10px, 1.2vw, 18px)",
    cursor: "pointer",
    transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s, border-color 0.15s",
    position: "relative", outline: "none",
    fontFamily: "'Inter', sans-serif",
    padding: "clamp(8px, 1vh, 14px)",
  },
  tileIcon: { fontSize: "clamp(24px, 3.5vw, 52px)", lineHeight: 1 },
  tileName: { fontSize: "clamp(11px, 1.2vw, 20px)", fontWeight: 800, color: "#f0f0f8", textAlign: "center" },
  tileSub:  { fontSize: "clamp(8px, 0.85vw, 13px)", color: "rgba(255,255,255,0.4)", textAlign: "center" },
  soonBadge: {
    position: "absolute", top: "clamp(4px, 0.5vh, 8px)", right: "clamp(4px, 0.5vw, 8px)",
    fontSize: "clamp(7px, 0.7vw, 10px)", fontWeight: 800, letterSpacing: 1,
    color: "rgba(255,255,255,0.5)",
    padding: "2px 6px", borderRadius: 99,
    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  },

  shelfAction: {
    display: "flex", alignItems: "center", gap: "clamp(8px, 1.5vw, 20px)",
    marginTop: "clamp(2px, 0.5vh, 8px)",
  },
  hint: { fontSize: "clamp(10px, 1vw, 16px)", color: "rgba(255,255,255,0.28)", letterSpacing: "0.05em" },
  launchBtn: {
    padding: "clamp(8px, 1.2vh, 16px) clamp(16px, 2vw, 32px)",
    fontSize: "clamp(12px, 1.5vw, 24px)", fontWeight: 800,
    background: "#6366f1", color: "#fff",
    border: "none", borderRadius: "clamp(8px, 0.8vw, 12px)",
    cursor: "pointer", fontFamily: "'Inter', sans-serif",
    boxShadow: "0 0 0 3px rgba(99,102,241,0.3), 0 4px 16px rgba(99,102,241,0.25)",
  },
  hostWait: { fontSize: "clamp(11px, 1vw, 17px)", color: "rgba(255,255,255,0.3)", fontStyle: "italic" },

  footer: {
    flexShrink: 0, height: "clamp(44px, 7vh, 68px)",
    display: "flex", alignItems: "center",
    gap: "clamp(8px, 1.5vw, 24px)", padding: "0 clamp(20px, 3vw, 48px)",
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  btn: {
    padding: "clamp(6px, 0.8vh, 12px) clamp(12px, 1.5vw, 22px)",
    fontSize: "clamp(10px, 1vw, 17px)", fontWeight: 700,
    background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 99, cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
};
