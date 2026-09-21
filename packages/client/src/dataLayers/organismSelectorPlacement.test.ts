import { placeOrganismSelectorPanel } from "./organismSelectorPlacement";

const PANEL_WIDTH = 416;
const PANEL_HEIGHT = 480;

function trigger(box: {
  top: number;
  left: number;
  width: number;
  height: number;
}) {
  return {
    top: box.top,
    left: box.left,
    right: box.left + box.width,
    bottom: box.top + box.height,
    width: box.width,
    height: box.height,
  };
}

describe("placeOrganismSelectorPanel", () => {
  it("opens to the left of a trigger that is near the right edge", () => {
    const placed = placeOrganismSelectorPanel({
      trigger: trigger({ top: 400, left: 1100, width: 300, height: 48 }),
      panelWidth: PANEL_WIDTH,
      panelHeight: PANEL_HEIGHT,
      viewportWidth: 1440,
      viewportHeight: 800,
    });

    expect(placed.side).toBe("left");
    expect(placed.left).toBe(1100 - 6 - PANEL_WIDTH);
    expect(placed.top).toBe(400 + 24 - PANEL_HEIGHT / 2);
    expect(placed.width).toBe(PANEL_WIDTH);
  });

  it("opens to the right when the left side would leave the viewport", () => {
    const placed = placeOrganismSelectorPanel({
      trigger: trigger({ top: 100, left: 16, width: 300, height: 40 }),
      panelWidth: PANEL_WIDTH,
      panelHeight: PANEL_HEIGHT,
      viewportWidth: 1440,
      viewportHeight: 800,
    });

    expect(placed.side).toBe("right");
    expect(placed.left).toBe(16 + 300 + 6);
    expect(placed.top).toBe(8);
  });

  it("picks the roomier side when both sides fit", () => {
    const placed = placeOrganismSelectorPanel({
      trigger: trigger({ top: 200, left: 500, width: 200, height: 40 }),
      panelWidth: PANEL_WIDTH,
      panelHeight: 200,
      viewportWidth: 1440,
      viewportHeight: 800,
    });

    expect(placed.side).toBe("right");
    expect(placed.top).toBe(200 + 20 - 100);
  });

  it("shrinks to the roomier side when the preferred width fits on neither side", () => {
    const placed = placeOrganismSelectorPanel({
      trigger: trigger({ top: 200, left: 180, width: 80, height: 40 }),
      panelWidth: PANEL_WIDTH,
      panelHeight: 200,
      viewportWidth: 400,
      viewportHeight: 800,
    });

    expect(placed.side).toBe("left");
    expect(placed.maxWidth).toBe(180 - 8 - 6);
    expect(placed.width).toBe(placed.maxWidth);
    expect(placed.left).toBe(8);
  });

  it("pins a too-tall panel to the top of the viewport", () => {
    const placed = placeOrganismSelectorPanel({
      trigger: trigger({ top: 300, left: 800, width: 200, height: 40 }),
      panelWidth: PANEL_WIDTH,
      panelHeight: 2000,
      viewportWidth: 1440,
      viewportHeight: 700,
    });

    expect(placed.height).toBe(700 - 16);
    expect(placed.maxHeight).toBe(700 - 16);
    expect(placed.top).toBe(8);
  });

  it("shifts up to stay inside the bottom edge without crossing the top", () => {
    const placed = placeOrganismSelectorPanel({
      trigger: trigger({ top: 680, left: 800, width: 200, height: 40 }),
      panelWidth: PANEL_WIDTH,
      panelHeight: PANEL_HEIGHT,
      viewportWidth: 1440,
      viewportHeight: 800,
    });

    expect(placed.top).toBe(800 - 8 - PANEL_HEIGHT);
    expect(placed.top).toBeGreaterThanOrEqual(8);
  });
});
