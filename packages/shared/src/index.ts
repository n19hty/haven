// ─── Player & Room ───────────────────────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  avatarColor: string;
  isHost: boolean;
  isAI?: boolean;
}

export interface Room {
  code: string;
  players: Player[];
  gameId: string | null;
  phase: "lobby" | "playing" | "results";
}

// ─── Game Plugin Interface ────────────────────────────────────────────────────

export interface GameMeta {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  thumbnail?: string;
}

/**
 * Every action a phone controller can send to the server.
 * type is the action kind; payload is game-specific.
 */
export interface PlayerAction {
  type: string;
  payload?: unknown;
}

/**
 * Full state pushed to all clients after every action.
 * gameState is game-specific; the platform wraps it.
 */
export interface RoomState {
  room: Room;
  gameState: unknown;
  scores: Record<string, number>;
  winner: string | null; // playerId of winner, or null
}

// ─── Socket Event Maps ───────────────────────────────────────────────────────

// Events the client emits → server
export interface ClientToServerEvents {
  // Lobby
  "room:create": (playerName: string, vsAI: boolean, callback: (room: Room, player: Player) => void) => void;
  "room:join": (code: string, playerName: string, callback: (room: Room, player: Player) => void) => void;
  // Register another LOCAL player on this same socket — a Bluetooth controller
  // joining the TV's room with no room code.
  "local:register": (playerName: string, callback: (room: Room, player: Player) => void) => void;
  "room:leave": () => void;
  // Drop a single local player (one controller leaving) without closing the socket.
  "player:leave": (playerId: string) => void;

  // Game lifecycle (host only)
  "game:select": (gameId: string) => void;
  "game:start": (vsAI?: boolean) => void;
  "game:rematch": () => void;
  "game:back-to-lobby": () => void;

  // In-game. playerId is the acting local player; a one-player socket (a phone)
  // may omit it. The server rejects a playerId the socket does not own.
  "player:action": (action: PlayerAction, playerId?: string) => void;
}

// Events the server emits → all clients in a room
export interface ServerToClientEvents {
  "room:state": (state: RoomState) => void;
  "room:error": (message: string) => void;
  "game:list": (games: GameMeta[]) => void;
}

// ─── Avatar Colors ────────────────────────────────────────────────────────────

// Mirrored by AVATAR_COLORS in packages/server/room_manager.py — keep in sync.
export const AVATAR_COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71",
  "#1abc9c", "#3498db", "#9b59b6", "#e91e63",
];
