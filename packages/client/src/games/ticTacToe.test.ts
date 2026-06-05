import { describe, it, expect } from "vitest";
import { moveCursor } from "./ticTacToe";

describe("moveCursor (3×3 d-pad navigation)", () => {
  it("moves in each direction from the center", () => {
    expect(moveCursor(4, "up")).toBe(1);
    expect(moveCursor(4, "down")).toBe(7);
    expect(moveCursor(4, "left")).toBe(3);
    expect(moveCursor(4, "right")).toBe(5);
  });

  it("clamps at the grid edges", () => {
    expect(moveCursor(0, "up")).toBe(0);
    expect(moveCursor(0, "left")).toBe(0);
    expect(moveCursor(8, "down")).toBe(8);
    expect(moveCursor(8, "right")).toBe(8);
  });

  it("does not wrap across rows on left/right", () => {
    expect(moveCursor(3, "left")).toBe(3); // left edge of middle row
    expect(moveCursor(5, "right")).toBe(5); // right edge of middle row
  });

  it("ignores non-directional controls", () => {
    expect(moveCursor(4, "confirm")).toBe(4);
    expect(moveCursor(4, "back")).toBe(4);
  });
});
