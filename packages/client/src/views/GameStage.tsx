import React, { useEffect, useRef, useState } from "react";
import { RoomState, Player, PlayerAction } from "@haven/shared";
import { getGameTVComponent, ControllerInput } from "../games/registry";

interface Props {
  roomState: RoomState;
  myPlayer: Player;
  gameTitle?: string;
  onAction: (action: PlayerAction, playerId?: string) => void;
  onRematch: () => void;
  onBackToLobby: () => void;
  controllerInput?: ControllerInput;
}

export function GameStage({ roomState, myPlayer, gameTitle, onAction, onRematch, onBackToLobby, controllerInput }: Props) {
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
        if (e.control === "left" || e.control === "up")        setResultsFocus(0);
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
      height: "100dvh", display: "flex", flexDirection: "column",
      background: "#0c0c14", color: "#f0f0f8",
      fontFamily: "'Inter', sans-serif", overflow: "hidden",
      position: "relative",
    }}>

      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0, display: "flex", alignItems: "center",
        padding: "0 clamp(20px, 3vw, 40px)",
        height: "clamp(48px, 6vh, 68px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        gap: "clamp(8px, 1.5vw, 20px)",
      }}>
        <span style={{ fontSize: "clamp(18px, 2.5vw, 38px)", fontWeight: 900, letterSpacing: "-0.02em" }}>
          haven
        </span>
        {gameTitle && (
          <>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "clamp(14px, 1.8vw, 28px)" }}>›</span>
            <span style={{ fontSize: "clamp(14px, 1.8vw, 28px)", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
              {gameTitle}
            </span>
          </>
        )}
        <div style={{ flex: 1 }} />
        {myPlayer.isHost && (
          <button
            onClick={onBackToLobby}
            style={{
              padding: "clamp(6px, 0.8vh, 10px) clamp(12px, 1.5vw, 22px)",
              fontSize: "clamp(11px, 1.2vw, 20px)", fontWeight: 700,
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.55)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 99, cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              display: "flex", alignItems: "center", gap: "0.5em",
            }}
          >
            ← Lobby
          </button>
        )}
        {controllerInput && myPlayer.isHost && room.phase === "playing" && (
          <span style={{ fontSize: "clamp(9px, 0.9vw, 14px)", color: "rgba(255,255,255,0.22)" }}>
            B · lobby
          </span>
        )}
      </header>

      {/* ── Game content ──────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "clamp(12px, 2vw, 40px)", minHeight: 0, overflow: "hidden",
        position: "relative", zIndex: 1,
      }}>
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
          <div style={{ color: "rgba(255,255,255,0.4)" }}>
            No display for "{room.gameId}".
          </div>
        )}
      </div>

      {/* ── Results overlay ───────────────────────────────────────────────── */}
      {isResults && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.85)",
        }}>
          <div style={{
            padding: "clamp(28px, 5vh, 60px) clamp(28px, 5vw, 72px)",
            borderRadius: "clamp(16px, 2vw, 28px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: "clamp(14px, 2.5vh, 28px)",
            background: "#15151e",
            border: winnerPlayer
              ? `1px solid ${winnerPlayer.avatarColor}33`
              : "1px solid rgba(255,255,255,0.08)",
          }}>
            {isDraw ? (
              <>
                <div style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>🤝</div>
                <div style={{ fontSize: "clamp(26px, 4vw, 52px)", fontWeight: 900 }}>
                  It&apos;s a Draw!
                </div>
              </>
            ) : winnerPlayer ? (
              <>
                <div style={{ fontSize: "clamp(36px, 5vw, 64px)" }}>🎉</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    fontSize: "clamp(10px, 1.1vw, 16px)", fontWeight: 700, letterSpacing: 2,
                    color: "rgba(255,255,255,0.4)", marginBottom: "0.5em",
                  }}>
                    {winnerPlayer.id === myPlayer.id ? "YOU WIN" : "WINNER"}
                  </div>
                  <div style={{
                    fontSize: "clamp(30px, 5vw, 60px)", fontWeight: 900, lineHeight: 1,
                    color: winnerPlayer.avatarColor,
                    textShadow: `0 0 40px ${winnerPlayer.avatarColor}50`,
                  }}>
                    {winnerPlayer.name}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: "clamp(26px, 4vw, 52px)", fontWeight: 900 }}>Game Over</div>
            )}

            {myPlayer.isHost ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(8px, 1.5vh, 16px)" }}>
                <div style={{ display: "flex", gap: "clamp(10px, 1.5vw, 20px)" }}>
                  <button onClick={onRematch} style={resultBtn(true, !!controllerInput && resultsFocus === 0)}>
                    Play Again
                  </button>
                  <button onClick={onBackToLobby} style={resultBtn(false, !!controllerInput && resultsFocus === 1)}>
                    Back to Lobby
                  </button>
                </div>
                {controllerInput && (
                  <div style={{ fontSize: "clamp(10px, 1vw, 14px)", color: "rgba(255,255,255,0.3)" }}>
                    ← → choose · A confirm
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: "clamp(12px, 1.4vw, 18px)", color: "rgba(255,255,255,0.4)" }}>
                Waiting for the host…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function resultBtn(primary: boolean, focused = false): React.CSSProperties {
  return {
    padding: "clamp(10px, 1.5vh, 18px) clamp(20px, 3vw, 40px)",
    borderRadius: 100, cursor: "pointer",
    fontSize: "clamp(13px, 1.5vw, 22px)", fontWeight: 800, outline: "none",
    border: primary ? "none" : "1px solid rgba(255,255,255,0.15)",
    background: primary ? "#6366f1" : "rgba(255,255,255,0.05)",
    color: primary ? "#fff" : "rgba(255,255,255,0.7)",
    boxShadow: focused ? "0 0 0 3px rgba(99,102,241,0.5)" : "none",
    transition: "box-shadow 0.15s",
    fontFamily: "'Inter', sans-serif",
  };
}
