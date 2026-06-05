import { useEffect, useRef } from "react";
import { ControllerControl } from "../games/registry";

// ─── Gamepad API → semantic controls ─────────────────────────────────────────
//
// The Gamepad API has no events for button values — you poll getGamepads() each
// frame. We translate a raw snapshot into a set of "active" controls, then emit
// only the RISING EDGES between frames (a press, not a hold). That edge-detection
// is the whole reason we don't flood the socket: one event per real press, not
// 60/sec while a button is held. The two pure functions below are unit-tested.

// Standard Gamepad mapping (https://w3c.github.io/gamepad/#remapping).
const BUTTON_CONTROLS: Record<number, ControllerControl> = {
  0: "confirm", // A / cross
  1: "back", // B / circle
  9: "start",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};
const AXIS_THRESHOLD = 0.5;

interface GamepadSnapshot {
  buttons: ReadonlyArray<{ pressed: boolean; value: number }>;
  axes: ReadonlyArray<number>;
}

/** The set of controls currently active for one gamepad snapshot. Pure. */
export function activeControls(gp: GamepadSnapshot): Set<ControllerControl> {
  const s = new Set<ControllerControl>();
  gp.buttons.forEach((b, i) => {
    const c = BUTTON_CONTROLS[i];
    if (c && (b.pressed || b.value > 0.5)) s.add(c);
  });
  const x = gp.axes[0];
  const y = gp.axes[1];
  if (typeof x === "number") {
    if (x < -AXIS_THRESHOLD) s.add("left");
    if (x > AXIS_THRESHOLD) s.add("right");
  }
  if (typeof y === "number") {
    if (y < -AXIS_THRESHOLD) s.add("up");
    if (y > AXIS_THRESHOLD) s.add("down");
  }
  return s;
}

/** Controls newly active this frame (present in cur, absent in prev). Pure. */
export function risingEdges(
  prev: Set<ControllerControl>,
  cur: Set<ControllerControl>,
): ControllerControl[] {
  const fired: ControllerControl[] = [];
  cur.forEach((c) => {
    if (!prev.has(c)) fired.push(c);
  });
  return fired;
}

export interface GamepadFrameEvent {
  index: number;
  control: ControllerControl;
}

/**
 * Poll connected gamepads and call onEvent for each edge-detected control press,
 * tagged with the gamepad's index. The caller maps index → player.
 */
export function useGamepads(onEvent: (e: GamepadFrameEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const prev = new Map<number, Set<ControllerControl>>();
    let raf = 0;

    const loop = () => {
      for (const gp of navigator.getGamepads()) {
        if (!gp) continue;
        const cur = activeControls(gp);
        const before = prev.get(gp.index) ?? new Set<ControllerControl>();
        for (const control of risingEdges(before, cur)) {
          onEventRef.current({ index: gp.index, control });
        }
        prev.set(gp.index, cur);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}
