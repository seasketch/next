import {
  combineMetricsForFragments,
  combineOverlayAreaMetrics,
  classifyOverlayAreaOverlapScope,
  getOverlayAreaClassTotals,
  getOverlayAreaOverlapCombineResult,
  getOverlayAreaDisplayedClassValue,
  getOverlayAreaClassValueRange,
  OverlayAreaMetricValue,
  OverlayAreaOverlapInfo,
  Metric,
  MetricSubjectFragment,
} from "../src/metrics/metrics";

function makeOverlap(partial: {
  bufferKm?: number;
  bbox: [number, number, number, number];
  classes: OverlayAreaOverlapInfo["classes"];
}): OverlayAreaOverlapInfo {
  return {
    bufferKm: partial.bufferKm ?? 1,
    bbox: partial.bbox,
    classes: partial.classes,
  };
}

describe("combineOverlayAreaMetrics", () => {
  it("sums class totals when no __overlap metadata is present (stale fallback)", () => {
    const values: OverlayAreaMetricValue[] = [
      { forest: 10, urban: 5 },
      { forest: 7, urban: 3 },
    ];
    const result = combineOverlayAreaMetrics(values);
    expect(result).toEqual({ forest: 17, urban: 8 });
    expect(getOverlayAreaOverlapCombineResult(result)).toBeNull();
  });

  it("strips __overlap and returns naive totals for a single metric", () => {
    const values: OverlayAreaMetricValue[] = [
      {
        forest: 10,
        __overlap: makeOverlap({
          bbox: [0, 0, 1, 1],
          classes: { forest: { collarArea: 10, oidx: [1], area: [10] } },
        }),
      },
    ];
    const result = combineOverlayAreaMetrics(values);
    expect(result).toEqual({ forest: 10 });
    expect(getOverlayAreaOverlapCombineResult(result)).toBeNull();
  });

  it("silence guarantee gate 1: disjoint bboxes → exact naive sum, no flag", () => {
    const values: OverlayAreaMetricValue[] = [
      {
        forest: 10,
        __overlap: makeOverlap({
          bbox: [0, 0, 1, 1],
          classes: {
            forest: {
              collarArea: 10,
              oidx: [1],
              area: [10],
              featureArea: [0],
            },
          },
        }),
      },
      {
        forest: 8,
        __overlap: makeOverlap({
          bbox: [10, 10, 11, 11],
          classes: {
            forest: {
              collarArea: 8,
              oidx: [1],
              area: [8],
              featureArea: [0],
            },
          },
        }),
      },
    ];
    const result = combineOverlayAreaMetrics(values);
    expect(getOverlayAreaClassTotals(result)).toEqual({ forest: 18 });
    expect(getOverlayAreaOverlapCombineResult(result)).toBeNull();
  });

  it("silence guarantee gate 2: intersecting bboxes but no shared oidx → no flag", () => {
    const values: OverlayAreaMetricValue[] = [
      {
        forest: 10,
        __overlap: makeOverlap({
          bbox: [0, 0, 2, 2],
          classes: {
            forest: { collarArea: 10, oidx: [1], area: [10] },
          },
        }),
      },
      {
        forest: 8,
        __overlap: makeOverlap({
          bbox: [1, 1, 3, 3],
          classes: {
            forest: { collarArea: 8, oidx: [2], area: [8] },
          },
        }),
      },
    ];
    const result = combineOverlayAreaMetrics(values);
    expect(getOverlayAreaClassTotals(result)).toEqual({ forest: 18 });
    expect(getOverlayAreaOverlapCombineResult(result)).toBeNull();
  });

  it("exact correction when fully covered feature appears in both fragments (silent)", () => {
    // Feature area 5, fully covered by each buffer → naive 10, true 5
    const values: OverlayAreaMetricValue[] = [
      {
        forest: 10,
        __overlap: makeOverlap({
          bbox: [0, 0, 2, 2],
          classes: {
            forest: {
              collarArea: 10,
              oidx: [1, 2],
              area: [5, 5],
              // 0 = fully covered
              featureArea: [0, 0],
            },
          },
        }),
      },
      {
        forest: 5,
        __overlap: makeOverlap({
          bbox: [1, 1, 3, 3],
          classes: {
            forest: {
              collarArea: 5,
              oidx: [1],
              area: [5],
              featureArea: [0],
            },
          },
        }),
      },
    ];
    const result = combineOverlayAreaMetrics(values);
    // Feature 1 counted twice (5+5); feature 2 once (5). Corrected = 5+5 = 10
    expect(result.forest).toBe(10);
    const combine = getOverlayAreaOverlapCombineResult(result);
    expect(combine).not.toBeNull();
    expect(combine!.perClass.forest.naiveSum).toBe(15);
    expect(combine!.perClass.forest.overcountMin).toBe(5);
    expect(combine!.perClass.forest.overcountMax).toBe(5);
    // Exact → not flagged for UI warnings
    expect(combine!.flagged).toBe(false);
    expect(getOverlayAreaDisplayedClassValue(result, "forest")).toBe(10);
  });

  it("bounds partial coverage with clamping when Σaᵢ > A_f", () => {
    // Feature Af=10; fragment areas 8 and 7 → true ∈ [8, 10], overcount ∈ [5, 7]
    const values: OverlayAreaMetricValue[] = [
      {
        forest: 8,
        __overlap: makeOverlap({
          bbox: [0, 0, 2, 2],
          classes: {
            forest: {
              collarArea: 8,
              oidx: [1],
              area: [8],
              featureArea: [10],
            },
          },
        }),
      },
      {
        forest: 7,
        __overlap: makeOverlap({
          bbox: [1, 1, 3, 3],
          classes: {
            forest: {
              collarArea: 7,
              oidx: [1],
              area: [7],
              featureArea: [10],
            },
          },
        }),
      },
    ];
    const result = combineOverlayAreaMetrics(values);
    const combine = getOverlayAreaOverlapCombineResult(result)!;
    expect(combine.perClass.forest.naiveSum).toBe(15);
    expect(combine.perClass.forest.overcountMin).toBe(5); // 15 - 10
    expect(combine.perClass.forest.overcountMax).toBe(7); // 15 - 8
    expect(combine.flagged).toBe(true);
    expect(result.forest).toBe(10); // 15 - 5
    const range = getOverlayAreaClassValueRange(result, "forest")!;
    expect(range.low).toBe(8); // 15 - 7
    expect(range.high).toBe(10); // 15 - 5
  });

  it("truncation residual adds collar bound to overcountMax only", () => {
    const values: OverlayAreaMetricValue[] = [
      {
        forest: 20,
        __overlap: makeOverlap({
          bbox: [0, 0, 2, 2],
          classes: {
            forest: {
              collarArea: 20,
              oidx: [1],
              area: [5],
              featureArea: [0],
              entriesTruncated: true,
            },
          },
        }),
      },
      {
        forest: 20,
        __overlap: makeOverlap({
          bbox: [1, 1, 3, 3],
          classes: {
            forest: {
              collarArea: 12,
              oidx: [1],
              area: [5],
              featureArea: [0],
              entriesTruncated: true,
            },
          },
        }),
      },
    ];
    const result = combineOverlayAreaMetrics(values);
    const combine = getOverlayAreaOverlapCombineResult(result)!;
    // Shared fully-covered feature: overcount exact 5
    expect(combine.perClass.forest.overcountMin).toBe(5);
    // Residual collars: min(20-5, 12-5) = min(15, 7) = 7 added to max
    expect(combine.perClass.forest.overcountMax).toBe(5 + 7);
    expect(combine.flagged).toBe(true);
  });

  it("mixed stale + new metrics degrade without throwing (no flag)", () => {
    const values: OverlayAreaMetricValue[] = [
      {
        forest: 10,
        __overlap: makeOverlap({
          bbox: [0, 0, 2, 2],
          classes: {
            forest: { collarArea: 10, oidx: [1], area: [10] },
          },
        }),
      },
      // Stale row — no __overlap
      { forest: 8 },
    ];
    const result = combineOverlayAreaMetrics(values);
    expect(result).toEqual({ forest: 18 });
    expect(getOverlayAreaOverlapCombineResult(result)).toBeNull();
  });

  it("derives corrected '*' from named class totals when groupBy is used", () => {
    // Two fragments share a fully-covered forest feature (5+5) and each has
    // a unique urban strip (3 and 2). Naive "*" = 15; corrected classes sum
    // to 5+5 = 10.
    const values: OverlayAreaMetricValue[] = [
      {
        "*": 8,
        forest: 5,
        urban: 3,
        __overlap: makeOverlap({
          bbox: [0, 0, 2, 2],
          classes: {
            forest: {
              collarArea: 5,
              oidx: [1],
              area: [5],
              featureArea: [0],
            },
            urban: {
              collarArea: 3,
              oidx: [2],
              area: [3],
              featureArea: [0],
            },
          },
        }),
      },
      {
        "*": 7,
        forest: 5,
        urban: 2,
        __overlap: makeOverlap({
          bbox: [1, 1, 3, 3],
          classes: {
            forest: {
              collarArea: 5,
              oidx: [1],
              area: [5],
              featureArea: [0],
            },
            urban: {
              collarArea: 2,
              oidx: [3],
              area: [2],
              featureArea: [0],
            },
          },
        }),
      },
    ];
    const result = combineOverlayAreaMetrics(values);
    expect(result.forest).toBe(5);
    expect(result.urban).toBe(5);
    expect(result["*"]).toBe(10);
    const combine = getOverlayAreaOverlapCombineResult(result)!;
    expect(combine.perClass["*"].naiveSum).toBe(15);
    expect(combine.perClass["*"].overcountMin).toBe(5);
    expect(combine.perClass["*"].overcountMax).toBe(5);
    expect(getOverlayAreaDisplayedClassValue(result, "*")).toBe(10);
  });

  it("combineMetricsForFragments delegates to combineOverlayAreaMetrics", () => {
    const metrics: Pick<Metric, "type" | "value">[] = [
      {
        type: "overlay_area",
        value: {
          forest: 5,
          __overlap: makeOverlap({
            bbox: [0, 0, 2, 2],
            classes: {
              forest: { collarArea: 5, oidx: [1], area: [5], featureArea: [0] },
            },
          }),
        },
      },
      {
        type: "overlay_area",
        value: {
          forest: 5,
          __overlap: makeOverlap({
            bbox: [1, 1, 3, 3],
            classes: {
              forest: { collarArea: 5, oidx: [1], area: [5], featureArea: [0] },
            },
          }),
        },
      },
    ];
    const result = combineMetricsForFragments(metrics);
    expect(result.type).toBe("overlay_area");
    expect(result.value.forest).toBe(5);
    expect(getOverlayAreaOverlapCombineResult(result.value as OverlayAreaMetricValue)?.flagged).toBe(
      false,
    );
  });

  it("skips __overlap when summing via combineGroupedValues path (no metadata)", () => {
    const metrics: Pick<Metric, "type" | "value">[] = [
      { type: "overlay_area", value: { a: 1, b: 2 } },
      { type: "overlay_area", value: { a: 3, b: 4 } },
    ];
    const result = combineMetricsForFragments(metrics);
    expect(result.value).toEqual({ a: 4, b: 6 });
  });
});

