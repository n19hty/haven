import { useEffect, useRef, useState } from "react";
import { Player, Room } from "@haven/shared";
import { getSocket } from "./useSocket";
import { useGamepads } from "./useGamepads";
import { ControllerEvent } from "../games/registry";

function connectedCount(): number {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return 0;
  let n = 0;
  for (const gp of navigator.getGamepads()) if (gp) n++;
  return n;
}

// ─── Bluetooth controllers → local players ───────────────────────────────────
//
// Every controller is read by the TV's single browser socket, so the server has
// to attribute each one to a distinct player (see room_manager socket_to_players).
// Mapping:
//   gamepad index 0  -> the host player that already exists (the console owner)
//   gamepad index 1+ -> register a NEW local player on connect (local:register),
//                       and drop it on disconnect (player:leave).
// Inputs are re-emitted tagged with the mapped playerId so games can act per
// player and the server can reject ids a socket doesn't own.

/**
 * Wire connected gamepads to players and forward edge-detected input as
 * { playerId, control } events. hostPlayerId is the console's own player.
 */
export function useLocalControllers(
  hostPlayerId: string | null,
  onEvent: (e: ControllerEvent) => void,
): number {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const hostRef = useRef(hostPlayerId);
  hostRef.current = hostPlayerId;
  // gamepad index -> playerId
  const mapRef = useRef<Map<number, string>>(new Map());
  // How many gamepads the page currently sees (for an on-screen indicator).
  const [count, setCount] = useState(0);

  useEffect(() => {
    const socket = getSocket();

    const claim = (index: number) => {
      if (mapRef.current.has(index)) return;
      if (index === 0) {
        if (hostRef.current) mapRef.current.set(0, hostRef.current);
        return;
      }
      // Reserve the slot synchronously so a flurry of inputs doesn't register
      // the same pad twice; fill in the real id when the server acks.
      mapRef.current.set(index, "");
      socket.emit("local:register", `Player ${index + 1}`, (_room: Room, player: Player) => {
        mapRef.current.set(index, player.id);
      });
    };

    const release = (index: number) => {
      const pid = mapRef.current.get(index);
      mapRef.current.delete(index);
      if (pid && index !== 0) socket.emit("player:leave", pid);
    };

    const onConnect = (e: GamepadEvent) => {
      claim(e.gamepad.index);
      setCount(connectedCount());
    };
    const onDisconnect = (e: GamepadEvent) => {
      release(e.gamepad.index);
      setCount(connectedCount());
    };

    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onDisconnect);
    // Pads already present at mount (Chrome only fires connect after a press).
    if (navigator.getGamepads) {
      for (const gp of navigator.getGamepads()) if (gp) claim(gp.index);
    }
    setCount(connectedCount());

    return () => {
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
    };
  }, []);

  // Once the host id is known, bind pad 0 to it.
  useEffect(() => {
    if (hostPlayerId && navigator.getGamepads) {
      for (const gp of navigator.getGamepads()) {
        if (gp && gp.index === 0 && !mapRef.current.get(0)) mapRef.current.set(0, hostPlayerId);
      }
    }
  }, [hostPlayerId]);

  useGamepads((e) => {
    const pid = mapRef.current.get(e.index);
    if (pid) onEventRef.current({ playerId: pid, control: e.control });
  });

  return count;
}
