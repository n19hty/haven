import { describe, it, expect } from "vitest";
import { activeControls, risingEdges } from "./useGamepads";

function pad(buttons: number[], axes: number[] = [], mapping?: string) {
  return { buttons: buttons.map((v) => ({ pressed: v > 0.5, value: v })), axes, mapping };
}

describe("activeControls", () => {
  it("maps standard buttons to controls", () => {
    const buttons = Array(16).fill(0);
    buttons[0] = 1; // confirm
    buttons[12] = 1; // up
    const s = activeControls(pad(buttons));
    expect(s.has("confirm")).toBe(true);
    expect(s.has("up")).toBe(true);
    expect(s.has("down")).toBe(false);
  });

  it("treats both primary face buttons as confirm on non-standard (generic) pads", () => {
    const b0 = Array(16).fill(0); b0[0] = 1;
    const b1 = Array(16).fill(0); b1[1] = 1;
    expect(activeControls(pad(b0)).has("confirm")).toBe(true);
    expect(activeControls(pad(b1)).has("confirm")).toBe(true);
  });

  it("maps B (button 1) to back on standard controllers (Xbox, DualShock)", () => {
    const b1 = Array(16).fill(0); b1[1] = 1;
    const result = activeControls(pad(b1, [], "standard"));
    expect(result.has("back")).toBe(true);
    expect(result.has("confirm")).toBe(false);
  });

  it("maps axis movement past the threshold (d-pad-as-axis pads too)", () => {
    expect([...activeControls(pad([], [-1, 0]))]).toContain("left");
    expect([...activeControls(pad([], [0, 1]))]).toContain("down");
  });

  it("emits home only when Select(8) + Start(9) are held together", () => {
    const only8 = Array(16).fill(0); only8[8] = 1;
    const only9 = Array(16).fill(0); only9[9] = 1;
    const both = Array(16).fill(0); both[8] = 1; both[9] = 1;
    expect(activeControls(pad(only8)).has("home")).toBe(false);
    expect(activeControls(pad(only9)).has("home")).toBe(false);
    expect(activeControls(pad(both)).has("home")).toBe(true);
  });

  it("emits home from Guide button (16) on standard controllers", () => {
    const buttons = Array(17).fill(0); buttons[16] = 1;
    expect(activeControls(pad(buttons, [], "standard")).has("home")).toBe(true);
    expect(activeControls(pad(buttons)).has("home")).toBe(false);
  });

  it("ignores small (deadzone) axis movement", () => {
    expect(activeControls(pad([], [0.2, -0.2])).size).toBe(0);
  });
});

describe("risingEdges", () => {
  it("returns only newly active controls (a press, not a hold)", () => {
    expect(risingEdges(new Set(["up"]), new Set(["up", "confirm"]))).toEqual(["confirm"]);
  });

  it("emits nothing while a control stays held", () => {
    expect(risingEdges(new Set(["confirm"]), new Set(["confirm"]))).toEqual([]);
  });

  it("re-emits after release and re-press", () => {
    expect(risingEdges(new Set(), new Set(["confirm"]))).toEqual(["confirm"]);
  });
});
