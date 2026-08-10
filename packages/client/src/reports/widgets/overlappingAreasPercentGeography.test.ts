import { SpatialMetricState } from "../../generated/graphql";
import {
  buildPercentGeographyValuesBySourceId,
  indexOverlayAreaGeographyValuesBySourceUrl,
  overlayAreaClassTotalFromValue,
  resolveOverlappingAreasPercentGeographyId,
} from "./overlappingAreasPercentGeography";

describe("overlappingAreasPercentGeography", () => {
  test("resolve: null hides; legacy empty uses primary", () => {
    expect(
      resolveOverlappingAreasPercentGeographyId(
        { percentGeographyId: null },
        1
      )
    ).toBeUndefined();
    expect(resolveOverlappingAreasPercentGeographyId({}, 1)).toBe(1);
  });

  test("index keeps highest metric id per sourceUrl", () => {
    const metrics = [
      {
        id: 1,
        type: "overlay_area",
        state: SpatialMetricState.Complete,
        sourceUrl: "https://example.com/a.fgb",
        subject: { type: "geography", id: 10 },
        value: { forest: 1 },
      },
      {
        id: 3,
        type: "overlay_area",
        state: SpatialMetricState.Complete,
        sourceUrl: "https://example.com/a.fgb",
        subject: { type: "geography", id: 10 },
        value: { forest: 9 },
      },
      {
        id: 2,
        type: "overlay_area",
        state: SpatialMetricState.Complete,
        sourceUrl: "https://example.com/b.fgb",
        subject: { type: "geography", id: 10 },
        value: { forest: 4 },
      },
      {
        id: 4,
        type: "overlay_area",
        state: SpatialMetricState.Complete,
        sourceUrl: "https://example.com/a.fgb",
        subject: { type: "geography", id: 99 },
        value: { forest: 100 },
      },
    ] as any;

    const byUrl = indexOverlayAreaGeographyValuesBySourceUrl(metrics, 10);
    expect(overlayAreaClassTotalFromValue(byUrl.get("https://example.com/a.fgb"), "forest")).toBe(
      9
    );
    expect(overlayAreaClassTotalFromValue(byUrl.get("https://example.com/b.fgb"), "forest")).toBe(
      4
    );
  });

  test("build reuses combinedBySource when percent geo equals clipping", () => {
    const combinedBySource = {
      src1: { geographies: { value: { forest: 42 } } },
    };
    const map = buildPercentGeographyValuesBySourceId({
      percentGeographyId: 7,
      clippingGeographyId: 7,
      metrics: [
        {
          id: 99,
          type: "overlay_area",
          state: SpatialMetricState.Complete,
          sourceUrl: "https://example.com/a.fgb",
          subject: { type: "geography", id: 7 },
          value: { forest: 1 },
        },
      ] as any,
      sources: [{ stableId: "src1", sourceUrl: "https://example.com/a.fgb" }] as any,
      combinedBySource: combinedBySource as any,
    });
    expect(overlayAreaClassTotalFromValue(map.get("src1"), "forest")).toBe(42);
  });

  test("build scans metrics when percent geo differs from clipping", () => {
    const map = buildPercentGeographyValuesBySourceId({
      percentGeographyId: 20,
      clippingGeographyId: 7,
      metrics: [
        {
          id: 1,
          type: "overlay_area",
          state: SpatialMetricState.Complete,
          sourceUrl: "https://example.com/a.fgb",
          subject: { type: "geography", id: 20 },
          value: { forest: 55 },
        },
      ] as any,
      sources: [
        { stableId: "src1", sourceUrl: "https://example.com/a.fgb" },
      ] as any,
      combinedBySource: {
        src1: { geographies: { value: { forest: 1 } } },
      } as any,
    });
    expect(overlayAreaClassTotalFromValue(map.get("src1"), "forest")).toBe(55);
  });
});
