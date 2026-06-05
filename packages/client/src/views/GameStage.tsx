import React from "react";
import { RoomState, Player, PlayerAction } from "@haven/shared";
import { SkyBackground } from "../components/SkyBackground";
import { getGameTVComponent, ControllerInput } from "../games/registry";

interface Props {
  roomState: RoomState;
  myPlayer: Player;
  onAction: (action: PlayerAction, playerId?: string) => void;
  onRematch: () => void;
  onBackToLobby: () => void;
  controllerInput?: ControllerInput;
}

/** The TV surface while a game is in progress or showing results. */
export function GameStage({ roomState, myPlayer, onAction, onRematch, onBackToLobby, controllerInput }: Props) {
  const { room, gameState, scores } = roomState;
  const TVComponent = room.gameId ? getGameTVComponent(room.gameId) : null;
  const isResults = room.phase === "results";

  return (
    <div style={{
      height: "100dvh", position: "relative",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", overflow: "hidden",
      fontFamily: "'Inter', sans-serif", animation: "fadeIn 0.5s ease-out",
    }}>
      <SkyBackground />

      {/* Scoreboard */}
      <div style={{
        position: "relative", zIndex: 1, display: "flex", gap: 28, marginBottom: 36,
      }}>
        {room.players.map((p) => (
          <div key={p.id} className="glass" style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 18px", borderRadius: 14,
            border: `1px solid ${p.avatarColor}33`,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: p.avatarColor, boxShadow: `0 0 10px ${p.avatarColor}`,
            }} />
            <span className="nunito" style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>
              {p.name}
            </span>
            <span className="nunito" style={{
              fontWeight: 900, fontSize: 18, color: p.avatarColor,
              fontVariantNumeric: "tabular-nums",
            }}>
              {scores[p.id] ?? 0}
            </span>
          </div>
        ))}
      </div>

      {/* The game itself */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {TVComponent ? (
          <TVComponent
            gameState={gameState}
            players={room.players}
            scores={scores}
            myPlayer={myPlayer}
            onAction={onAction}
            controllerInput={controllerInput}
          />
        ) : (
          <div className="nunito" style={{ color: "var(--text-dim)" }}>
            No display for “{room.gameId}”.
          </div>
        )}
      </div>

      {/* Results controls (host only) */}
      {isResults && (
        <div style={{
          position: "relative", zIndex: 1, marginTop: 40,
          display: "flex", gap: 14,
        }}>
          {myPlayer.isHost ? (
            <>
              <button onClick={onRematch} className="nunito" style={btn(true)}>Play again</button>
              <button onClick={onBackToLobby} className="nunito" style={btn(false)}>Back to lobby</button>
            </>
          ) : (
            <div className="nunito" style={{ fontSize: 14, color: "var(--text-dim)" }}>
              Waiting for the host…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    padding: "12px 28px", borderRadius: 100, cursor: "pointer",
    fontSize: 15, fontWeight: 800,
    border: primary ? "none" : "1px solid rgba(255,255,255,0.18)",
    background: primary ? "var(--sky)" : "rgba(255,255,255,0.05)",
    color: primary ? "#04091C" : "var(--text)",
    boxShadow: primary ? "0 0 24px rgba(56,189,248,0.4)" : "none",
  };
}
