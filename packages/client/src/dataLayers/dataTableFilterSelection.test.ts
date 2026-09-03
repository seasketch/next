import { describe, expect, it } from "@jest/globals";
import {
  applyVisibleMultiSelection,
  visibleSelectionStatus,
} from "./dataTableFilterSelection";

describe("applyVisibleMultiSelection", () => {
  it("selects all visible values, keeping existing order then new matches", () => {
    expect(
      applyVisibleMultiSelection(["bass"], ["anchovy", "bass", "cod"], "all")
    ).toEqual(["bass", "anchovy", "cod"]);
  });

  it("deselects only visible values so hidden selections remain", () => {
    expect(
      applyVisibleMultiSelection(
        ["anchovy", "bass", "cod"],
        ["bass"],
        "none"
      )
    ).toEqual(["anchovy", "cod"]);
  });

  it("clears the selection when every value is visible", () => {
    expect(
      applyVisibleMultiSelection(["bass", "cod"], ["anchovy", "bass", "cod"], "none")
    ).toEqual([]);
  });

  it("leaves the selection unchanged when nothing is visible", () => {
    expect(applyVisibleMultiSelection(["bass"], [], "all")).toEqual(["bass"]);
    expect(applyVisibleMultiSelection(["bass"], [], "none")).toEqual(["bass"]);
  });
});

describe("visibleSelectionStatus", () => {
  it("reports all selected when every visible value is checked", () => {
    expect(
      visibleSelectionStatus(["anchovy", "bass", "cod"], ["bass", "cod"])
    ).toEqual({ allSelected: true, noneSelected: false });
  });

  it("reports none selected when no visible value is checked", () => {
    expect(visibleSelectionStatus(["tuna"], ["bass", "cod"])).toEqual({
      allSelected: false,
      noneSelected: true,
    });
  });

  it("treats an empty visible list as both all and none", () => {
    expect(visibleSelectionStatus(["bass"], [])).toEqual({
      allSelected: true,
      noneSelected: true,
    });
  });
});
