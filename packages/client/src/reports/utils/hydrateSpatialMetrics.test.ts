import { hashMetricDependency, type MetricDependency } from "overlay-engine";
import type { CompatibleSpatialMetricSlimFragment } from "../../generated/graphql";
import {
  buildOverlayStableIdToSourceUrlMap,
  hydrateMetricSubjectRefs,
  hydrateSpatialMetrics,
} from "./hydrateSpatialMetrics";

const urlMap = { layerA: "https://example.com/a.geojson" };

function slimGeo(
  overrides: Partial<CompatibleSpatialMetricSlimFragment> &
    Pick<CompatibleSpatialMetricSlimFragment, "id" | "dependencyHash">,
): CompatibleSpatialMetricSlimFragment {
  return {
    __typename: "CompatibleSpatialMetric",
    type: "overlay_area",
    g: 1,
    f: null,
    value: {},
    state: "complete" as any,
    errorMessage: null,
    progress: 100,
    eta: null,
    startedAt: null,
    durationSeconds: 1,
    ...overrides,
  } as CompatibleSpatialMetricSlimFragment;
}

describe("hydrateSpatialMetrics", () => {
  test("hydrates parameters and sourceUrl from dependency", () => {
    const deps: MetricDependency[] = [
      {
        type: "overlay_area",
        subjectType: "geographies",
        stableId: "layerA",
        parameters: { groupBy: "habitat", bufferDistanceKm: 2 },
      },
    ];
    const h = hashMetricDependency(deps[0], urlMap);
    const slim = [slimGeo({ id: 1 as any, dependencyHash: h })];

    const out = hydrateSpatialMetrics({
      slimMetrics: slim,
      dependencies: deps,
      overlaySourceUrlByStableId: urlMap,
      fragmentSubjectCatalog: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].sourceUrl).toBe("https://example.com/a.geojson");
    expect(out[0].parameters?.groupBy).toBe("habitat");
    expect(out[0].parameters?.__typename).toBe("MetricParameters");
    expect(out[0].subject).toEqual({ __typename: "GeographySubject", id: 1 });
  });

  test("drops metrics whose dependencyHash is not in the doc dependency set", () => {
    const slim = [
      slimGeo({
        id: 99 as any,
        dependencyHash: "no-such-hash",
      }),
    ];
    const out = hydrateSpatialMetrics({
      slimMetrics: slim,
      dependencies: [],
      overlaySourceUrlByStableId: urlMap,
      fragmentSubjectCatalog: [],
    });
    expect(out).toHaveLength(0);
  });

  test("keeps multiple slim rows that share the same dependency hash", () => {
    const dep: MetricDependency = {
      type: "overlay_area",
      subjectType: "geographies",
      stableId: "layerA",
      parameters: { groupBy: "x" },
    };
    const h = hashMetricDependency(dep, urlMap);
    const slim = [
      slimGeo({
        id: 1 as any,
        dependencyHash: h,
        g: 1,
      }),
      slimGeo({
        id: 2 as any,
        dependencyHash: h,
        g: 2,
      }),
    ];
    const out = hydrateSpatialMetrics({
      slimMetrics: slim,
      dependencies: [dep],
      overlaySourceUrlByStableId: urlMap,
      fragmentSubjectCatalog: [],
    });
    expect(out).toHaveLength(2);
    expect(out[0].parameters?.groupBy).toBe("x");
    expect(out[1].parameters?.groupBy).toBe("x");
    expect(out[0].subject).toEqual({ __typename: "GeographySubject", id: 1 });
    expect(out[1].subject).toEqual({ __typename: "GeographySubject", id: 2 });
  });

  test("hydrates fragment subject from catalog index f", () => {
    const dep: MetricDependency = {
      type: "overlay_area",
      subjectType: "fragments",
      stableId: "layerA",
      parameters: {},
    };
    const h = hashMetricDependency(dep, urlMap);
    const hash = "deadbeef".repeat(8);
    const catalog = [
      {
        __typename: "FragmentSubject" as const,
        hash,
        sketches: [3],
        geographies: [4],
      },
    ];
    const slim = [
      {
        __typename: "CompatibleSpatialMetric" as const,
        type: "overlay_area",
        id: 5 as any,
        dependencyHash: h,
        f: 0,
        value: {},
        state: "complete" as any,
        errorMessage: null,
        progress: 100,
        eta: null,
        startedAt: null,
        durationSeconds: 1,
      } as CompatibleSpatialMetricSlimFragment,
    ];

    const out = hydrateSpatialMetrics({
      slimMetrics: slim,
      dependencies: [dep],
      overlaySourceUrlByStableId: urlMap,
      fragmentSubjectCatalog: catalog,
    });
    expect(out).toHaveLength(1);
    expect(out[0].subject).toEqual({
      __typename: "FragmentSubject",
      hash,
      sketches: [3],
      geographies: [4],
    });
  });

  test("drops metrics when catalog index f is out of range after hydrate", () => {
    const dep: MetricDependency = {
      type: "overlay_area",
      subjectType: "fragments",
      stableId: "layerA",
      parameters: {},
    };
    const h = hashMetricDependency(dep, urlMap);
    const slim = [
      {
        __typename: "CompatibleSpatialMetric" as const,
        type: "overlay_area",
        id: 5 as any,
        dependencyHash: h,
        f: 99,
        value: {},
        state: "complete" as any,
        errorMessage: null,
        progress: 100,
        eta: null,
        startedAt: null,
        durationSeconds: 1,
      } as CompatibleSpatialMetricSlimFragment,
    ];

    const out = hydrateSpatialMetrics({
      slimMetrics: slim,
      dependencies: [dep],
      overlaySourceUrlByStableId: urlMap,
      fragmentSubjectCatalog: [],
    });
    expect(out).toHaveLength(0);
  });
});

describe("hydrateMetricSubjectRefs", () => {
  test("no-op when subject already set", () => {
    const m: Record<string, unknown> = {
      subject: { __typename: "GeographySubject", id: 9 },
      g: 1,
    };
    hydrateMetricSubjectRefs(m, []);
    expect(m.subject).toEqual({ __typename: "GeographySubject", id: 9 });
    expect(m.g).toBeUndefined();
    expect(m.f).toBeUndefined();
  });

  test("leaves subject unset when f is out of range", () => {
    const m: Record<string, unknown> = { f: 99 };
    hydrateMetricSubjectRefs(m, []);
    expect(m.subject).toBeUndefined();
    expect(m.g).toBeUndefined();
    expect(m.f).toBeUndefined();
  });
});

describe("buildOverlayStableIdToSourceUrlMap", () => {
  test("indexes stableId to sourceUrl", () => {
    const m = buildOverlayStableIdToSourceUrlMap([
      { stableId: "a", sourceUrl: "u1" } as any,
      { stableId: "b", sourceUrl: null } as any,
    ]);
    expect(m.a).toBe("u1");
    expect(m.b).toBeUndefined();
  });
});
