import { useEffect, useRef } from "react";
import { ControllerControl } from "../games/registry";

// ─── Gamepad API → semantic controls ─────────────────────────────────────────
//
// The Gamepad API has no events for button values — you poll getGamepads() each
// frame. We translate a raw snapshot into a set of "active" controls, then emit
// only the RISING EDGES between frames (a press, not a hold). That edge-detection
// is the whole reason we don't flood the socket: one event per real press, not
// 60/sec while a button is held. The two pure functions below are unit-tested.

// Standard Gamepad API mapping (Xbox One/Series, DualShock 4/5, and any pad that
// reports gamepad.mapping === "standard"). Button 1 is B/Circle = back/cancel.
const STANDARD_BUTTON_CONTROLS: Record<number, ControllerControl> = {
  0: "confirm",   // A / Cross
  1: "back",      // B / Circle
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

// Generic / non-standard Bluetooth pads (gamepad.mapping === ""). Layout is
// unknown so both primary face buttons map to confirm — no ambiguity since we
// can't tell which is "back" without a known layout.
const NONSTANDARD_BUTTON_CONTROLS: Record<number, ControllerControl> = {
  0: "confirm",
  1: "confirm",
  12: "up",
  13: "down",
  14: "left",
  15: "right",
};

// Home chord: Select(8) + Start(9) pressed simultaneously (classic console exit).
const HOME_CHORD = [8, 9];
const AXIS_THRESHOLD = 0.5;

// Directions repeat while held (console-style); other controls fire once.
const REPEAT_CONTROLS = new Set<ControllerControl>(["up", "down", "left", "right"]);
const REPEAT_DELAY = 380; // ms before a held direction starts repeating
const REPEAT_INTERVAL = 130; // ms between repeats thereafter

function isDown(b?: { pressed: boolean; value: number }): boolean {
  return !!b && (b.pressed || b.value > 0.5);
}

interface GamepadSnapshot {
  buttons: ReadonlyArray<{ pressed: boolean; value: number }>;
  axes: ReadonlyArray<number>;
  mapping?: string; // "standard" for Xbox/DualShock; "" or absent for generic pads
}

/** The set of controls currently active for one gamepad snapshot. Pure. */
export function activeControls(gp: GamepadSnapshot): Set<ControllerControl> {
  const s = new Set<ControllerControl>();
  const map = gp.mapping === "standard" ? STANDARD_BUTTON_CONTROLS : NONSTANDARD_BUTTON_CONTROLS;
  gp.buttons.forEach((b, i) => {
    const c = map[i];
    if (c && (b.pressed || b.value > 0.5)) s.add(c);
  });
  // Home: chord (Select+Start) works on all controllers.
  if (HOME_CHORD.every((i) => isDown(gp.buttons[i]))) s.add("home");
  // Guide/Xbox button (index 16) also triggers home on standard-mapped controllers.
  if (gp.mapping === "standard" && isDown(gp.buttons[16])) s.add("home");
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
    // Seed prev from the current snapshot so buttons already held when this
    // hook mounts don't fire as rising edges on the first frame.
    for (const gp of navigator.getGamepads()) {
      if (gp) prev.set(gp.index, activeControls(gp));
    }
    // `${index}:${control}` -> timestamp of the next allowed repeat.
    const nextRepeat = new Map<string, number>();
    let raf = 0;

    const loop = () => {
      const now = performance.now();
      for (const gp of navigator.getGamepads()) {
        if (!gp) continue;
        const cur = activeControls(gp);
        const before = prev.get(gp.index) ?? new Set<ControllerControl>();

        cur.forEach((control) => {
          const key = `${gp.index}:${control}`;
          if (!before.has(control)) {
            // Rising edge — fire immediately.
            onEventRef.current({ index: gp.index, control });
            if (REPEAT_CONTROLS.has(control)) nextRepeat.set(key, now + REPEAT_DELAY);
          } else if (REPEAT_CONTROLS.has(control)) {
            // Held — repeat on the timer (console-style menu scroll).
            const due = nextRepeat.get(key);
            if (due !== undefined && now >= due) {
              onEventRef.current({ index: gp.index, control });
              nextRepeat.set(key, now + REPEAT_INTERVAL);
            }
          }
        });

        // Forget repeat timers for controls this pad released.
        nextRepeat.forEach((_, key) => {
          const [idx, control] = key.split(":");
          if (Number(idx) === gp.index && !cur.has(control as ControllerControl)) {
            nextRepeat.delete(key);
          }
        });

        prev.set(gp.index, cur);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}
