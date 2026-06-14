import React, { useEffect, useRef, useState } from "react";
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

  // ── Controller handling for the host (results nav + in-game escape) ───────
  const [resultsFocus, setResultsFocus] = useState(0); // 0 = play again, 1 = back to lobby
  const focusRef = useRef(0); focusRef.current = resultsFocus;
  const phaseRef = useRef(room.phase); phaseRef.current = room.phase;
  const isHostRef = useRef(myPlayer.isHost); isHostRef.current = myPlayer.isHost;
  const myIdRef = useRef(myPlayer.id); myIdRef.current = myPlayer.id;
  const cbRef = useRef({ onRematch, onBackToLobby });
  cbRef.current = { onRematch, onBackToLobby };

  useEffect(() => {
    if (!controllerInput) return;
    return controllerInput((e) => {
      // Only the console/host pad drives these menus.
      if (!isHostRef.current || e.playerId !== myIdRef.current) return;
      // Home (Select+Start chord, or Guide button) and Back (B button) both return to lobby.
      if (e.control === "home" || e.control === "back") { cbRef.current.onBackToLobby(); return; }
      if (phaseRef.current === "results") {
        if (e.control === "left" || e.control === "up") setResultsFocus(0);
        else if (e.control === "right" || e.control === "down") setResultsFocus(1);
        else if (e.control === "confirm") {
          (focusRef.current === 0 ? cbRef.current.onRematch : cbRef.current.onBackToLobby)();
        }
      }
    });
  }, [controllerInput]);

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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", gap: 14 }}>
                <button onClick={onRematch} className="nunito" style={btn(true, !!controllerInput && resultsFocus === 0)}>Play again</button>
                <button onClick={onBackToLobby} className="nunito" style={btn(false, !!controllerInput && resultsFocus === 1)}>Back to lobby</button>
              </div>
              {controllerInput && (
                <div className="nunito" style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  D-pad to choose · A to select
                </div>
              )}
            </div>
          ) : (
            <div className="nunito" style={{ fontSize: 14, color: "var(--text-dim)" }}>
              Waiting for the host…
            </div>
          )}
        </div>
      )}

      {room.phase === "playing" && controllerInput && myPlayer.isHost && (
        <div className="nunito" style={{
          position: "absolute", bottom: 16, zIndex: 1,
          fontSize: 12, fontWeight: 700, color: "var(--text-dim)",
        }}>
          B · back to lobby
        </div>
      )}
    </div>
  );
}

function btn(primary: boolean, focused = false): React.CSSProperties {
  return {
    padding: "12px 28px", borderRadius: 100, cursor: "pointer",
    fontSize: 15, fontWeight: 800,
    border: primary ? "none" : "1px solid rgba(255,255,255,0.18)",
    background: primary ? "var(--sky)" : "rgba(255,255,255,0.05)",
    color: primary ? "#04091C" : "var(--text)",
    boxShadow: primary ? "0 0 24px rgba(56,189,248,0.4)" : "none",
    outline: focused ? "3px solid var(--sky-light, #7dd3fc)" : "none",
    outlineOffset: 3,
  };
}
