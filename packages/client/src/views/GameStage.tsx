import React, { useEffect, useRef, useState } from "react";
import { RoomState, Player, PlayerAction } from "@haven/shared";
import { getGameTVComponent, ControllerInput } from "../games/registry";

interface Props {
  roomState: RoomState;
  myPlayer: Player;
  onAction: (action: PlayerAction, playerId?: string) => void;
  onRematch: () => void;
  onBackToLobby: () => void;
  controllerInput?: ControllerInput;
}

export function GameStage({ roomState, myPlayer, onAction, onRematch, onBackToLobby, controllerInput }: Props) {
  const { room, gameState, scores, winner } = roomState;
  const TVComponent = room.gameId ? getGameTVComponent(room.gameId) : null;
  const isResults = room.phase === "results";

  const [resultsFocus, setResultsFocus] = useState(0);
  const focusRef   = useRef(0); focusRef.current = resultsFocus;
  const phaseRef   = useRef(room.phase); phaseRef.current = room.phase;
  const isHostRef  = useRef(myPlayer.isHost); isHostRef.current = myPlayer.isHost;
  const myIdRef    = useRef(myPlayer.id); myIdRef.current = myPlayer.id;
  const cbRef      = useRef({ onRematch, onBackToLobby });
  cbRef.current = { onRematch, onBackToLobby };

  useEffect(() => {
    if (!controllerInput) return;
    return controllerInput((e) => {
      if (!isHostRef.current || e.playerId !== myIdRef.current) return;
      if (e.control === "home" || e.control === "back") { cbRef.current.onBackToLobby(); return; }
      if (phaseRef.current === "results") {
        if (e.control === "left" || e.control === "up")   setResultsFocus(0);
        else if (e.control === "right" || e.control === "down") setResultsFocus(1);
        else if (e.control === "confirm") {
          (focusRef.current === 0 ? cbRef.current.onRematch : cbRef.current.onBackToLobby)();
        }
      }
    });
  }, [controllerInput]);

  const winnerPlayer = winner && winner !== "__draw__"
    ? room.players.find((p) => p.id === winner)
    : null;
  const isDraw = winner === "__draw__";

  return (
    <div style={{
      height: "100dvh", position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", fontFamily: "'Inter', sans-serif",
      background: "#0c0c14",
    }}>
      <div style={{ position: "relative", zIndex: 1, width: "100%", padding: "clamp(16px, 3vw, 48px)" }}>
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
          <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center" }}>
            No display for "{room.gameId}".
          </div>
        )}
      </div>

      {/* Results overlay */}
      {isResults && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.85)",
        }}>
          <div style={{
            padding: "clamp(32px, 5vh, 64px) clamp(32px, 6vw, 80px)",
            borderRadius: 24,
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: "clamp(16px, 2.5vh, 28px)",
            background: "#16161f",
            border: winnerPlayer
              ? `1px solid ${winnerPlayer.avatarColor}33`
              : "1px solid rgba(255,255,255,0.08)",
          }}>
            {isDraw ? (
              <>
                <div style={{ fontSize: "clamp(36px, 5vw, 60px)" }}>🤝</div>
                <div style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "#f0f0f8" }}>
                  It&apos;s a Draw!
                </div>
              </>
            ) : winnerPlayer ? (
              <>
                <div style={{ fontSize: "clamp(36px, 5vw, 60px)" }}>🎉</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontSize: "clamp(10px, 1.2vw, 14px)", fontWeight: 700, letterSpacing: 2,
                    color: "rgba(255,255,255,0.4)", marginBottom: 10,
                  }}>
                    {winnerPlayer.id === myPlayer.id ? "YOU WIN" : "WINNER"}
                  </div>
                  <div style={{
                    fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 900, lineHeight: 1,
                    color: winnerPlayer.avatarColor,
                    textShadow: `0 0 40px ${winnerPlayer.avatarColor}50`,
                  }}>
                    {winnerPlayer.name}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 900, color: "#f0f0f8" }}>
                Game Over
              </div>
            )}

            {myPlayer.isHost ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <button onClick={onRematch} style={resultBtn(true, !!controllerInput && resultsFocus === 0)}>
                    Play Again
                  </button>
                  <button onClick={onBackToLobby} style={resultBtn(false, !!controllerInput && resultsFocus === 1)}>
                    Back to Lobby
                  </button>
                </div>
                {controllerInput && (
                  <div style={{ fontSize: "clamp(10px, 1.1vw, 13px)", color: "rgba(255,255,255,0.3)" }}>
                    D-pad to choose · A to select
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: "clamp(12px, 1.4vw, 16px)", color: "rgba(255,255,255,0.4)" }}>
                Waiting for the host…
              </div>
            )}
          </div>
        </div>
      )}

      {room.phase === "playing" && controllerInput && myPlayer.isHost && (
        <div style={{
          position: "absolute", bottom: 16, zIndex: 1,
          fontSize: "clamp(10px, 1.1vw, 13px)", fontWeight: 700, color: "rgba(255,255,255,0.25)",
        }}>
          B · back to lobby
        </div>
      )}
    </div>
  );
}

function resultBtn(primary: boolean, focused = false): React.CSSProperties {
  return {
    padding: "clamp(10px, 1.5vh, 16px) clamp(20px, 3vw, 36px)",
    borderRadius: 100, cursor: "pointer",
    fontSize: "clamp(13px, 1.5vw, 17px)", fontWeight: 800, outline: "none",
    border: primary ? "none" : "1px solid rgba(255,255,255,0.15)",
    background: primary ? "#6366f1" : "rgba(255,255,255,0.05)",
    color: primary ? "#fff" : "rgba(255,255,255,0.7)",
    boxShadow: focused ? `0 0 0 3px rgba(99,102,241,0.5)` : "none",
    transition: "box-shadow 0.15s",
    fontFamily: "'Inter', sans-serif",
  };
}
