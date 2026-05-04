import { describe, expect, it } from "vitest";
import { eliminateOverlap, SketchFragment } from "overlay-engine";
import { handleReconcileOverlap } from "../src/handler";

function box(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  sketchIds: number[],
  geographyIds: number[],
): SketchFragment {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY],
        ],
      ],
    },
    properties: {
      __geographyIds: geographyIds,
      __sketchIds: sketchIds,
    },
  };
}

describe("handleReconcileOverlap", () => {
  it("matches eliminateOverlap for disjoint fragments", async () => {
    const a = box(0, 0, 1, 1, [1], [10]);
    const b = box(2, 0, 3, 1, [2], [10]);
    const direct = eliminateOverlap([a], [b]);

    const result = await handleReconcileOverlap({
      operation: "reconcile-overlap",
      newFragments: [a],
      existingFragments: [b],
    });

    expect(result.success).toBe(true);
    expect(result.fragments).toEqual(direct);
  });
});
