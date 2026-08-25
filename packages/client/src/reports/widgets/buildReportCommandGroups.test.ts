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
