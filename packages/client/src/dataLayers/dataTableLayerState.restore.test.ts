import { describe, expect, it } from "@jest/globals";
import {
  applyDataTableStatesToLayerStates,
  buildDataTableStatesFromLayers,
  layerStatesForPreferences,
  resolveTableByStableId,
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

    // Simulate "catalog empty" — resolve fails; caller must NOT clear prefs.
    expect(
      resolveTableByStableId(undefined, hydrated.sites.dataTable!.stableId)
    ).toBeUndefined();
    expect(resolveTableByStableId([], hydrated.sites.dataTable!.stableId)).toBe(
      undefined
    );

    // Once catalog arrives, resolve succeeds.
    const table = resolveTableByStableId(
      [
        { id: 9, stableId: "other" },
        { id: 10, stableId: "table-uuid" },
      ],
      hydrated.sites.dataTable!.stableId
    );
    expect(table?.id).toBe(10);
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
    const afterReload = applyDataTableStatesToLayerStates(
      { sites: { visible: true, loading: false } },
      bookmark
    );
    expect(afterReload.sites.dataTable).toEqual(before.sites.dataTable);
  });
});
