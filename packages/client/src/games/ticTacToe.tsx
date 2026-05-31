import React from "react";
import { Player } from "@haven/shared";
import {
  registerGame,
  TVComponentProps,
  ControllerComponentProps,
} from "./registry";

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
}: {
  state: TTTState;
  players: Player[];
  myId: string;
  interactive: boolean;
  onCell: (index: number) => void;
  cellSize: number;
}) {
  const myTurn = state.turn === myId && state.line === null;
  const winningSet = new Set(state.line ?? []);

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

function TicTacToeTV({ gameState, players, myPlayer, onAction }: TVComponentProps) {
  const state = gameState as TTTState;
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
        onCell={(index) => onAction({ type: "place", payload: { index } })}
        cellSize={120}
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
