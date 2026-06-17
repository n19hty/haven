import React, { useEffect, useRef, useState } from "react";
import { Player } from "@haven/shared";
import {
  registerGame,
  TVComponentProps,
  ControllerComponentProps,
  ControllerControl,
} from "./registry";

export function moveCursor(index: number, control: ControllerControl): number {
  const row = Math.floor(index / 3);
  const col = index % 3;
  switch (control) {
    case "up":    return row > 0 ? index - 3 : index;
    case "down":  return row < 2 ? index + 3 : index;
    case "left":  return col > 0 ? index - 1 : index;
    case "right": return col < 2 ? index + 1 : index;
    default:      return index;
  }
}

interface TTTState {
  board: (string | null)[];
  marks: Record<string, "X" | "O">;
  order: string[];
  turn: string;
  line: number[] | null;
}

function playerById(players: Player[], id: string | null): Player | undefined {
  return id ? players.find((p) => p.id === id) : undefined;
}

function Board({
  state, players, myId, interactive, onCell, cellSize, gap = 10, cursorIndex,
}: {
  state: TTTState;
  players: Player[];
  myId: string;
  interactive: boolean;
  onCell: (index: number) => void;
  cellSize: number;
  gap?: number;
  cursorIndex?: number | null;
}) {
  const myTurn = state.turn === myId && state.line === null;
  const winningSet = new Set(state.line ?? []);
  const turnColor = playerById(players, state.turn)?.avatarColor ?? "var(--sky)";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(3, ${cellSize}px)`,
      gridTemplateRows: `repeat(3, ${cellSize}px)`,
      gap,
    }}>
      {state.board.map((owner, i) => {
        const ownerPlayer = playerById(players, owner);
        const mark = owner ? state.marks[owner] : null;
        const color = ownerPlayer?.avatarColor ?? "var(--text)";
        const empty = owner === null;
        const playable = interactive && myTurn && empty;
        const inWin = winningSet.has(i);
        const isCursor = cursorIndex === i && state.line === null;

        return (
          <button
            key={i}
            onClick={() => playable && onCell(i)}
            disabled={!playable}
            className="glass nunito"
            style={{
              width: cellSize, height: cellSize,
              borderRadius: Math.round(cellSize * 0.14),
              outline: isCursor ? `4px solid ${turnColor}` : "none",
              outlineOffset: 3,
              border: inWin
                ? `2px solid ${color}`
                : "1px solid rgba(255,255,255,0.08)",
              background: inWin
                ? `${color}22`
                : empty ? "rgba(255,255,255,0.03)" : `${color}12`,
              boxShadow: inWin ? `0 0 36px ${color}55` : "none",
              cursor: playable ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: Math.round(cellSize * 0.5),
              fontWeight: 900,
              color,
              transition: "all 0.2s ease",
              padding: 0,
            }}
          >
            {mark}
          </button>
        );
      })}
    </div>
  );
}

function statusText(state: TTTState, players: Player[], myId: string): string {
  if (state.line !== null) {
    const winner = playerById(players, state.board[state.line[0]]);
    return winner ? `${winner.name} wins!` : "Game over";
  }
  if (state.board.every((c) => c !== null)) return "It's a draw!";
  const turnPlayer = playerById(players, state.turn);
  if (state.turn === myId) return "Your turn";
  return turnPlayer ? `${turnPlayer.name}'s turn` : "…";
}

function PlayerCard({
  player, mark, scores, turn, myId, isOver, cellSize,
}: {
  player: Player | undefined;
  mark: "X" | "O";
  scores: Record<string, number>;
  turn: string;
  myId: string;
  isOver: boolean;
  cellSize: number;
}) {
  const cardW = Math.max(100, Math.floor(cellSize * 1.3));
  if (!player) return <div style={{ width: cardW }} />;
  const isActive = !isOver && turn === player.id;
  const isMe = player.id === myId;
  const col = player.avatarColor;
  const score = scores[player.id] ?? 0;

  return (
    <div style={{
      width: cardW, padding: `clamp(14px, 2vw, 28px) clamp(10px, 1.5vw, 20px)`,
      borderRadius: 20, textAlign: "center",
      background: isActive ? `${col}12` : "rgba(255,255,255,0.03)",
      border: `2px solid ${isActive ? col : "rgba(255,255,255,0.06)"}`,
      boxShadow: isActive ? `0 0 40px ${col}20` : "none",
      transition: "all 0.3s ease",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      flexShrink: 0,
    }}>
      <div style={{
        fontSize: "clamp(9px, 1vw, 12px)", fontWeight: 800, letterSpacing: 1.5,
        color: isActive ? "#f0f0f8" : "rgba(255,255,255,0.28)",
        transition: "color 0.3s",
      }}>
        {isMe ? "YOU" : player.isAI ? "COMPUTER" : player.name.toUpperCase()}
      </div>

      <div style={{
        fontSize: `clamp(40px, ${Math.round(cellSize * 0.5)}px, 120px)`,
        fontWeight: 900, lineHeight: 1,
        color: col,
        opacity: isActive ? 1 : 0.25,
        textShadow: isActive ? `0 0 32px ${col}80` : "none",
        transition: "all 0.3s",
      }}>
        {mark}
      </div>

      <div style={{
        fontSize: `clamp(28px, ${Math.round(cellSize * 0.35)}px, 80px)`,
        fontWeight: 900, lineHeight: 1,
        color: isActive ? "#f0f0f8" : "rgba(255,255,255,0.18)",
        fontVariantNumeric: "tabular-nums",
        transition: "color 0.3s",
      }}>
        {score}
      </div>

      <div style={{
        padding: "4px 10px", borderRadius: 100,
        background: isActive ? `${col}18` : "transparent",
        border: `1px solid ${isActive ? col + "30" : "rgba(255,255,255,0.05)"}`,
        transition: "all 0.3s",
      }}>
        <span style={{
          fontSize: "clamp(8px, 0.9vw, 11px)", fontWeight: 800, letterSpacing: 1,
          color: isActive ? col : "rgba(255,255,255,0.12)",
        }}>
          {isActive ? (isMe ? "YOUR TURN" : "THEIR TURN") : "WAITING"}
        </span>
      </div>
    </div>
  );
}

