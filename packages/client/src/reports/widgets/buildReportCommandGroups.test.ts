import { describe, expect, test } from "@jest/globals";
import { createLayerYearTemporalInfo } from "@seasketch/geostats-types";
import { OverlaySourceListDetailsFragment } from "../../generated/graphql";
import { CommandPaletteGroup, CommandPaletteItem } from "../commandPalette/types";
import { buildReportCommandGroups } from "./widgets";

function rasterSource(
  temporal: OverlaySourceListDetailsFragment["temporal"]
): OverlaySourceListDetailsFragment {
  return {
    tableOfContentsItemId: 11,
    stableId: "mangrove-2020",
    containsOverlappingFeatures: true,
    temporal,
    rasterBandCount: 1,
    vectorGeometryType: null,
    styleGroupByColumn: "value",
    bestCategoryColumn: null,
    bestContinuousColumn: null,
    bestLabelColumn: null,
    anyColumn: null,
    hasOusDemographicsColumns: false,
    tableOfContentsItem: {
      title: "Mangrove Extent (2020)",
      stableId: "mangrove-2020",
    },
    sourceProcessingJob: null as unknown as OverlaySourceListDetailsFragment["sourceProcessingJob"],
  };
}

function timeSeriesLabels(groups: CommandPaletteGroup[]): string[] {
  const labels: string[] = [];
  const visit = (item: CommandPaletteItem) => {
    if (item.label === "Time Series") {
      labels.push(item.id);
    }
    for (const child of item.children ?? []) {
      visit(child);
    }
    for (const group of item.childGroups ?? []) {
      for (const child of group.items) {
        visit(child);
      }
    }
  };
  for (const group of groups) {
    for (const item of group.items) {
      visit(item);
    }
  }
  return labels;
}

function vectorSource(
  geometryType: string,
  tocId = 22,
  stableId = "suma"
): OverlaySourceListDetailsFragment {
  return {
    tableOfContentsItemId: tocId,
    stableId,
    containsOverlappingFeatures: false,
    temporal: null,
    rasterBandCount: null,
    vectorGeometryType: geometryType,
    styleGroupByColumn: null,
    bestCategoryColumn: null,
    bestContinuousColumn: null,
    bestLabelColumn: null,
    anyColumn: null,
    hasOusDemographicsColumns: false,
    tableOfContentsItem: {
      title: "Special Unique Marine Areas (SUMA)",
      stableId,
    },
    sourceProcessingJob: null as unknown as OverlaySourceListDetailsFragment["sourceProcessingJob"],
  };
}

function overlayInlineLabels(
  groups: CommandPaletteGroup[],
  tocId: number
): string[] {
  const overlay = groups.find((g) => g.label === "Overlay Layer Widgets");
  const layer = overlay?.items.find((i) => i.id === `overlay-layer-${tocId}`);
  const inline = layer?.childGroups?.find((g) => g.label === "Inline Metrics");
  return inline?.items.map((i) => i.label) ?? [];
}

describe("buildReportCommandGroups Time Series", () => {
  test("does not offer Time Series when the raster has no temporal coverage", () => {
    const groups = buildReportCommandGroups({
      sources: [rasterSource(null)],
    });
    expect(timeSeriesLabels(groups)).toEqual([]);
  });

  test("offers Time Series when the raster has temporal coverage", () => {
    const groups = buildReportCommandGroups({
      sources: [rasterSource(createLayerYearTemporalInfo(2020))],
    });
    expect(timeSeriesLabels(groups)).toEqual([
      "overlay-layer-11-raster-time-series",
    ]);
  });
});

describe("buildReportCommandGroups Geography Proportion Captured", () => {
  test("offers Geography Proportion Captured for polygon overlay layers", () => {
    expect(
      overlayInlineLabels(
        buildReportCommandGroups({ sources: [vectorSource("Polygon")] }),
        22
      )
    ).toContain("Geography Proportion Captured");
    expect(
      overlayInlineLabels(
        buildReportCommandGroups({ sources: [vectorSource("MultiPolygon")] }),
        22
      )
    ).toContain("Geography Proportion Captured");
  });

  test("does not offer Geography Proportion Captured for point or line overlay layers", () => {
    expect(
      overlayInlineLabels(
        buildReportCommandGroups({ sources: [vectorSource("Point")] }),
        22
      )
    ).not.toContain("Geography Proportion Captured");
    expect(
      overlayInlineLabels(
        buildReportCommandGroups({ sources: [vectorSource("LineString")] }),
        22
      )
    ).not.toContain("Geography Proportion Captured");
  });

  test("still offers Geography Proportion Captured for single-band rasters", () => {
    expect(
      overlayInlineLabels(
        buildReportCommandGroups({ sources: [rasterSource(null)] }),
        11
      )
    ).toContain("Geography Proportion Captured");
  });
});

