import React from "react";
import { Player, PlayerAction } from "@haven/shared";

// ─── Controller input (Bluetooth gamepads on the TV) ─────────────────────────
export type ControllerControl =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "back"
  | "start";

/** An edge-detected control press, already attributed to a local player. */
export interface ControllerEvent {
  playerId: string;
  control: ControllerControl;
}

/** Subscribe to controller events; returns an unsubscribe function. */
export type ControllerInput = (handler: (e: ControllerEvent) => void) => () => void;

export interface TVComponentProps {
  gameState: unknown;
  players: Player[];
  scores: Record<string, number>;
  /** The player sitting at the console (the host is also a player). */
  myPlayer: Player;
  /**
   * Send a game action. playerId names the acting local player; omit it to act
   * as the console's own player (the backward-compatible default).
   */
  onAction: (action: PlayerAction, playerId?: string) => void;
  /** Subscribe to Bluetooth-controller input, if any controllers are present. */
  controllerInput?: ControllerInput;
}

export interface ControllerComponentProps {
  gameState: unknown;
  myPlayer: Player;
  players: Player[];
  scores: Record<string, number>;
  onAction: (action: PlayerAction, playerId?: string) => void;
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
