import React, { useState, useEffect, useRef } from "react";
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

function useViewport() {
  const [v, setV] = useState({ w: window.innerWidth });
  useEffect(() => {
    const h = () => setV({ w: window.innerWidth });
    window.addEventListener("resize", h); return () => window.removeEventListener("resize", h);
  }, []);
  return v;
}

const UPCOMING = [
  { id: "racer",   name: "Night Racer",   icon: "🏎",  color: "#60A5FA", genre: "Racing"   },
  { id: "battle",  name: "Battle Grid",   icon: "⚔️", color: "#F87171", genre: "Strategy" },
  { id: "quantum", name: "Quantum Drift", icon: "💠",  color: "#A78BFA", genre: "Puzzle"   },
  { id: "ghost",   name: "Ghost Network", icon: "👻",  color: "#34D399", genre: "Action"   },
  { id: "nova",    name: "Nova Strike",   icon: "⭐",  color: "#FDE68A", genre: "Arcade"   },
  { id: "sync",    name: "Sync Arena",    icon: "⚡",  color: "#38BDF8", genre: "Sport"    },
];

function PlayerSlot({ player, index, isMe, profile }: {
  player?: Player; index: number; isMe: boolean; profile?: Profile;
}) {
  const filled = !!player;
  const color  = player?.avatarColor ?? "transparent";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 14px",
      background: filled ? `${color}09` : "rgba(255,255,255,0.02)",
      border: `1px solid ${filled ? `${color}28` : "rgba(255,255,255,0.07)"}`,
      borderRadius: 14,
      boxShadow: isMe ? `0 0 24px ${color}18` : "none",
      transition: "all 0.5s ease",
      animation: filled ? "slideUp 0.4s ease-out" : "none",
    }}>
      <div style={{
        width: 44, height: 52, flexShrink: 0,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: filled ? `${color}10` : "rgba(255,255,255,0.02)",
        borderRadius: 10, overflow: "hidden",
        border: `1px solid ${filled ? `${color}20` : "rgba(255,255,255,0.06)"}`,
      }}>
        {filled && profile ? (
          <Character config={profile.character} size={36} />
        ) : (
          <span style={{ fontSize: 18, opacity: 0.12, paddingBottom: 4 }}>?</span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="nunito" style={{
          fontSize: 13, fontWeight: 700,
          color: filled ? "var(--text)" : "var(--text-dim)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {filled ? player!.name : `Player ${index + 1}`}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 1 }}>
          {filled ? (player!.isHost ? "Host · Console" : "Phone") : "Waiting…"}
        </div>
      </div>
      <div style={{
        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
        background: filled ? color : "rgba(255,255,255,0.08)",
        boxShadow: filled ? `0 0 8px ${color}` : "none",
        animation: filled ? "dotPulse 2.5s ease-in-out infinite" : "none",
      }} />
    </div>
  );
}

export function ConsoleHomeView({
  roomState, myPlayer, profile, games = [], isHost = false, onLaunch,
  controllerInput, controllerCount = 0,
}: Props) {
  const { room } = roomState;
  const canLaunch = isHost && room.players.length >= 2;

  // ── Controller navigation of the game shelf ──────────────────────────────
  const [selected, setSelected] = useState(0);
  const selectedRef = useRef(0); selectedRef.current = selected;
  const gamesRef = useRef(games); gamesRef.current = games;
  const canLaunchRef = useRef(canLaunch); canLaunchRef.current = canLaunch;
  const onLaunchRef = useRef(onLaunch); onLaunchRef.current = onLaunch;

  useEffect(() => {
    if (!controllerInput) return;
    return controllerInput((e) => {
      const n = gamesRef.current.length;
      if (n === 0) return;
      if (e.control === "left") setSelected((s) => Math.max(0, s - 1));
      else if (e.control === "right") setSelected((s) => Math.min(n - 1, s + 1));
      else if (e.control === "confirm") {
        // Only the host can actually start; the server enforces this too.
        if (canLaunchRef.current) onLaunchRef.current?.(gamesRef.current[selectedRef.current]?.id);
      }
    });
  }, [controllerInput]);

  const { w }    = useViewport();
  const isMobile = w < 900;
  const [time, setTime]     = useState(new Date());
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const c = setInterval(() => setTime(new Date()), 1000);
    const u = setInterval(() => setUptime(s => s + 1), 1000);
    return () => { clearInterval(c); clearInterval(u); };
  }, []);

  const timeStr    = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  const dateStr    = time.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  const joinUrl    = `${window.location.origin}?join=${room.code}`;
  const netAddr    = `${window.location.hostname}${window.location.port && !["80","443"].includes(window.location.port) ? `:${window.location.port}` : ""}`;
  const sessionStr = `${String(Math.floor(uptime/60)).padStart(2,"0")}:${String(uptime%60).padStart(2,"0")}`;

  return (
    <div style={{
      height: "100dvh", position: "relative",
      display: "flex", flexDirection: "column",
      overflow: "hidden", fontFamily: "'Inter', sans-serif",
      animation: "fadeIn 0.5s ease-out",
    }}>

      <SkyBackground />

      {/* ── Top nav ────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative", zIndex: 10, flexShrink: 0, height: 58,
        background: "rgba(4,9,28,0.75)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center",
        padding: isMobile ? "0 16px" : "0 28px",
      }}>
        {/* Brand */}
        <div className="nunito" style={{
          fontSize: 22, fontWeight: 900, color: "#EEF4FF",
          letterSpacing: -0.5, marginRight: isMobile ? 0 : 36, flexShrink: 0,
          textShadow: "0 0 24px rgba(255,255,255,0.5)",
        }}>
          haven
        </div>

        {/* Tabs */}
        {!isMobile && (
          <div style={{ display: "flex", height: "100%", gap: 2 }}>
            {["Home", "Library", "Social", "Settings"].map((tab, i) => (
              <div key={tab} style={{
                padding: "0 16px", height: "100%",
                display: "flex", alignItems: "center",
                borderBottom: i === 0 ? "2px solid var(--sky)" : "2px solid transparent",
              }}>
                <span className="nunito" style={{
                  fontSize: 13, fontWeight: 700,
                  color: i === 0 ? "var(--text)" : "var(--text-dim)",
                }}>{tab}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: isMobile ? 10 : 20 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "4px 14px 4px 4px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 100,
          }}>
            <div style={{
              width: 30, height: 36, overflow: "hidden",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              borderRadius: 8, background: `${profile.color}14`,
            }}>
              <Character config={profile.character} size={24} />
            </div>
            {!isMobile && (
              <span className="nunito" style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>
                {profile.name}
              </span>
            )}
          </div>
          {controllerCount > 0 && (
            <div className="nunito" title="Bluetooth controllers connected" style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 100,
              background: "rgba(52,211,153,0.12)",
              border: "1px solid rgba(52,211,153,0.4)",
              fontSize: 13, fontWeight: 800, color: "#34D399",
            }}>
              <span style={{ fontSize: 14 }}>🎮</span>×{controllerCount}
            </div>
          )}
          <span className="nunito" style={{
            fontSize: 14, fontWeight: 800, color: "var(--text)",
            fontVariantNumeric: "tabular-nums",
          }}>{timeStr}</span>
        </div>

        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3) 30%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.3) 70%, transparent)",
        }} />
      </div>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <div style={{
        flex: 1, position: "relative", zIndex: 1,
        display: "flex", flexDirection: isMobile ? "column" : "row",
        overflow: isMobile ? "auto" : "hidden",
      }}>

        {/* ── LEFT ──────────────────────────────────────────────────────── */}
        <div style={{
          flex: isMobile ? "0 0 auto" : "0 0 63%",
          padding: isMobile ? "18px 14px 14px" : "24px 18px 18px 24px",
          display: "flex", flexDirection: "column", gap: 18,
          overflow: isMobile ? "visible" : "hidden",
        }}>

          {/* ── Hero panel ─────────────────────────────────────────────── */}
          <div className="glass" style={{
            flex: isMobile ? "0 0 auto" : 1,
            borderRadius: 24, overflow: "hidden",
            display: "flex", alignItems: "stretch",
            minHeight: isMobile ? 230 : undefined,
            position: "relative",
          }}>
            {/* Shimmer effect */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              overflow: "hidden", borderRadius: 24, pointerEvents: "none", zIndex: 1,
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, bottom: 0, width: "60%",
                background: "linear-gradient(105deg, transparent 40%, rgba(200,225,255,0.04) 50%, transparent 60%)",
                animation: "shimmer 8s ease-in-out infinite",
              }} />
            </div>

            {/* Character showcase */}
            <div style={{
              width: isMobile ? 130 : 190, flexShrink: 0,
              background: `linear-gradient(160deg, ${profile.color}18 0%, rgba(8,18,52,0.5) 100%)`,
              borderRight: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              position: "relative", overflow: "hidden",
            }}>
              {/* Character glow floor */}
              <div style={{
                position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
                width: 200, height: 200, borderRadius: "50%",
                background: `radial-gradient(circle, ${profile.color}20 0%, transparent 70%)`,
              }} />
              {/* Cloud mist at feet */}
              <div style={{
                position: "absolute", bottom: 0, left: -20, right: -20,
                height: 60,
                background: "linear-gradient(180deg, transparent 0%, rgba(180,210,255,0.08) 60%, rgba(200,220,255,0.14) 100%)",
                filter: "blur(8px)",
              }} />
              <Character config={profile.character} size={isMobile ? 108 : 150} animate />
            </div>

            {/* Welcome text */}
            <div style={{
              flex: 1, padding: isMobile ? "22px 18px" : "32px 32px",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 8, letterSpacing: 0.5 }}>
                  {dateStr}
                </div>
                <h1 className="nunito" style={{
                  fontSize: isMobile ? 24 : 40, fontWeight: 900,
                  color: "var(--text)", lineHeight: 1.15, marginBottom: 12,
                  textShadow: "0 2px 20px rgba(0,0,0,0.5)",
                }}>
                  Welcome back,{" "}
                  <span style={{
                    color: "var(--sun)",
                    textShadow: "0 0 20px rgba(253,226,138,0.5)",
                  }}>
                    {profile.name}
                  </span>
                </h1>
                <p style={{
                  color: "var(--text-mid)", fontSize: isMobile ? 13 : 14,
                  lineHeight: 1.7, maxWidth: 420,
                }}>
                  Your haven floats above the clouds, ready when you are. Grab your phone, scan the code, and bring your crew.
                </p>
              </div>

              {/* Status pills */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20 }}>
                {[
                  { label: "Connected",               active: true,  color: "var(--horizon)"  },
                  { label: `${room.players.length} / 4 players`, active: room.players.length > 1, color: "var(--sun)" },
                  { label: `${sessionStr}`,           active: false, color: null },
                ].map(({ label, active, color }) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 13px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 100,
                  }}>
                    {color && (
                      <div style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: color as string,
                        boxShadow: active ? `0 0 8px ${color}` : "none",
                        opacity: active ? 1 : 0.4,
                        animation: active ? "dotPulse 2.5s ease-in-out infinite" : "none",
                      }} />
                    )}
                    <span className="nunito" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-mid)" }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Playable games ─────────────────────────────────────────── */}
          {games.length > 0 && (
            <div style={{ flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <span className="nunito" style={{ fontWeight: 800, fontSize: 13, color: "var(--text)" }}>
                  Games
                </span>
                <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(255,255,255,0.15), transparent)" }} />
                <span className="nunito" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  {!canLaunch
                    ? (isHost ? "Need 2 players" : "Host picks")
                    : controllerInput
                    ? "← → select · A to play"
                    : "Tap to play"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                {games.map((g, i) => {
                  const isSel = !!controllerInput && i === selected;
                  return (
                  <button
                    key={g.id}
                    onClick={() => canLaunch && onLaunch?.(g.id)}
                    disabled={!canLaunch}
                    className="tile glass nunito"
                    style={{
                      width: isMobile ? 124 : 152, height: isMobile ? 96 : 118,
                      borderRadius: 16, flexShrink: 0,
                      background: "linear-gradient(145deg, rgba(56,189,248,0.14) 0%, rgba(8,18,52,0.7) 100%)",
                      border: isSel ? "2px solid var(--sky)" : "1px solid rgba(56,189,248,0.25)",
                      boxShadow: isSel ? "0 0 24px rgba(56,189,248,0.45)" : "none",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 8,
                      cursor: canLaunch ? "pointer" : "default",
                      opacity: canLaunch ? 1 : 0.55,
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    <span style={{ fontSize: isMobile ? 26 : 32 }}>{g.thumbnail ?? "🎮"}</span>
                    <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 800, color: "var(--text)" }}>
                      {g.name}
                    </span>
                    <span style={{ fontSize: 9, color: "var(--text-dim)" }}>
                      {g.minPlayers === g.maxPlayers ? `${g.minPlayers} players` : `${g.minPlayers}–${g.maxPlayers} players`}
                    </span>
                  </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Library shelf ──────────────────────────────────────────── */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <span className="nunito" style={{ fontWeight: 800, fontSize: 13, color: "var(--text-mid)" }}>
                Coming Soon
              </span>
              <div style={{
                flex: 1, height: 1,
                background: "linear-gradient(90deg, rgba(255,255,255,0.15), transparent)",
              }} />
              <span className="nunito" style={{
                fontSize: 11, color: "var(--text-dim)",
                padding: "3px 10px", borderRadius: 100,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                {UPCOMING.length} titles
              </span>
            </div>

            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
              {UPCOMING.map((g) => (
                <div key={g.id} className="tile glass" style={{
                  width: isMobile ? 116 : 144, height: isMobile ? 90 : 112,
                  borderRadius: 16, flexShrink: 0,
                  background: `linear-gradient(145deg, ${g.color}12 0%, rgba(8,18,52,0.7) 100%)`,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  gap: 7, cursor: "default", position: "relative", overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 2,
                    background: `linear-gradient(90deg, transparent, ${g.color}55, transparent)`,
                  }} />
                  <span style={{ fontSize: isMobile ? 24 : 30, position: "relative" }}>{g.icon}</span>
                  <span className="nunito" style={{
                    fontSize: isMobile ? 10 : 11, fontWeight: 700,
                    color: "var(--text-mid)", position: "relative",
                  }}>{g.name}</span>
                  <div style={{
                    position: "absolute", bottom: 7, right: 8,
                    padding: "2px 7px", borderRadius: 100,
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}>
                    <span style={{ fontSize: 8, color: "var(--text-dim)" }}>SOON</span>
                  </div>
                </div>
              ))}
              <div className="glass" style={{
                width: isMobile ? 96 : 118, height: isMobile ? 90 : 112,
                flexShrink: 0, borderRadius: 16,
                border: "1px dashed rgba(255,255,255,0.08)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 4, color: "var(--text-dim)", cursor: "default",
                background: "rgba(255,255,255,0.01)",
              }}>
                <span style={{ fontSize: 20 }}>+</span>
                <span className="nunito" style={{ fontSize: 9, fontWeight: 700 }}>Submit</span>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        {!isMobile ? (
          <div style={{
            width: 1, flexShrink: 0, margin: "20px 0",
            background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.1) 20%, rgba(255,255,255,0.1) 80%, transparent)",
          }} />
        ) : (
          <div style={{ height: 1, margin: "0 14px", background: "rgba(255,255,255,0.08)" }} />
        )}

        {/* ── RIGHT ─────────────────────────────────────────────────────── */}
        <div style={{
          flex: isMobile ? "0 0 auto" : "0 0 37%",
          padding: isMobile ? "14px 14px 22px" : "24px 24px 18px 18px",
          display: "flex", flexDirection: "column", gap: 14,
          overflow: isMobile ? "visible" : "hidden",
        }}>

          {/* Connect card */}
          <div className="glass" style={{ borderRadius: 22, padding: isMobile ? 16 : 22, flexShrink: 0 }}>
            <div className="nunito" style={{
              fontSize: 10, fontWeight: 700, color: "var(--text-dim)",
              letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16,
            }}>
              Join from your phone
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {/* QR — pearl/cloud background */}
              <div style={{
                background: "#EEF4FF", padding: 9, borderRadius: 14, flexShrink: 0,
                boxShadow: "0 4px 24px rgba(255,255,255,0.35), 0 0 0 1px rgba(255,255,255,0.1)",
              }}>
                <QRCodeSVG value={joinUrl} size={isMobile ? 86 : 104} bgColor="#EEF4FF" fgColor="#070B1E" />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, marginBottom: 4 }}>
                  ROOM CODE
                </div>
                <div className="nunito" style={{
                  fontSize: isMobile ? 34 : 42, fontWeight: 900,
                  letterSpacing: 8, color: "var(--sky-light)", lineHeight: 1, marginBottom: 14,
                  textShadow: "0 0 20px rgba(255,255,255,0.55)",
                }}>
                  {room.code}
                </div>
                <div style={{ fontSize: 9, color: "var(--text-dim)", letterSpacing: 2, marginBottom: 4 }}>
                  NETWORK
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--text-mid)", wordBreak: "break-all" }}>
                  {netAddr}
                </div>
              </div>
            </div>
          </div>

          {/* Players card */}
          <div className="glass" style={{
            borderRadius: 22, padding: isMobile ? 16 : 22,
            flex: isMobile ? "0 0 auto" : 1,
            display: "flex", flexDirection: "column",
            overflow: isMobile ? "visible" : "hidden",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 16,
            }}>
              <div className="nunito" style={{
                fontSize: 10, fontWeight: 700, color: "var(--text-dim)",
                letterSpacing: 1.5, textTransform: "uppercase",
              }}>Players</div>
              <span className="nunito" style={{
                fontSize: 12, fontWeight: 700,
                color: room.players.length > 1 ? "var(--sky)" : "var(--text-dim)",
              }}>
                {room.players.length} / 4
              </span>
            </div>
            {controllerCount > 0 && room.players.length < 4 && (
              <div className="nunito" style={{
                fontSize: 11, color: "var(--text-dim)", marginBottom: 12,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <span>🎮</span> Press a button on another controller to add a player
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              {[0, 1, 2, 3].map((i) => (
                <PlayerSlot
                  key={i}
                  player={room.players[i]}
                  index={i}
                  isMe={room.players[i]?.id === myPlayer.id}
                  profile={room.players[i]?.id === myPlayer.id ? profile : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────── */}
      <div style={{
        height: 30, flexShrink: 0, position: "relative", zIndex: 10,
        background: "rgba(4,9,28,0.85)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center",
        padding: "0 24px", gap: 14, overflow: "hidden",
      }}>
        <span className="nunito" style={{ fontSize: 11, fontWeight: 800, color: "var(--text-dim)", flexShrink: 0 }}>
          haven
        </span>
        <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.12)" }} />
        <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)", flexShrink: 0 }}>
          {room.code}
        </span>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 80, animation: "marquee 32s linear infinite", whiteSpace: "nowrap" }}>
            {[...Array(2)].map((_,i) => (
              <span key={i} className="mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.1)", letterSpacing: 2 }}>
                HAVEN · ABOVE THE CLOUDS · HOME GAMING PLATFORM · CONNECT VIA QR · UP TO 4 PLAYERS · GAMES COMING SOON · THE FUTURE OF LIVING ROOM GAMING
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--horizon)", boxShadow: "0 0 8px rgba(56,189,248,0.7)",
            animation: "dotPulse 2.5s ease-in-out infinite",
          }} />
          <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>LIVE</span>
        </div>
      </div>
    </div>
  );
}
