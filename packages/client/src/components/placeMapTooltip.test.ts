import { describe, expect, it } from "@jest/globals";
import { placeMapTooltip } from "./placeMapTooltip";

describe("placeMapTooltip", () => {
  it("keeps the tooltip below and to the right of the cursor when it fits", () => {
    expect(
      placeMapTooltip({
        cursorX: 40,
        cursorY: 40,
        width: 80,
        height: 40,
        viewportWidth: 800,
        viewportHeight: 600,
      })
    ).toEqual({ left: 56, top: 56, origin: "top left" });
  });

  it("flips left and up when the tooltip would leave the viewport", () => {
    const placed = placeMapTooltip({
      cursorX: 780,
      cursorY: 580,
      width: 240,
      height: 180,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(placed.left + 240).toBeLessThanOrEqual(800 - 8);
    expect(placed.top + 180).toBeLessThanOrEqual(600 - 8);
    expect(placed.left).toBeGreaterThanOrEqual(8);
    expect(placed.top).toBeGreaterThanOrEqual(8);
    expect(placed.origin).toBe("bottom right");
  });
});
