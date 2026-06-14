import React, { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { RoomState, Player, GameMeta } from "@haven/shared";
import { Character } from "../components/Character";
import { SkyBackground } from "../components/SkyBackground";
import { Profile } from "../hooks/useProfiles";
import { ControllerInput } from "../games/registry";

interface Props {
  roomState: RoomState;
  myPlayer: Player;
  profile: Profile;
  games?: GameMeta[];
  isHost?: boolean;
  onLaunch?: (gameId: string) => void;
  controllerInput?: ControllerInput;
  controllerCount?: number;
}

const UPCOMING = [
  { id: "racer",   name: "Night Racer",   icon: "🏎",  color: "#60A5FA", genre: "Racing"   },
  { id: "battle",  name: "Battle Grid",   icon: "⚔️",  color: "#F87171", genre: "Strategy" },
  { id: "quantum", name: "Quantum Drift", icon: "💠",  color: "#A78BFA", genre: "Puzzle"   },
  { id: "ghost",   name: "Ghost Network", icon: "👻",  color: "#34D399", genre: "Action"   },
  { id: "nova",    name: "Nova Strike",   icon: "⭐",  color: "#FDE68A", genre: "Arcade"   },
  { id: "sync",    name: "Sync Arena",    icon: "⚡",  color: "#38BDF8", genre: "Sport"    },
];

export function ConsoleHomeView({
  roomState, myPlayer, profile, games = [], isHost = false, onLaunch,
  controllerInput, controllerCount = 0,
}: Props) {
  const { room } = roomState;
  const canLaunch = isHost && room.players.length >= 2;

  // ── Time ─────────────────────────────────────────────────────────────────
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr = time.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

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

  // ── Game shelf controller nav ─────────────────────────────────────────────
  const allGames = [...games, ...UPCOMING];
  const [selected, setSelected] = useState(0);
  const selectedRef   = useRef(0); selectedRef.current = selected;
  const canLaunchRef  = useRef(canLaunch); canLaunchRef.current = canLaunch;
  const onLaunchRef   = useRef(onLaunch);  onLaunchRef.current = onLaunch;
  const allGamesRef   = useRef(allGames);  allGamesRef.current = allGames;

  useEffect(() => {
    if (!controllerInput) return;
    return controllerInput((e) => {
      const live = allGamesRef.current;
      if (live.length === 0) return;
      if (e.control === "left")    setSelected((s) => Math.max(0, s - 1));
      if (e.control === "right")   setSelected((s) => Math.min(live.length - 1, s + 1));
      if (e.control === "confirm" && canLaunchRef.current) {
        const g = live[selectedRef.current];
        if (g && games.find((x) => x.id === g.id)) onLaunchRef.current?.(g.id);
      }
      if (e.control === "back") startPairing();
    });
  }, [controllerInput]); // eslint-disable-line

  // ── Bluetooth pairing ─────────────────────────────────────────────────────
  const [btPhase, setBtPhase]     = useState<"idle" | "scanning">("idle");
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

  const btProgress = btPhase === "scanning" ? Math.round(((30 - btSecsLeft) / 30) * 100) : 0;

  // ── Update check / progress ───────────────────────────────────────────────
  const [updateInfo, setUpdateInfo]           = useState<{ latestMessage?: string } | null>(null);
  const [updating, setUpdating]               = useState(false);
  const [updateProgress, setUpdateProgress]   = useState(0);
  const [updateStage, setUpdateStage]         = useState("Starting update…");
  const [serverRestarting, setServerRestarting] = useState(false);
  const failCountRef  = useRef(0);
  const reloadedRef   = useRef(false);

  useEffect(() => {
    const check = () =>
      fetch("/api/check-update")
        .then((r) => r.json())
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
        failCountRef.current = 0;
        setServerRestarting(false);
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

  // ── Render ────────────────────────────────────────────────────────────────
  const c = profile.color;

  return (
    <div style={{
      height: "100dvh", position: "relative",
      display: "flex", flexDirection: "column",
      overflow: "hidden", fontFamily: "'Inter', sans-serif",
      animation: "fadeIn 0.5s ease-out",
    }}>
      <SkyBackground profileColor={c} />

      {/* ── Update overlay ────────────────────────────────────────────── */}
      {updating && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: "rgba(7,9,18,0.95)", backdropFilter: "blur(12px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16,
          animation: "fadeIn 0.3s ease-out",
        }}>
          <div className="nunito" style={{ fontSize: 32, fontWeight: 900, color: "#EEF4FF" }}>
            {serverRestarting ? "Server restarting…" : "Updating Haven…"}
          </div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.55)" }}>
            {serverRestarting ? "Almost there — new version coming up." : updateStage}
          </div>
          <div style={{
            width: 340, height: 4, background: "rgba(255,255,255,0.08)",
            borderRadius: 4, overflow: "hidden", marginTop: 8,
          }}>
            <div style={{
              height: "100%", borderRadius: 4,
              background: `linear-gradient(90deg, ${c}, #818CF8)`,
              width: serverRestarting ? "90%" : `${updateProgress}%`,
              transition: "width 1.2s ease-out",
              ...(serverRestarting ? { animation: "shimmer 2s ease-in-out infinite" } : {}),
            }} />
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", marginTop: 4 }}>
            {serverRestarting ? "Waiting for server…" : "Takes 1–3 minutes on Pi 5"}
          </div>
        </div>
      )}

      {/* ── Update banner ─────────────────────────────────────────────── */}
      {updateInfo && !updating && (
        <div style={{
          position: "relative", zIndex: 20, flexShrink: 0,
          background: `${c}12`,
          borderBottom: `1px solid ${c}30`,
          display: "flex", alignItems: "center",
          padding: "10px 28px", gap: 12,
          animation: "slideUp 0.35s ease-out",
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: c, boxShadow: `0 0 8px ${c}`,
            animation: "dotPulse 2s ease-in-out infinite", flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <span className="nunito" style={{ fontWeight: 800, fontSize: 14, color: "#EEF4FF" }}>
              Update available
            </span>
            {updateInfo.latestMessage && (
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginLeft: 10 }}>
                {updateInfo.latestMessage}
              </span>
            )}
          </div>
          <button onClick={handleUpdate} className="nunito" style={{
            background: c, color: "#0B0C0E",
            border: "none", borderRadius: 100,
            padding: "8px 20px", fontSize: 13, fontWeight: 800, cursor: "pointer",
          }}>Update Now</button>
          <button onClick={() => setUpdateInfo(null)} className="nunito" style={{
            background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 100,
            padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>Later</button>
        </div>
      )}

      {/* ══ TOP NAV ════════════════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0, height: 64, position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", padding: "0 32px",
        background: "rgba(7,9,18,0.6)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        {/* Logo */}
        <div className="nunito" style={{
          fontSize: 26, fontWeight: 900, color: "#EEF4FF",
          letterSpacing: -0.5, marginRight: 40, flexShrink: 0,
          textShadow: "0 0 20px rgba(255,255,255,0.4)",
        }}>haven</div>

        {/* Nav tabs */}
        <div style={{ display: "flex", height: "100%", gap: 4, flex: 1 }}>
          {["Home", "Library", "Settings"].map((tab, i) => (
            <div key={tab} style={{
              padding: "0 18px", height: "100%",
              display: "flex", alignItems: "center",
              borderBottom: i === 0 ? `2px solid ${c}` : "2px solid transparent",
            }}>
              <span className="nunito" style={{
                fontSize: 14, fontWeight: 700,
                color: i === 0 ? "#EEF4FF" : "rgba(255,255,255,0.38)",
              }}>{tab}</span>
            </div>
          ))}
        </div>

        {/* Right: profile + controller + time */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          {controllerCount > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 100,
              background: "rgba(52,211,153,0.1)",
              border: "1px solid rgba(52,211,153,0.3)",
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#34D399", boxShadow: "0 0 6px #34D399",
                animation: "dotPulse 2.5s ease-in-out infinite",
              }} />
              <span className="nunito" style={{ fontSize: 13, fontWeight: 700, color: "#34D399" }}>
                {controllerCount} controller{controllerCount > 1 ? "s" : ""}
              </span>
            </div>
          )}
          {/* Profile badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 14px 4px 4px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 100,
          }}>
            <div style={{
              width: 32, height: 38, overflow: "hidden",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              borderRadius: 8, background: `${c}18`,
            }}>
              <Character config={profile.character} size={26} />
            </div>
            <span className="nunito" style={{ fontWeight: 700, fontSize: 14, color: "#EEF4FF" }}>
              {profile.name}
            </span>
          </div>
          <span className="nunito" style={{
            fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.8)",
            fontVariantNumeric: "tabular-nums",
          }}>{timeStr}</span>
        </div>
      </div>

      {/* ══ HERO ROW ═══════════════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0, position: "relative", zIndex: 1,
        display: "flex", alignItems: "stretch",
        padding: "28px 32px 20px",
        gap: 24,
      }}>
        {/* Welcome — character + text */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 28,
          padding: "24px 32px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 24,
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          position: "relative", overflow: "hidden",
        }}>
          {/* Subtle color wash from profile */}
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(ellipse 60% 100% at 20% 50%, ${c}10 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />

          {/* Character */}
          <div style={{
            flexShrink: 0, position: "relative",
            width: 110, height: 140,
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}>
            <div style={{
              position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
              width: 110, height: 50, borderRadius: "50%",
              background: `radial-gradient(ellipse, ${c}28 0%, transparent 70%)`,
              filter: "blur(8px)",
            }} />
            <Character config={profile.character} size={110} animate />
          </div>

          {/* Text */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 6, letterSpacing: 0.3 }}>
              {dateStr}
            </div>
            <h1 className="nunito" style={{
              fontSize: 40, fontWeight: 900, color: "#EEF4FF",
              lineHeight: 1.1, marginBottom: 10,
              textShadow: "0 2px 24px rgba(0,0,0,0.4)",
            }}>
              Welcome back,{" "}
              <span style={{ color: c, textShadow: `0 0 24px ${c}60` }}>{profile.name}</span>
            </h1>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, maxWidth: 380 }}>
              Your haven is live. Grab your phone, scan the code, and bring your crew.
            </p>
            {/* Status pills */}
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <Pill color="#34D399">● Connected</Pill>
              <Pill color={room.players.length > 1 ? "#FDE68A" : "rgba(255,255,255,0.3)"}>
                {room.players.length} / 4 players
              </Pill>
            </div>
          </div>
        </div>

        {/* QR / Join card */}
        <div style={{
          flexShrink: 0, width: 220,
          padding: "22px 20px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 24,
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 14,
        }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 2, fontFamily: "'DM Mono', monospace" }}>
            JOIN FROM PHONE
          </div>
          <div style={{
            background: "#EEF4FF", padding: 8, borderRadius: 12,
            boxShadow: "0 4px 20px rgba(255,255,255,0.2)",
          }}>
            <QRCodeSVG value={joinUrl} size={110} bgColor="#EEF4FF" fgColor="#070B1E" />
          </div>
          <div className="nunito" style={{
            fontSize: 38, fontWeight: 900, letterSpacing: 10,
            color: "#EEF4FF", lineHeight: 1,
            textShadow: "0 0 16px rgba(255,255,255,0.4)",
          }}>
            {room.code}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", wordBreak: "break-all", textAlign: "center" }}>
            {netAddr}
          </div>
        </div>
      </div>

      {/* ══ GAME SHELF ═════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1, position: "relative", zIndex: 1,
        padding: "0 32px 20px",
        display: "flex", flexDirection: "column",
        minHeight: 0,
      }}>
        {/* Section header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 14,
        }}>
          <span className="nunito" style={{ fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: 1.5 }}>
            {games.length > 0 ? "PLAY NOW" : "COMING SOON"}
          </span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          {controllerInput && (
            <span className="nunito" style={{ fontSize: 12, color: "rgba(255,255,255,0.28)" }}>
              {canLaunch ? "← → · A to play" : isHost ? "need 2 players" : "host picks"}
            </span>
          )}
        </div>

        {/* Tiles */}
        <div style={{
          display: "flex", gap: 12,
          overflowX: "auto", flex: 1,
          paddingBottom: 6, alignItems: "stretch",
        }}>
          {/* Playable games */}
          {games.map((g, i) => {
            const isSel = !!controllerInput && i === selected;
            return (
              <GameTile
                key={g.id}
                icon={g.thumbnail ?? "🎮"}
                name={g.name}
                sub={`${g.minPlayers}–${g.maxPlayers} players`}
                color="#38BDF8"
                selected={isSel}
                dim={!canLaunch}
                onClick={() => canLaunch && onLaunch?.(g.id)}
              />
            );
          })}
          {/* Upcoming */}
          {UPCOMING.map((g, i) => {
            const idx = games.length + i;
            const isSel = !!controllerInput && idx === selected;
            return (
              <GameTile
                key={g.id}
                icon={g.icon}
                name={g.name}
                sub="Coming soon"
                color={g.color}
                selected={isSel}
                dim
                soon
              />
            );
          })}
        </div>
      </div>

      {/* ══ PLAYER BAR ═════════════════════════════════════════════════════ */}
      <div style={{
        flexShrink: 0, position: "relative", zIndex: 10,
        height: 76, display: "flex", alignItems: "center",
        padding: "0 32px", gap: 10,
        background: "rgba(7,9,18,0.75)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
      }}>
        {/* Player slots */}
        {[0, 1, 2, 3].map((i) => {
          const p = room.players[i];
          const isMe = p?.id === myPlayer.id;
          const col = p?.avatarColor ?? "rgba(255,255,255,0.1)";
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 14px",
              background: p ? `${col}08` : "rgba(255,255,255,0.02)",
              border: `1px solid ${p ? `${col}20` : "rgba(255,255,255,0.06)"}`,
              borderRadius: 12,
              transition: "all 0.4s",
              boxShadow: isMe ? `0 0 20px ${col}18` : "none",
              minWidth: 130,
            }}>
              <div style={{
                width: 36, height: 44, flexShrink: 0,
                background: p ? `${col}12` : "rgba(255,255,255,0.03)",
                borderRadius: 8, overflow: "hidden",
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                border: `1px solid ${p ? `${col}18` : "rgba(255,255,255,0.05)"}`,
              }}>
                {p && isMe ? (
                  <Character config={profile.character} size={30} />
                ) : p ? (
                  <span style={{ fontSize: 20, paddingBottom: 2 }}>👤</span>
                ) : (
                  <span style={{ fontSize: 16, opacity: 0.1, paddingBottom: 4 }}>?</span>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="nunito" style={{
                  fontSize: 14, fontWeight: 700,
                  color: p ? "#EEF4FF" : "rgba(255,255,255,0.2)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {p ? p.name : `Player ${i + 1}`}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>
                  {p ? (p.isHost ? "Host" : "Joined") : "Waiting…"}
                </div>
              </div>
              {p && (
                <div style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: col, boxShadow: `0 0 6px ${col}`,
                  animation: "dotPulse 2.5s ease-in-out infinite",
                }} />
              )}
            </div>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* BT / Controller section */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {btPhase === "scanning" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 160 }}>
                <div style={{
                  width: "100%", height: 3,
                  background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden",
                  marginBottom: 5,
                }}>
                  <div style={{
                    height: "100%", borderRadius: 2,
                    background: `linear-gradient(90deg, ${c}, #818CF8)`,
                    width: `${btProgress}%`, transition: "width 1s linear",
                  }} />
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                  Searching… {btSecsLeft}s · hold Xbox + pair
                </div>
              </div>
              <button onClick={() => setBtPhase("idle")} className="nunito" style={{
                background: "none", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 100, padding: "6px 14px",
                fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", cursor: "pointer",
              }}>Cancel</button>
            </div>
          ) : (
            <button onClick={startPairing} className="nunito" style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 100, padding: "8px 20px",
              fontSize: 13, fontWeight: 700,
              color: controllerCount > 0 ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.7)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>🎮</span>
              {controllerCount > 0 ? "Pair another" : "Pair controller"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small shared components ────────────────────────────────────────────────────

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 12px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 100,
    }}>
      <span className="nunito" style={{ fontSize: 13, fontWeight: 600, color }}>{children}</span>
    </div>
  );
}

