import { describe, it, expect } from "vitest";
import { activeControls, risingEdges } from "./useGamepads";

function pad(buttons: number[], axes: number[] = []) {
  return { buttons: buttons.map((v) => ({ pressed: v > 0.5, value: v })), axes };
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

  it("treats both primary face buttons (0 and 1) as confirm", () => {
    const b0 = Array(16).fill(0); b0[0] = 1;
    const b1 = Array(16).fill(0); b1[1] = 1;
    expect(activeControls(pad(b0)).has("confirm")).toBe(true);
    expect(activeControls(pad(b1)).has("confirm")).toBe(true); // non-standard pads
  });

  it("maps axis movement past the threshold (d-pad-as-axis pads too)", () => {
    expect([...activeControls(pad([], [-1, 0]))]).toContain("left");
    expect([...activeControls(pad([], [0, 1]))]).toContain("down");
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
