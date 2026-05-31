import fs from "fs";
import path from "path";
import { GameMeta, PlayerAction, RoomState } from "@haven/shared";

export interface GamePlugin {
  meta: GameMeta;
  createInitialState(players: string[]): unknown;
  handleAction(state: unknown, playerId: string, action: PlayerAction): unknown;
  getWinner(state: unknown): string | null;
  getCurrentPlayer?(state: unknown): string | null;
  getAIMove?(state: unknown, playerId: string): PlayerAction | null;
}

const gamesDir = path.resolve(__dirname, "../../../games");

const registry = new Map<string, GamePlugin>();

export function loadGames(): void {
  if (!fs.existsSync(gamesDir)) return;

  const entries = fs.readdirSync(gamesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pluginPath = path.join(gamesDir, entry.name, "server.js");
    const pluginTsPath = path.join(gamesDir, entry.name, "server.ts");

    const target = fs.existsSync(pluginPath)
      ? pluginPath
      : fs.existsSync(pluginTsPath)
      ? pluginTsPath
      : null;

    if (!target) continue;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const plugin: GamePlugin = require(target);
      registry.set(plugin.meta.id, plugin);
      console.log(`[games] loaded: ${plugin.meta.name}`);
    } catch (e) {
      console.error(`[games] failed to load ${entry.name}:`, e);
    }
  }
}

export function getGame(id: string): GamePlugin | undefined {
  return registry.get(id);
}

export function listGames(): GameMeta[] {
  return Array.from(registry.values()).map((g) => g.meta);
}
