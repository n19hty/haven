import React from "react";
import { Player, PlayerAction } from "@haven/shared";

export interface TVComponentProps {
  gameState: unknown;
  players: Player[];
  scores: Record<string, number>;
  /** The player sitting at the console (the host is also a player). */
  myPlayer: Player;
  /** Send a game action to the server (the TV can be played on a touchscreen). */
  onAction: (action: PlayerAction) => void;
}

export interface ControllerComponentProps {
  gameState: unknown;
  myPlayer: Player;
  players: Player[];
  scores: Record<string, number>;
  onAction: (action: PlayerAction) => void;
}

export type TVComponent         = React.ComponentType<TVComponentProps>;
export type ControllerComponent = React.ComponentType<ControllerComponentProps>;

interface ClientGamePlugin {
  TVComponent: TVComponent;
  ControllerComponent: ControllerComponent;
}

const clientRegistry = new Map<string, ClientGamePlugin>();

export function registerGame(id: string, plugin: ClientGamePlugin) {
  clientRegistry.set(id, plugin);
}

export function getGameTVComponent(id: string): TVComponent | null {
  return clientRegistry.get(id)?.TVComponent ?? null;
}

export function getGameControllerComponent(id: string): ControllerComponent | null {
  return clientRegistry.get(id)?.ControllerComponent ?? null;
}
