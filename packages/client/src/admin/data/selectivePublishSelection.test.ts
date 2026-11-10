import {
  ancestorCrumbs,
  bundleMates,
  checkUnit,
  closureOf,
  coPublishGroup,
  impliedCheckable,
  includedWithTitles,
  linkedRowIds,
  promoteImplied,
  SelectiveUnit,
  setSectionChecked,
  uncheckUnit,
} from "./selectivePublishSelection";

function unit(partial: Partial<SelectiveUnit> & Pick<SelectiveUnit, "stableId">): SelectiveUnit {
  return {
    kind: "updated",
    title: partial.stableId,
    isFolder: false,
    parentStableId: null,
    requiresStableIds: [],
    bundleId: null,
    includedInBundle: false,
    draftId: null,
    ...partial,
  };
}

describe("selective publish selection", () => {
  test("checking a layer moved into a new folder implies that folder", () => {
    const folder = unit({
      stableId: "folder",
      kind: "added",
      title: "Habitats",
      isFolder: true,
    });
    const layer = unit({
      stableId: "layer",
      title: "Coral cover 2024",
      parentStableId: "folder",
      requiresStableIds: ["folder"],
    });
    const units = [folder, layer];
    const explicit = checkUnit([], layer.stableId);
    expect(explicit).toEqual(["layer"]);
    expect(impliedCheckable(explicit, units).map((row) => row.stableId)).toEqual([
      "folder",
    ]);
    expect(closureOf(explicit, units).sort()).toEqual(["folder", "layer"]);
  });

  test("a nested new folder is implied transitively", () => {
    const outer = unit({
      stableId: "outer",
      kind: "added",
      isFolder: true,
    });
    const inner = unit({
      stableId: "inner",
      kind: "added",
      isFolder: true,
      parentStableId: "outer",
      requiresStableIds: ["outer"],
    });
    const layer = unit({
      stableId: "layer",
      parentStableId: "inner",
      requiresStableIds: ["inner"],
    });
    const units = [outer, inner, layer];
    expect(closureOf(["layer"], units).sort()).toEqual(["inner", "layer", "outer"]);
  });

  test("publishing only a new folder does not pull in layers that were moved into it", () => {
    const folder = unit({
      stableId: "folder",
      kind: "added",
      isFolder: true,
    });
    const layer = unit({
      stableId: "layer",
      parentStableId: "folder",
      requiresStableIds: ["folder"],
    });
    expect(closureOf(["folder"], [folder, layer])).toEqual(["folder"]);
  });

  test("unchecking the layer drops the folder it implied", () => {
    const folder = unit({ stableId: "folder", kind: "added", isFolder: true });
    const layer = unit({
      stableId: "layer",
      requiresStableIds: ["folder"],
    });
    const units = [folder, layer];
    const result = uncheckUnit(["layer"], "layer", units);
    expect(result.explicit).toEqual([]);
    expect(result.cascaded).toEqual([]);
    expect(impliedCheckable(result.explicit, units)).toEqual([]);
  });

  test("unchecking an explicit folder cascades the layers that required it", () => {
    const folder = unit({ stableId: "folder", kind: "added", isFolder: true });
    const layer = unit({
      stableId: "layer",
      title: "Coral",
      requiresStableIds: ["folder"],
    });
    const units = [folder, layer];
    const result = uncheckUnit(["layer", "folder"], "folder", units);
    expect(result.cascaded).toEqual(["layer"]);
    expect(result.explicit).toEqual([]);
  });

  test("clicking an implied folder promotes it and names the layer that needs it", () => {
    const folder = unit({
      stableId: "folder",
      kind: "added",
      title: "Habitats",
      isFolder: true,
    });
    const layer = unit({
      stableId: "layer",
      title: "Coral cover 2024",
      requiresStableIds: ["folder"],
    });
    const units = [folder, layer];
    const result = promoteImplied(["layer"], "folder", units);
    expect(result.explicit.sort()).toEqual(["folder", "layer"]);
    expect(result.nudged).toEqual(["layer"]);
    expect(includedWithTitles("folder", ["layer"], units)).toEqual([
      "Coral cover 2024",
    ]);
    expect(linkedRowIds("folder", ["layer"], units).sort()).toEqual([
      "folder",
      "layer",
    ]);
    expect(linkedRowIds("layer", ["layer"], units).sort()).toEqual([
      "folder",
      "layer",
    ]);
  });

  test("deleting a folder requires a layer that was moved out of it", () => {
    const folder = unit({
      stableId: "folder",
      kind: "removed",
      isFolder: true,
      requiresStableIds: ["layer"],
    });
    const layer = unit({ stableId: "layer", kind: "updated" });
    expect(closureOf(["folder"], [folder, layer]).sort()).toEqual([
      "folder",
      "layer",
    ]);
    expect(closureOf(["layer"], [folder, layer])).toEqual(["layer"]);
  });

  test("a removed folder bundles deleted descendants and does not give them checkboxes", () => {
    const folder = unit({
      stableId: "folder",
      kind: "removed",
      title: "Benthic",
      isFolder: true,
      bundleId: "folder",
    });
    const child = unit({
      stableId: "child",
      kind: "removed",
      bundleId: "folder",
      includedInBundle: true,
    });
    const units = [folder, child];
    expect(bundleMates(folder, units).map((row) => row.stableId)).toEqual([
      "child",
    ]);
    expect(closureOf(["folder"], units).sort()).toEqual(["child", "folder"]);
    expect(impliedCheckable(["folder"], units)).toEqual([]);
  });

  test("a shared source bundle publishes every layer when any one is explicit", () => {
    const a = unit({
      stableId: "a",
      title: "Alpha",
      bundleId: "source:9",
    });
    const b = unit({
      stableId: "b",
      title: "Beta",
      bundleId: "source:9",
      includedInBundle: true,
    });
    expect(closureOf(["a"], [a, b]).sort()).toEqual(["a", "b"]);
    expect(closureOf(["b"], [a, b]).sort()).toEqual(["a", "b"]);
  });

  test("select all in one section leaves requirements from another section implied", () => {
    const folder = unit({
      stableId: "folder",
      kind: "added",
      isFolder: true,
    });
    const layer = unit({
      stableId: "layer",
      kind: "updated",
      requiresStableIds: ["folder"],
    });
    const units = [folder, layer];
    const selected = setSectionChecked([], ["layer"], true, units);
    expect(selected.explicit).toEqual(["layer"]);
    expect(impliedCheckable(selected.explicit, units).map((row) => row.kind)).toEqual([
      "added",
    ]);
  });

  test("clearing a section cascades an explicit dependent outside that section", () => {
    const folder = unit({
      stableId: "folder",
      kind: "added",
      isFolder: true,
    });
    const layer = unit({
      stableId: "layer",
      kind: "updated",
      requiresStableIds: ["folder"],
    });
    const units = [folder, layer];
    const result = setSectionChecked(["folder", "layer"], ["folder"], false, units);
    expect(result.cascaded).toEqual(["layer"]);
    expect(result.explicit).toEqual([]);
  });

  test("an unknown id is ignored and a second check is stable", () => {
    const layer = unit({ stableId: "layer" });
    expect(closureOf(["missing", "layer"], [layer])).toEqual(["layer"]);
    expect(checkUnit(["layer"], "layer")).toEqual(["layer"]);
  });

  test("a co-publish group names both sides while the dependency is selected", () => {
    const folder = unit({
      stableId: "folder",
      kind: "added",
      title: "Habitats",
      isFolder: true,
    });
    const layer = unit({
      stableId: "layer",
      title: "Coral",
      requiresStableIds: ["folder"],
    });
    const units = [folder, layer];
    expect(coPublishGroup("layer", ["layer"], units).map((row) => row.stableId)).toEqual([
      "folder",
      "layer",
    ]);
    expect(coPublishGroup("folder", ["layer"], units).map((row) => row.stableId)).toEqual([
      "folder",
      "layer",
    ]);
    expect(coPublishGroup("folder", ["folder", "layer"], units).map((row) => row.title)).toEqual([
      "Habitats",
      "Coral",
    ]);
    expect(coPublishGroup("folder", ["folder"], units).map((row) => row.stableId)).toEqual([
      "folder",
    ]);
    expect(coPublishGroup("missing", ["layer"], units)).toEqual([]);
  });

  test("a co-publish group follows a chain of new folders", () => {
    const outer = unit({
      stableId: "outer",
      kind: "added",
      title: "Outer",
      isFolder: true,
    });
    const inner = unit({
      stableId: "inner",
      kind: "added",
      title: "Inner",
      isFolder: true,
      requiresStableIds: ["outer"],
    });
    const layer = unit({
      stableId: "layer",
      title: "Coral",
      requiresStableIds: ["inner"],
    });
    const units = [outer, inner, layer];
    expect(coPublishGroup("layer", ["layer"], units).map((row) => row.stableId)).toEqual([
      "outer",
      "inner",
      "layer",
    ]);
    expect(coPublishGroup("outer", ["layer"], units).map((row) => row.stableId)).toEqual([
      "outer",
      "inner",
      "layer",
    ]);
  });

  test("bundle mates stay in the co-publish group even when nothing is selected", () => {
    const folder = unit({
      stableId: "folder",
      kind: "removed",
      title: "Benthic",
      isFolder: true,
      bundleId: "folder",
    });
    const child = unit({
      stableId: "child",
      kind: "removed",
      title: "Old reef",
      bundleId: "folder",
      includedInBundle: true,
    });
    const units = [folder, child];
    expect(coPublishGroup("folder", [], units).map((row) => row.title)).toEqual([
      "Benthic",
      "Old reef",
    ]);
    expect(coPublishGroup("child", [], units).map((row) => row.stableId)).toEqual([
      "folder",
      "child",
    ]);
  });

  test("breadcrumbs mark an added ancestor and stop at a missing parent", () => {
    const crumbs = ancestorCrumbs("inner", new Map([
      ["inner", { title: "Benthic", parentStableId: "outer", added: true }],
      ["outer", { title: "Habitats", parentStableId: "gone", added: false }],
    ]));
    expect(crumbs).toEqual([
      { stableId: "outer", title: "Habitats", added: false },
      { stableId: "inner", title: "Benthic", added: true },
    ]);
  });
});