function GameTile({
  icon, name, sub, color, selected, dim, soon, onClick,
}: {
  icon: string; name: string; sub: string; color: string;
  selected?: boolean; dim?: boolean; soon?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="tile"
      style={{
        flexShrink: 0, width: 148,
        background: `linear-gradient(160deg, ${color}18 0%, rgba(7,9,18,0.7) 100%)`,
        border: selected
          ? `2px solid ${color}`
          : `1px solid ${color}28`,
        borderRadius: 18,
        boxShadow: selected ? `0 0 28px ${color}40, 0 8px 24px rgba(0,0,0,0.4)` : "none",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 8,
        cursor: onClick ? "pointer" : "default",
        opacity: dim ? 0.55 : 1,
        position: "relative", overflow: "hidden",
        transition: "transform 0.18s ease, box-shadow 0.18s ease, opacity 0.2s",
      }}
    >
      {/* Top color stripe */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
      }} />
      <span style={{ fontSize: 34 }}>{icon}</span>
      <span className="nunito" style={{ fontSize: 13, fontWeight: 800, color: "#EEF4FF", textAlign: "center", padding: "0 8px" }}>
        {name}
      </span>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{sub}</span>
      {soon && (
        <div style={{
          position: "absolute", bottom: 8, right: 8,
          padding: "2px 8px", borderRadius: 100,
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'DM Mono', monospace" }}>SOON</span>
        </div>
      )}
    </div>
  );
}