function TicTacToeTV({ gameState, players, scores, myPlayer, onAction, controllerInput }: TVComponentProps) {
  const state = gameState as TTTState;
  const [cursor, setCursor] = useState(4);

  // Responsive cell size: 22% of the shorter viewport side.
  // No tight upper cap — a 65" TV at 1080p has 1080px height → ~237px per cell.
  const [cellSize, setCellSize] = useState(() =>
    Math.max(72, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.22))
  );
  useEffect(() => {
    const update = () =>
      setCellSize(Math.max(72, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.22)));
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const stateRef = useRef(state);
  stateRef.current = state;
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  useEffect(() => {
    if (!controllerInput) return;
    return controllerInput((e) => {
      const s = stateRef.current;
      if (s.line !== null) return;
      if (e.control === "confirm") {
        if (e.playerId !== s.turn) return;
        const idx = cursorRef.current;
        if (s.board[idx] === null) {
          onActionRef.current({ type: "place", payload: { index: idx } }, e.playerId);
        }
      } else {
        setCursor((c) => moveCursor(c, e.control));
      }
    });
  }, [controllerInput]);

  const playerX = players.find((p) => p.id === state.order[0]);
  const playerO = players.find((p) => p.id === state.order[1]);
  const isOver = state.line !== null || state.board.every((c) => c !== null);
  const gap = Math.max(6, Math.floor(cellSize * 0.07));

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: "clamp(16px, 3vw, 48px)",
      width: "100%",
    }}>
      <PlayerCard
        player={playerX} mark="X" scores={scores}
        turn={state.turn} myId={myPlayer.id} isOver={isOver}
        cellSize={cellSize}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <Board
          state={state} players={players}
          myId={myPlayer.id} interactive
          onCell={(index) => onAction({ type: "place", payload: { index } }, myPlayer.id)}
          cellSize={cellSize} gap={gap}
          cursorIndex={controllerInput ? cursor : null}
        />
        <div style={{ fontSize: "clamp(14px, 1.8vw, 22px)", fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>
          {statusText(state, players, myPlayer.id)}
        </div>
        {controllerInput && !isOver && (
          <div style={{ fontSize: "clamp(10px, 1.1vw, 13px)", color: "rgba(255,255,255,0.2)", letterSpacing: 1 }}>
            D-pad to move · A to place
          </div>
        )}
      </div>

      <PlayerCard
        player={playerO} mark="O" scores={scores}
        turn={state.turn} myId={myPlayer.id} isOver={isOver}
        cellSize={cellSize}
      />
    </div>
  );
}

function TicTacToeController({ gameState, players, myPlayer, onAction }: ControllerComponentProps) {
  const state = gameState as TTTState;
  const myMark = state.marks[myPlayer.id];
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: 22,
      position: "relative", zIndex: 1,
    }}>
      {myMark && (
        <div className="nunito" style={{ fontSize: 14, color: "var(--text-mid)", fontWeight: 700 }}>
          You are{" "}
          <span style={{ color: myPlayer.avatarColor, fontWeight: 900, fontSize: 18 }}>
            {myMark}
          </span>
        </div>
      )}
      <Board
        state={state} players={players}
        myId={myPlayer.id} interactive
        onCell={(index) => onAction({ type: "place", payload: { index } })}
        cellSize={88}
      />
      <div className="nunito" style={{ fontSize: 18, fontWeight: 800, color: "var(--text)" }}>
        {statusText(state, players, myPlayer.id)}
      </div>
    </div>
  );
}

registerGame("tic-tac-toe", {
  TVComponent: TicTacToeTV,
  ControllerComponent: TicTacToeController,
});
