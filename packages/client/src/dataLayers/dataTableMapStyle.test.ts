import { describe, expect, it } from "@jest/globals";
import { Expression } from "mapbox-gl";
import {
  DATA_TABLE_ACTIVE_COLOR,
  DATA_TABLE_HOVER_COLOR,
  DATA_TABLE_LOADING_COLOR,
  DATA_TABLE_LOADING_HOVER_COLOR,
  DATA_TABLE_NO_DATA_COLOR,
  DATA_TABLE_NO_DATA_HOVER_COLOR,
  buildDataTableCircleColorExpression,
  dataTableHoveredExpression,
} from "./dataTableMapStyle";

describe("data table hover paint", () => {
  it("reads the hovered feature-state flag", () => {
    expect(dataTableHoveredExpression()).toEqual([
      "boolean",
      ["feature-state", "hovered"],
      false,
    ]);
  });

  it("uses a darker fill while hovered", () => {
    const isLoading = [
      "boolean",
      ["feature-state", "loading"],
      false,
    ] as Expression;
    const isNoData = [
      "!=",
      ["typeof", ["feature-state", "scaledValue"]],
      "number",
    ] as Expression;
    const color = buildDataTableCircleColorExpression(isLoading, isNoData);
    expect(color[0]).toBe("case");
    expect(color[1]).toEqual(dataTableHoveredExpression());
    const hoveredColors = color[2] as Expression;
    expect(hoveredColors).toEqual([
      "case",
      isLoading,
      DATA_TABLE_LOADING_HOVER_COLOR,
      isNoData,
      DATA_TABLE_NO_DATA_HOVER_COLOR,
      DATA_TABLE_HOVER_COLOR,
    ]);
    expect(color.slice(3)).toEqual([
      isLoading,
      DATA_TABLE_LOADING_COLOR,
      isNoData,
      DATA_TABLE_NO_DATA_COLOR,
      DATA_TABLE_ACTIVE_COLOR,
    ]);
    expect(DATA_TABLE_HOVER_COLOR).not.toBe(DATA_TABLE_ACTIVE_COLOR);
  });
});
