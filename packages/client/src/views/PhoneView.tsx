import React from "react";
import { RoomState, Player, PlayerAction } from "@haven/shared";
import { SkyBackground } from "../components/SkyBackground";
import { getGameControllerComponent } from "../games/registry";
import { getSocket } from "../hooks/useSocket";

interface Props {
  roomState: RoomState;
  myPlayer: Player;
}

export function PhoneView({ roomState, myPlayer }: Props) {
  const { room } = roomState;

  // ── In-game: hand the phone over to the game's controller ──────────────────
  if (room.phase !== "lobby") {
    return <PhoneGameStage roomState={roomState} myPlayer={myPlayer} />;
  }

  return (
    <div style={{
      minHeight: "100dvh", position: "relative",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "32px 20px", fontFamily: "'Inter', sans-serif",
      overflow: "hidden", animation: "fadeIn 0.4s ease-out",
    }}>
      <SkyBackground />

      {/* Logo */}
      <div className="nunito" style={{
        position: "relative", zIndex: 1,
        fontSize: 34, fontWeight: 900, color: "#EEF4FF",
        marginBottom: 30, letterSpacing: -0.5,
        textShadow: "0 0 30px rgba(255,255,255,0.5)",
        animation: "glow 4s ease-in-out infinite",
      }}>haven</div>

      {/* Status */}
      <div className="nunito" style={{
        position: "relative", zIndex: 1,
        fontSize: 17, fontWeight: 800, color: "var(--text)",
        marginBottom: 4, textAlign: "center",
      }}>You're in!</div>
      <div className="nunito" style={{
        position: "relative", zIndex: 1,
        fontSize: 13, color: "var(--sky-light)", marginBottom: 36, opacity: 0.8,
      }}>Connected to console</div>

      {/* Room code */}
      <div style={{ textAlign: "center", marginBottom: 40, position: "relative", zIndex: 1 }}>
        <div className="nunito" style={{
          fontSize: 62, fontWeight: 900, letterSpacing: 10,
          color: "var(--sky-light)", lineHeight: 1, marginBottom: 4,
          textShadow: "0 0 28px rgba(255,255,255,0.6)",
        }}>
          {room.code}
        </div>
        <div className="nunito" style={{ fontSize: 11, color: "var(--text-dim)" }}>
          Room Code
        </div>
      </div>

      {/* Player list */}
      <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 8, position: "relative", zIndex: 1 }}>
        <div className="nunito" style={{
          fontSize: 11, fontWeight: 700, color: "var(--text-dim)",
          letterSpacing: 1, marginBottom: 4,
        }}>
          IN THE LOBBY
        </div>

        {room.players.filter(p => !p.isAI).map((p) => (
          <div key={p.id} className="glass" style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", borderRadius: 14,
            border: `1.5px solid ${p.id === myPlayer.id ? `${p.avatarColor}40` : "var(--border)"}`,
            boxShadow: p.id === myPlayer.id ? `0 0 16px ${p.avatarColor}20` : undefined,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: `${p.avatarColor}20`,
              border: `2px solid ${p.avatarColor}55`,
              boxShadow: `0 0 10px ${p.avatarColor}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 16,
              color: p.avatarColor,
            }}>
              {p.name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div className="nunito" style={{
                fontWeight: 700, fontSize: 14,
                color: p.id === myPlayer.id ? "var(--text)" : "var(--text-mid)",
              }}>
                {p.name}
              </div>
              <div className="nunito" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {p.isHost ? "Host · Console" : "Phone Controller"}
              </div>
            </div>
            {p.id === myPlayer.id && (
              <span className="nunito" style={{
                fontSize: 11, fontWeight: 700, color: "var(--horizon)",
                padding: "2px 10px",
                background: "rgba(56,189,248,0.12)",
                border: "1px solid rgba(56,189,248,0.25)",
                borderRadius: 100,
              }}>You</span>
            )}
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: Math.max(0, 4 - room.players.filter(p => !p.isAI).length) }).map((_, i) => (
          <div key={`e-${i}`} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px",
            background: "rgba(255,255,255,0.015)",
            border: "1px dashed rgba(255,255,255,0.07)",
            borderRadius: 14,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              border: "1px dashed rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, color: "var(--text-dim)",
            }}>?</div>
            <span className="nunito" style={{ fontSize: 13, color: "var(--text-dim)" }}>
              Waiting for player…
            </span>
          </div>
        ))}
      </div>

      <div className="nunito" style={{
        position: "absolute", bottom: 24, zIndex: 1,
        fontSize: 11, color: "var(--text-dim)", textAlign: "center",
      }}>
        haven · above the clouds
      </div>
    </div>
  );
}

// ── In-game controller surface ────────────────────────────────────────────────
function PhoneGameStage({ roomState, myPlayer }: Props) {
  const { room, gameState, scores } = roomState;
  const Controller = room.gameId ? getGameControllerComponent(room.gameId) : null;
  const onAction = (a: PlayerAction) => getSocket().emit("player:action", a);

  return (
    <div style={{
      minHeight: "100dvh", position: "relative",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "32px 18px", fontFamily: "'Inter', sans-serif",
      overflow: "hidden", animation: "fadeIn 0.4s ease-out",
    }}>
      <SkyBackground />

      <div className="nunito" style={{
        position: "relative", zIndex: 1,
        fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
        textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 24,
      }}>
        {room.phase === "results" ? "Game over" : "Your move"}
      </div>

      {Controller ? (
        <Controller
          gameState={gameState}
          players={room.players}
          myPlayer={myPlayer}
          scores={scores}
          onAction={onAction}
        />
      ) : (
        <div className="nunito" style={{ position: "relative", zIndex: 1, color: "var(--text-dim)" }}>
          No controller for “{room.gameId}”.
        </div>
      )}

      {room.phase === "results" && (
        <div className="nunito" style={{
          position: "relative", zIndex: 1, marginTop: 28,
          fontSize: 13, color: "var(--text-dim)",
        }}>
          Waiting for the host to continue…
        </div>
      )}
    </div>
  );
}
