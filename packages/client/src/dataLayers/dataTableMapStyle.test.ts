import { describe, expect, it } from "@jest/globals";
import { Expression } from "mapbox-gl";
import {
  DATA_TABLE_ACTIVE_COLOR,
  DATA_TABLE_HOVER_COLOR,
  DATA_TABLE_LOADING_COLOR,
  DATA_TABLE_LOADING_HOVER_COLOR,
  DATA_TABLE_NO_DATA_COLOR,
  DATA_TABLE_NO_DATA_HOVER_COLOR,
  DATA_TABLE_SCALED_MIN_POSITIVE,
  DATA_TABLE_VALUE_CLASS_DATA,
  DATA_TABLE_VALUE_CLASS_EMPTY,
  DATA_TABLE_VALUE_CLASS_ZERO,
  DATA_TABLE_ZERO_SENTINEL,
  buildDataTableCircleColorExpression,
  buildDataTablePaintFeatureState,
  dataTableHoveredExpression,
  dataTableIsZeroExpression,
  decodeDataTableRawValue,
  scaleDataTableValue,
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

describe("data table zero feature-state encoding", () => {
  it("never writes numeric 0 into paint feature-state", () => {
    const zero = buildDataTablePaintFeatureState(0, 0.4, 10);
    expect(zero.valueClass).toBe(DATA_TABLE_VALUE_CLASS_ZERO);
    expect(zero.scaledValue).toBe(DATA_TABLE_ZERO_SENTINEL);
    expect(zero.rawValue).toBe(DATA_TABLE_ZERO_SENTINEL);
    expect(Object.values(zero).includes(0)).toBe(false);

    const empty = buildDataTablePaintFeatureState(null, 0.4, 10);
    expect(empty.valueClass).toBe(DATA_TABLE_VALUE_CLASS_EMPTY);
    expect(empty.scaledValue).toBeNull();

    const minPositive = buildDataTablePaintFeatureState(0.4, 0.4, 10);
    expect(minPositive.valueClass).toBe(DATA_TABLE_VALUE_CLASS_DATA);
    expect(minPositive.scaledValue).toBe(DATA_TABLE_SCALED_MIN_POSITIVE);
    expect(minPositive.rawValue).toBe(0.4);
  });

  it("keeps the smallest positive value off the Mapbox-ignored 0 slot", () => {
    expect(scaleDataTableValue(0, 4, 10)).toBe(DATA_TABLE_ZERO_SENTINEL);
    expect(scaleDataTableValue(4, 4, 10)).toBe(DATA_TABLE_SCALED_MIN_POSITIVE);
    expect(scaleDataTableValue(10, 4, 10)).toBe(1);
    expect(scaleDataTableValue(7, 4, 10)).toBeCloseTo(0.5);
  });

  it("decodes the zero sentinel back to 0 for tooltips", () => {
    expect(
      decodeDataTableRawValue({
        valueClass: DATA_TABLE_VALUE_CLASS_ZERO,
        rawValue: DATA_TABLE_ZERO_SENTINEL,
        scaledValue: DATA_TABLE_ZERO_SENTINEL,
      })
    ).toBe(0);
    expect(
      decodeDataTableRawValue({
        valueClass: DATA_TABLE_VALUE_CLASS_EMPTY,
        rawValue: null,
        scaledValue: null,
      })
    ).toBeNull();
    expect(decodeDataTableRawValue({ rawValue: 3.5 })).toBe(3.5);
    expect(decodeDataTableRawValue({ rawValue: 0 })).toBe(0);
  });

  it("matches zeros via valueClass or the scaledValue sentinel", () => {
    expect(dataTableIsZeroExpression()).toEqual([
      "any",
      ["==", ["feature-state", "valueClass"], "zero"],
      ["==", ["feature-state", "scaledValue"], DATA_TABLE_ZERO_SENTINEL],
    ]);
  });
});
