import { useState, useCallback } from "react";
import { Player, RoomState } from "@haven/shared";

export type AppMode = "boot" | "login" | "entry" | "tv" | "phone";

export interface GameStore {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  myPlayer: Player | null;
  setMyPlayer: (p: Player | null) => void;
  roomState: RoomState | null;
  setRoomState: (s: RoomState) => void;
  error: string | null;
  setError: (e: string | null) => void;
}

export function useGameStore(): GameStore {
  const [mode, setMode] = useState<AppMode>("boot");
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);

  return {
    mode, setMode,
    myPlayer, setMyPlayer,
    roomState, setRoomState: useCallback(setRoomState, []),
    error, setError,
  };
}
