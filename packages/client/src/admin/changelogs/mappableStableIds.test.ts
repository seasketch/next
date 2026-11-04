import { describe, expect, it } from "@jest/globals";
import {
  ChangeLogTocItem,
  mappableStableIds,
} from "./changeLogEntityTitle";

function item(
  partial: Pick<ChangeLogTocItem, "id" | "stableId"> &
    Partial<ChangeLogTocItem>
): ChangeLogTocItem {
  return {
    title: partial.stableId,
    isFolder: false,
    hasDataLayer: true,
    parentStableId: null,
    ...partial,
  };
}

describe("mappableStableIds", () => {
  const items = [
    item({ id: 1, stableId: "folder", isFolder: true, hasDataLayer: false }),
    item({ id: 2, stableId: "layer-a", parentStableId: "folder" }),
    item({
      id: 3,
      stableId: "nested",
      isFolder: true,
      hasDataLayer: false,
      parentStableId: "folder",
    }),
    item({ id: 4, stableId: "layer-b", parentStableId: "nested" }),
    item({
      id: 5,
      stableId: "empty",
      hasDataLayer: false,
      parentStableId: "folder",
    }),
  ];

  it("returns a layer's own stable id when it can be drawn", () => {
    expect(mappableStableIds(items[1], items)).toEqual(["layer-a"]);
  });

  it("returns no ids for a layer without map data", () => {
    expect(mappableStableIds(items[4], items)).toEqual([]);
  });

  it("collects descendant layers of a folder", () => {
    expect(mappableStableIds(items[0], items).sort()).toEqual([
      "layer-a",
      "layer-b",
    ]);
  });
});
