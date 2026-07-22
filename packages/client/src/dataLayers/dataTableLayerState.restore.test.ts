import { describe, expect, it } from "@jest/globals";
import {
  applyDataTableStatesToLayerStates,
  buildDataTableStatesFromLayers,
  layerStatesForPreferences,
  LayerStateWithDataTable,
} from "./dataTableLayerState";

/**
 * Regression: prefs restore must keep dataTable across a "catalog not ready"
 * round-trip. The manager should not treat missing TOC tables as deletion.
 */
describe("dataTable prefs restore semantics", () => {
  it("keeps dataTable in preferences when layer is visible", () => {
    const layers: { [id: string]: LayerStateWithDataTable } = {
      sites: {
        visible: true,
        loading: false,
        dataTable: {
          stableId: "table-uuid",
          column: "biomass",
          op: "sum",
        },
      },
    };
    const prefs = layerStatesForPreferences(layers);
    const hydrated = JSON.parse(JSON.stringify(prefs)) as {
      [id: string]: LayerStateWithDataTable;
    };
    expect(hydrated.sites.dataTable?.stableId).toBe("table-uuid");
  });

  it("bookmark apply restores dataTable onto visible layers", () => {
    const before: { [id: string]: LayerStateWithDataTable } = {
      sites: {
        visible: true,
        loading: false,
        dataTable: { stableId: "table-uuid", column: "biomass", op: "sum" },
      },
    };
    const bookmark = buildDataTableStatesFromLayers(before);
    const layersAfterReload: { [id: string]: LayerStateWithDataTable } = {
      sites: { visible: true, loading: false },
    };
    const afterReload = applyDataTableStatesToLayerStates(
      layersAfterReload,
      bookmark
    );
    expect(afterReload.sites.dataTable).toEqual(before.sites.dataTable);
  });
});
