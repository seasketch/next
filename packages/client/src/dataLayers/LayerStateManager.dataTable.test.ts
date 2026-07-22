import { describe, expect, it } from "@jest/globals";
import { LayerStateManager } from "./LayerStateManager";
import { LayerState } from "./MapContextManager";

describe("LayerStateManager dataTable regression", () => {
  it("preserves dataTable across visibility and loading updates", () => {
    const manager = new LayerStateManager<LayerState>("overlays");
    const dataTable = {
      stableId: "table-uuid",
      column: "biomass",
      op: "sum" as const,
    };

    manager.addLayer("toc-1", {
      visible: true,
      loading: false,
    });
    manager.patch("toc-1", { dataTable });

    const afterPatch = manager.getState()["toc-1"];
    expect(afterPatch.dataTable).toEqual(dataTable);
    const dataTableRef = afterPatch.dataTable;

    manager.setVisible("toc-1", false);
    manager.setLoading("toc-1", true);
    manager.setLoading("toc-1", false);
    manager.setVisible("toc-1", true);

    const after = manager.getState()["toc-1"];
    expect(after.dataTable).toBe(dataTableRef);
    expect(after.dataTable).toEqual(dataTable);
    expect(after.visible).toBe(true);
    expect(after.loading).toBe(false);
  });

  it("replacing dataTable via patch updates the object reference", () => {
    const manager = new LayerStateManager<LayerState>("overlays");
    manager.addLayer("toc-1", { visible: true, loading: false });
    manager.patch("toc-1", {
      dataTable: { stableId: "a", column: "x" },
    });
    const first = manager.getState()["toc-1"].dataTable;
    manager.patch("toc-1", {
      dataTable: { stableId: "a", column: "y" },
    });
    const second = manager.getState()["toc-1"].dataTable;
    expect(second).not.toBe(first);
    expect(second?.column).toBe("y");
  });
});
