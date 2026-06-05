import React, { useEffect, useRef, useState } from "react";
import { Player } from "@haven/shared";
import {
  registerGame,
  TVComponentProps,
  ControllerComponentProps,
  ControllerControl,
} from "./registry";

/** Move a 3×3 cursor (0..8) by a d-pad direction, respecting grid edges. */
export function moveCursor(index: number, control: ControllerControl): number {
  const row = Math.floor(index / 3);
  const col = index % 3;
  switch (control) {
    case "up":
      return row > 0 ? index - 3 : index;
    case "down":
      return row < 2 ? index + 3 : index;
    case "left":
      return col > 0 ? index - 1 : index;
    case "right":
      return col < 2 ? index + 1 : index;
    default:
      return index;
  }
}

// Mirror of the server-side state in games/tic-tac-toe/server.py
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

/** The 3×3 grid, shared by the TV and the phone controller. */
function Board({
  state,
  players,
  myId,
  interactive,
  onCell,
  cellSize,
  cursorIndex,
}: {
  state: TTTState;
  players: Player[];
  myId: string;
  interactive: boolean;
  onCell: (index: number) => void;
  cellSize: number;
  cursorIndex?: number | null;
}) {
  const myTurn = state.turn === myId && state.line === null;
  const winningSet = new Set(state.line ?? []);
  const turnColor = playerById(players, state.turn)?.avatarColor ?? "var(--sky)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(3, ${cellSize}px)`,
        gridTemplateRows: `repeat(3, ${cellSize}px)`,
        gap: 10,
      }}
    >
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
              width: cellSize,
              height: cellSize,
              borderRadius: 18,
              outline: isCursor ? `3px solid ${turnColor}` : "none",
              outlineOffset: 2,
              border: inWin
                ? `2px solid ${color}`
                : "1px solid rgba(255,255,255,0.1)",
              background: inWin
                ? `${color}22`
                : empty
                ? "rgba(255,255,255,0.03)"
                : `${color}12`,
              boxShadow: inWin ? `0 0 28px ${color}55` : "none",
              cursor: playable ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: cellSize * 0.55,
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

function statusText(
  state: TTTState,
  players: Player[],
  myId: string,
): string {
  if (state.line !== null) {
    const winner = playerById(players, state.board[state.line[0]]);
    return winner ? `${winner.name} wins!` : "Game over";
  }
  if (state.board.every((c) => c !== null)) return "It's a draw!";
  const turnPlayer = playerById(players, state.turn);
  if (state.turn === myId) return "Your turn";
  return turnPlayer ? `${turnPlayer.name}'s turn` : "…";
}

/** Small X/O legend so players know which mark is theirs. */
function MarkLegend({ state, players }: { state: TTTState; players: Player[] }) {
  return (
    <div style={{ display: "flex", gap: 18 }}>
      {state.order.map((pid) => {
        const p = playerById(players, pid);
        if (!p) return null;
        return (
          <div key={pid} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className="nunito"
              style={{ fontSize: 22, fontWeight: 900, color: p.avatarColor }}
            >
              {state.marks[pid]}
            </span>
            <span className="nunito" style={{ fontSize: 13, color: "var(--text-mid)", fontWeight: 700 }}>
              {p.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TicTacToeTV({ gameState, players, myPlayer, onAction, controllerInput }: TVComponentProps) {
  const state = gameState as TTTState;
  const [cursor, setCursor] = useState(4);

  // Refs so the (stable) controller subscription always reads fresh values
  // without re-subscribing every render.
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
      // Only the player whose turn it is drives the cursor / places a mark.
      if (e.playerId !== s.turn || s.line !== null) return;
      if (e.control === "confirm") {
        const idx = cursorRef.current;
        if (s.board[idx] === null) {
          onActionRef.current({ type: "place", payload: { index: idx } }, e.playerId);
        }
      } else {
        setCursor((c) => moveCursor(c, e.control));
      }
    });
  }, [controllerInput]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
      }}
    >
      <MarkLegend state={state} players={players} />
      <Board
        state={state}
        players={players}
        myId={myPlayer.id}
        interactive
        onCell={(index) => onAction({ type: "place", payload: { index } }, myPlayer.id)}
        cellSize={120}
        cursorIndex={controllerInput ? cursor : null}
      />
      <div className="nunito" style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
        {statusText(state, players, myPlayer.id)}
      </div>
    </div>
  );
}

function TicTacToeController({
  gameState,
  players,
  myPlayer,
  onAction,
}: ControllerComponentProps) {
  const state = gameState as TTTState;
  const myMark = state.marks[myPlayer.id];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 22,
        position: "relative",
        zIndex: 1,
      }}
    >
      {myMark && (
        <div className="nunito" style={{ fontSize: 14, color: "var(--text-mid)", fontWeight: 700 }}>
          You are{" "}
          <span style={{ color: myPlayer.avatarColor, fontWeight: 900, fontSize: 18 }}>
            {myMark}
          </span>
        </div>
      )}
      <Board
        state={state}
        players={players}
        myId={myPlayer.id}
        interactive
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