describe("classifyOverlayAreaOverlapScope", () => {
  it("classifies within-sketch when fragments share a sketch id", () => {
    const subjects: MetricSubjectFragment[] = [
      { hash: "a", geographies: [1], sketches: [10] },
      { hash: "b", geographies: [1], sketches: [10] },
    ];
    const result = classifyOverlayAreaOverlapScope(
      subjects.map((subject) => ({ subject })),
    );
    expect(result.scope).toBe("within-sketch");
    expect(result.partnerSketchIds).toEqual([]);
    expect(result.fragmentsInvolved).toEqual(["a", "b"]);
  });

  it("classifies between-sketches when fragments belong to different sketches", () => {
    const subjects: MetricSubjectFragment[] = [
      { hash: "a", geographies: [1], sketches: [10] },
      { hash: "b", geographies: [1], sketches: [20] },
    ];
    const result = classifyOverlayAreaOverlapScope(
      subjects.map((subject) => ({ subject })),
    );
    expect(result.scope).toBe("between-sketches");
    expect(result.partnerSketchIds).toEqual([10, 20]);
  });

  it("classifies both when some pairs share sketches and others do not", () => {
    const subjects: MetricSubjectFragment[] = [
      { hash: "a", geographies: [1], sketches: [10] },
      { hash: "b", geographies: [1], sketches: [10] },
      { hash: "c", geographies: [1], sketches: [20] },
    ];
    const result = classifyOverlayAreaOverlapScope(
      subjects.map((subject) => ({ subject })),
    );
    expect(result.scope).toBe("both");
    expect(result.partnerSketchIds).toEqual([10, 20]);
  });
});
