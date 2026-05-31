import { Player, Room, RoomState, AVATAR_COLORS } from "@haven/shared";
import { getGame, GamePlugin } from "./GameLoader";

interface InternalRoom {
  room: Room;
  gameState: unknown;
  scores: Record<string, number>;
  winner: string | null;
  socketToPlayer: Map<string, string>; // socketId → playerId
  aiPlayerIds: Set<string>;
}

const rooms = new Map<string, InternalRoom>();
const socketToRoom = new Map<string, string>(); // socketId → roomCode

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateCode() : code;
}

function generatePlayerId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function pickColor(room: InternalRoom): string {
  const used = new Set(room.room.players.map((p) => p.avatarColor));
  return AVATAR_COLORS.find((c) => !used.has(c)) ?? AVATAR_COLORS[0];
}

function applyAIMoves(internal: InternalRoom, game: GamePlugin): void {
  while (true) {
    const winner = game.getWinner(internal.gameState);
    if (winner) {
      internal.winner = winner;
      internal.room.phase = "results";
      if (winner !== "__draw__") {
        internal.scores[winner] = (internal.scores[winner] ?? 0) + 1;
      }
      return;
    }
    if (!game.getCurrentPlayer || !game.getAIMove) return;
    const currentPlayerId = game.getCurrentPlayer(internal.gameState);
    if (!currentPlayerId || !internal.aiPlayerIds.has(currentPlayerId)) return;
    const aiAction = game.getAIMove(internal.gameState, currentPlayerId);
    if (!aiAction) return;
    internal.gameState = game.handleAction(internal.gameState, currentPlayerId, aiAction);
  }
}

export function createRoom(socketId: string, playerName: string, vsAI: boolean): { room: Room; player: Player } {
  const code = generateCode();
  const player: Player = {
    id: generatePlayerId(),
    name: playerName,
    avatarColor: AVATAR_COLORS[0],
    isHost: true,
  };
  const room: Room = { code, players: [player], gameId: null, phase: "lobby" };
  const internal: InternalRoom = {
    room,
    gameState: null,
    scores: { [player.id]: 0 },
    winner: null,
    socketToPlayer: new Map([[socketId, player.id]]),
    aiPlayerIds: new Set(),
  };

  if (vsAI) {
    const aiPlayer: Player = {
      id: generatePlayerId(),
      name: "Computer",
      avatarColor: AVATAR_COLORS[1],
      isHost: false,
      isAI: true,
    };
    room.players.push(aiPlayer);
    internal.scores[aiPlayer.id] = 0;
    internal.aiPlayerIds.add(aiPlayer.id);
  }

  rooms.set(code, internal);
  socketToRoom.set(socketId, code);
  return { room, player };
}

export function joinRoom(
  socketId: string,
  code: string,
  playerName: string
): { room: Room; player: Player } | { error: string } {
  const internal = rooms.get(code.toUpperCase());
  if (!internal) return { error: "Room not found." };
  if (internal.room.phase !== "lobby") return { error: "Game already in progress." };
  if (internal.aiPlayerIds.size > 0) return { error: "This room is vs computer only." };
  if (internal.room.players.length >= 8) return { error: "Room is full." };

  const player: Player = {
    id: generatePlayerId(),
    name: playerName,
    avatarColor: pickColor(internal),
    isHost: false,
  };
  internal.room.players.push(player);
  internal.scores[player.id] = 0;
  internal.socketToPlayer.set(socketId, player.id);
  socketToRoom.set(socketId, code.toUpperCase());
  return { room: internal.room, player };
}

export function leaveRoom(socketId: string): string | null {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const internal = rooms.get(code);
  if (!internal) return null;

  const playerId = internal.socketToPlayer.get(socketId);
  internal.socketToPlayer.delete(socketId);
  socketToRoom.delete(socketId);

  if (playerId) {
    internal.room.players = internal.room.players.filter((p) => p.id !== playerId);
  }

  if (internal.room.players.filter((p) => !p.isAI).length === 0) {
    rooms.delete(code);
    return null;
  }

  // Pass host to next human player
  if (playerId && !internal.room.players.find((p) => p.isHost)) {
    const nextHuman = internal.room.players.find((p) => !p.isAI);
    if (nextHuman) nextHuman.isHost = true;
  }

  return code;
}

export function selectGame(socketId: string, gameId: string): string | null {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const internal = rooms.get(code);
  if (!internal) return null;
  const playerId = internal.socketToPlayer.get(socketId);
  if (!internal.room.players.find((p) => p.id === playerId && p.isHost)) return null;
  internal.room.gameId = gameId;
  return code;
}

export function startGame(socketId: string): string | null {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const internal = rooms.get(code);
  if (!internal || !internal.room.gameId) return null;

  const playerId = internal.socketToPlayer.get(socketId);
  if (!internal.room.players.find((p) => p.id === playerId && p.isHost)) return null;

  const game = getGame(internal.room.gameId);
  if (!game) return null;

  const playerIds = internal.room.players.map((p) => p.id);
  internal.gameState = game.createInitialState(playerIds);
  internal.room.phase = "playing";
  internal.winner = null;

  // Trigger AI if it goes first (handles edge cases)
  applyAIMoves(internal, game);

  return code;
}

export function handlePlayerAction(
  socketId: string,
  action: { type: string; payload?: unknown }
): string | null {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const internal = rooms.get(code);
  if (!internal || internal.room.phase !== "playing" || !internal.room.gameId) return null;

  const playerId = internal.socketToPlayer.get(socketId);
  if (!playerId) return null;

  const game = getGame(internal.room.gameId);
  if (!game) return null;

  internal.gameState = game.handleAction(internal.gameState, playerId, action);
  applyAIMoves(internal, game);

  return code;
}

export function rematch(socketId: string): string | null {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const internal = rooms.get(code);
  if (!internal || !internal.room.gameId) return null;

  const playerId = internal.socketToPlayer.get(socketId);
  if (!internal.room.players.find((p) => p.id === playerId && p.isHost)) return null;

  const game = getGame(internal.room.gameId);
  if (!game) return null;

  const playerIds = internal.room.players.map((p) => p.id);
  internal.gameState = game.createInitialState(playerIds);
  internal.room.phase = "playing";
  internal.winner = null;

  applyAIMoves(internal, game);

  return code;
}

export function backToLobby(socketId: string): string | null {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const internal = rooms.get(code);
  if (!internal) return null;

  const playerId = internal.socketToPlayer.get(socketId);
  if (!internal.room.players.find((p) => p.id === playerId && p.isHost)) return null;

  internal.room.phase = "lobby";
  internal.room.gameId = null;
  internal.gameState = null;
  internal.winner = null;
  return code;
}

export function getRoomState(code: string): RoomState | null {
  const internal = rooms.get(code);
  if (!internal) return null;
  return {
    room: internal.room,
    gameState: internal.gameState,
    scores: internal.scores,
    winner: internal.winner,
  };
}

export function getRoomCode(socketId: string): string | undefined {
  return socketToRoom.get(socketId);
}
