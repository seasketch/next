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

  it("emits stateChanged synchronously for immediate dataTable patches", () => {
    const manager = new LayerStateManager<LayerState>("overlays");
    manager.addLayer("toc-1", { visible: true, loading: false });
    const seen: Array<string | undefined> = [];
    manager.on("stateChanged", (state: { [key: string]: LayerState }) => {
      seen.push(state["toc-1"]?.dataTable?.column);
    });

    manager.patch(
      "toc-1",
      { dataTable: { stableId: "a", column: "depth" } },
      true
    );
    expect(seen).toContain("depth");
    expect(manager.getState()["toc-1"].dataTable?.column).toBe("depth");

    const beforeDebounced = seen.length;
    manager.patch("toc-1", { dataTable: { stableId: "a", column: "temp" } });
    expect(seen.length).toBe(beforeDebounced);
    expect(manager.getRaw("toc-1")?.dataTable?.column).toBe("temp");
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
