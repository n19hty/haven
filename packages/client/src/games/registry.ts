import React from "react";
import { Player } from "@haven/shared";

export interface TVComponentProps {
  gameState: unknown;
  players: Player[];
  scores: Record<string, number>;
}

export interface ControllerComponentProps {
  gameState: unknown;
  myPlayer: Player;
  players: Player[];
  scores: Record<string, number>;
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
