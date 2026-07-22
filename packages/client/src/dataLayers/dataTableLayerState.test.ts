import { describe, expect, it } from "@jest/globals";
import {
  applyDataTableStatesToLayerStates,
  buildDataTableStatesFromLayers,
  layerStatesForPreferences,
  resolveTableByStableId,
  LayerStateWithDataTable,
} from "./dataTableLayerState";

describe("resolveTableByStableId", () => {
  it("finds a table by stableId", () => {
    const tables = [
      { id: 1, stableId: "aaa" },
      { id: 2, stableId: "bbb" },
    ];
    expect(resolveTableByStableId(tables, "bbb")?.id).toBe(2);
  });

  it("returns undefined when missing", () => {
    expect(resolveTableByStableId([{ id: 1, stableId: "aaa" }], "zzz")).toBe(
      undefined
    );
    expect(resolveTableByStableId(null, "aaa")).toBe(undefined);
  });
});

describe("buildDataTableStatesFromLayers", () => {
  it("includes only visible layers with dataTable", () => {
    const layers: { [id: string]: LayerStateWithDataTable } = {
      tocA: {
        visible: true,
        loading: false,
        dataTable: { stableId: "table-a", column: "biomass", op: "sum" },
      },
      tocB: {
        visible: false,
        loading: false,
        dataTable: { stableId: "table-b", column: "count", op: "count" },
      },
      tocC: {
        visible: true,
        loading: false,
      },
    };
    expect(buildDataTableStatesFromLayers(layers)).toEqual({
      tocA: { stableId: "table-a", column: "biomass", op: "sum" },
    });
  });
});

describe("applyDataTableStatesToLayerStates", () => {
  it("merges bookmark states and clears missing entries", () => {
    const layers: { [id: string]: LayerStateWithDataTable } = {
      tocA: {
        visible: true,
        loading: false,
        dataTable: { stableId: "old", column: "x" },
      },
      tocB: {
        visible: true,
        loading: false,
        dataTable: { stableId: "keep-me" },
      },
      tocC: { visible: true, loading: false },
    };
    const next = applyDataTableStatesToLayerStates(layers, {
      tocA: { stableId: "new-a", column: "y", op: "avg" },
      tocC: { stableId: "new-c" },
    });
    expect(next.tocA.dataTable).toEqual({
      stableId: "new-a",
      column: "y",
      op: "avg",
    });
    expect(next.tocB.dataTable).toBeUndefined();
    expect(next.tocC.dataTable).toEqual({ stableId: "new-c" });
  });

  it("does not invent layers absent from the current map", () => {
    const next = applyDataTableStatesToLayerStates(
      { tocA: { visible: true, loading: false } },
      { tocMissing: { stableId: "x" } }
    );
    expect(Object.keys(next)).toEqual(["tocA"]);
  });
});

describe("layerStatesForPreferences", () => {
  it("persists dataTable and strips loading/error", () => {
    const layers: { [id: string]: LayerStateWithDataTable } = {
      tocA: {
        visible: true,
        loading: true,
        error: new Error("boom"),
        opacity: 0.5,
        dataTable: {
          stableId: "table-a",
          column: "biomass",
          op: "sum",
          filters: [{ column: "year", op: "eq", value: "2020" }],
        },
      },
    };
    const prefs = layerStatesForPreferences(layers);
    expect(prefs.tocA).toEqual({
      visible: true,
      loading: false,
      opacity: 0.5,
      dataTable: {
        stableId: "table-a",
        column: "biomass",
        op: "sum",
        filters: [{ column: "year", op: "eq", value: "2020" }],
      },
    });
    expect((prefs.tocA as any).error).toBeUndefined();

    const roundTrip = JSON.parse(JSON.stringify(prefs));
    expect(roundTrip.tocA.dataTable.stableId).toBe("table-a");
  });
});

describe("bookmark prefs round-trip", () => {
  it("build then apply restores the same dataTable fields", () => {
    const layers: { [id: string]: LayerStateWithDataTable } = {
      tocA: {
        visible: true,
        loading: false,
        dataTable: { stableId: "t1", column: "c", op: "sum" },
      },
      tocB: { visible: true, loading: false },
    };
    const bookmark = buildDataTableStatesFromLayers(layers);
    const restored = applyDataTableStatesToLayerStates(
      {
        tocA: { visible: true, loading: false },
        tocB: {
          visible: true,
          loading: false,
          dataTable: { stableId: "stale" },
        },
      },
      bookmark
    );
    expect(restored.tocA.dataTable).toEqual(layers.tocA.dataTable);
    expect(restored.tocB.dataTable).toBeUndefined();
  });
});
