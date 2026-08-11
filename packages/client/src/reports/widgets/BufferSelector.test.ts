import {
  applyBufferSettingsToParameters,
  getBufferSettingsFromDependencies,
} from "./BufferSelector";
import { MetricDependency } from "overlay-engine";

function dep(
  subjectType: "fragments" | "geographies",
  bufferDistanceKm?: number
): MetricDependency {
  return {
    type: "count",
    subjectType,
    stableId: "layer-1",
    parameters:
      bufferDistanceKm !== undefined ? { bufferDistanceKm } : undefined,
  };
}

describe("getBufferSettingsFromDependencies", () => {
  test("defaults bufferGeography to true when not buffering", () => {
    expect(
      getBufferSettingsFromDependencies([dep("fragments"), dep("geographies")])
    ).toEqual({ distanceKm: undefined, bufferGeography: true });
  });

  test("reports geography buffered when both subjects share distance", () => {
    expect(
      getBufferSettingsFromDependencies([
        dep("fragments", 0.5),
        dep("geographies", 0.5),
      ])
    ).toEqual({ distanceKm: 0.5, bufferGeography: true });
  });

  test("reports bufferGeography false when only fragments are buffered", () => {
    expect(
      getBufferSettingsFromDependencies([
        dep("fragments", 1),
        dep("geographies"),
      ])
    ).toEqual({ distanceKm: 1, bufferGeography: false });
  });
});

describe("applyBufferSettingsToParameters", () => {
  test("applies distance to fragments", () => {
    expect(
      applyBufferSettingsToParameters(dep("fragments"), {
        distanceKm: 0.5,
        bufferGeography: true,
      })
    ).toEqual({ bufferDistanceKm: 0.5 });
  });

  test("applies distance to geographies only when bufferGeography is on", () => {
    expect(
      applyBufferSettingsToParameters(dep("geographies"), {
        distanceKm: 0.5,
        bufferGeography: true,
      })
    ).toEqual({ bufferDistanceKm: 0.5 });

    expect(
      applyBufferSettingsToParameters(dep("geographies", 0.5), {
        distanceKm: 0.5,
        bufferGeography: false,
      })
    ).toEqual({ bufferDistanceKm: undefined });
  });

  test("clears buffer when distance is unset", () => {
    expect(
      applyBufferSettingsToParameters(dep("fragments", 1), {
        distanceKm: undefined,
        bufferGeography: true,
      })
    ).toEqual({ bufferDistanceKm: undefined });
  });
});
