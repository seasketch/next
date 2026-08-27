import { SpatialMetricState } from "../../generated/graphql";
import {
  combineMetricsBySource,
  findGeostatsAttributeByName,
  fragmentMetricsTaggedWithGeography,
  getClassTableRows,
  hasClassTableRowVisibilityToggle,
  resolveClassTableRowStableId,
} from "./ClassTableRows";
import {
  getSamoaCardMetrics,
  getSamoaCardSources,
  getSamoaSource,
} from "./testData/samoaFixture";

describe("ClassTableRows helpers", () => {
  test("resolveClassTableRowStableId prefers row stable ids before linked fallbacks", () => {
    expect(
      resolveClassTableRowStableId(
        {
          key: "reef-hard",
          groupByKey: "hard",
          stableId: "row-stable-id",
        },
        {
          "reef-hard": "linked-by-key",
          hard: "linked-by-group",
        }
      )
    ).toBe("row-stable-id");

    expect(
      resolveClassTableRowStableId(
        {
          key: "reef-hard",
          groupByKey: "hard",
        },
        {
          "reef-hard": "linked-by-key",
          hard: "linked-by-group",
        }
      )
    ).toBe("linked-by-key");

    expect(
      resolveClassTableRowStableId(
        {
          key: "reef-hard",
          groupByKey: "hard",
        },
        {
          hard: "linked-by-group",
        }
      )
    ).toBe("linked-by-group");
  });

  test("hasClassTableRowVisibilityToggle checks linked stable ids as well as row ids", () => {
    expect(
      hasClassTableRowVisibilityToggle(
        [
          {
            key: "reef-hard",
            groupByKey: "hard",
          },
        ],
        {
          hard: "linked-by-group",
        }
      )
    ).toBe(true);

    expect(
      hasClassTableRowVisibilityToggle([
        {
          key: "reef-hard",
          groupByKey: "hard",
        },
      ])
    ).toBe(false);
  });
});

describe("fragmentMetricsTaggedWithGeography", () => {
  test("keeps fragments tagged with the requested geography", () => {
    const metrics = [
      {
        type: "count",
        subject: {
          __typename: "FragmentSubject",
          hash: "a",
          sketches: [1],
          geographies: [1],
        },
      },
      {
        type: "count",
        subject: {
          __typename: "FragmentSubject",
          hash: "b",
          sketches: [1],
          geographies: [2],
        },
      },
      {
        type: "count",
        subject: {
          __typename: "GeographySubject",
          id: 2,
        },
      },
    ] as any[];

    const tagged = fragmentMetricsTaggedWithGeography(metrics, 2, "count");
    expect(tagged).toHaveLength(1);
    expect((tagged[0].subject as { hash: string }).hash).toBe("b");
  });
});

describe("combineMetricsBySource", () => {
  test("combines fragment metrics and chooses a deterministic geography metric", () => {
    const sourceUrl = "https://example.com/reef.fgb";
    const metrics = [
      {
        id: "10",
        state: SpatialMetricState.Complete,
        sourceUrl,
        type: "overlay_area",
        subject: {
          __typename: "FragmentSubject",
          hash: "fragment-a",
          sketches: [1],
          geographies: [42],
        },
        value: {
          reef: 2,
        },
      },
      {
        id: "11",
        state: SpatialMetricState.Complete,
        sourceUrl,
        type: "overlay_area",
        subject: {
          __typename: "FragmentSubject",
          hash: "fragment-b",
          sketches: [2],
          geographies: [42],
        },
        value: {
          reef: 3,
        },
      },
      {
        id: "20",
        state: SpatialMetricState.Complete,
        sourceUrl,
        type: "overlay_area",
        subject: {
          __typename: "GeographySubject",
          id: 42,
        },
        value: {
          reef: 5,
        },
      },
      {
        id: "21",
        state: SpatialMetricState.Complete,
        sourceUrl,
        type: "overlay_area",
        subject: {
          __typename: "GeographySubject",
          id: 42,
        },
        value: {
          reef: 7,
        },
      },
      {
        id: "22",
        state: SpatialMetricState.Error,
        sourceUrl,
        type: "overlay_area",
        subject: {
          __typename: "GeographySubject",
          id: 42,
        },
        value: {
          reef: 999,
        },
      },
    ] as any[];

    const result = combineMetricsBySource<any>(
      metrics as any,
      [
        {
          stableId: "reef-source",
          sourceUrl,
        },
      ] as any,
      42,
      "overlay_area"
    );

    expect(result["reef-source"].fragments.value.reef).toBe(5);
    expect(result["reef-source"].geographies.value.reef).toBe(7);
  });

  test("excludes fragment metrics that are not tagged with the requested geography", () => {
    const sourceUrl = "https://example.com/reef.fgb";
    const metrics = [
      {
        id: "10",
        state: SpatialMetricState.Complete,
        sourceUrl,
        type: "overlay_area",
        subject: {
          __typename: "FragmentSubject",
          hash: "fragment-a",
          sketches: [1],
          geographies: [1],
        },
        value: {
          reef: 10,
        },
      },
      {
        id: "20",
        state: SpatialMetricState.Complete,
        sourceUrl,
        type: "overlay_area",
        subject: {
          __typename: "GeographySubject",
          id: 2,
        },
        value: {
          reef: 100,
        },
      },
    ] as any[];

    const result = combineMetricsBySource<any>(
      metrics as any,
      [
        {
          stableId: "reef-source",
          sourceUrl,
        },
      ] as any,
      2,
      "overlay_area"
    );

    expect(result["reef-source"].fragments.value["*"]).toBe(0);
    expect(result["reef-source"].geographies.value.reef).toBe(100);
  });

  test("combines real Samoa raster metrics for a report card", () => {
    const result = combineMetricsBySource<any>(
      getSamoaCardMetrics(2577) as any,
      getSamoaCardSources(2577) as any,
      272,
      "raster_stats"
    );

    expect(result["dBbilSYL6"].fragments.value.bands[0].sum).toBeCloseTo(
      530.0099530708814,
      10
    );
    expect(result["dBbilSYL6"].geographies.value.bands[0].sum).toBeCloseTo(
      2277.5529994918033,
      10
    );
    expect(result["wISq9t49P"].fragments.value.bands[0].sum).toBeCloseTo(
      2251024.1887735487,
      7
    );
    expect(result["wISq9t49P"].geographies.value.bands[0].sum).toBe(
      9303358
    );
  });
});

describe("getClassTableRows with Samoa fixture data", () => {
  test("builds grouped vector rows from a real geostats attribute configuration", () => {
    const rows = getClassTableRows({
      dependencies: [
        {
          subjectType: "fragments",
          stableId: "ht1woHIfG",
          type: "overlay_area",
          parameters: {
            groupBy: "EBSAFINAL",
          },
        },
      ] as any,
      sources: [getSamoaSource("ht1woHIfG")] as any,
      allFeaturesLabel: "All features",
      includeAllFeaturesRowForGroupedSources: ["ht1woHIfG"],
      customLabels: {
        "ht1woHIfG-18": "EBSA 18 custom",
      },
      excludedRowKeys: ["ht1woHIfG-11"],
      stableIds: {
        "ht1woHIfG-*": "ebsa-total",
      },
    });

    expect(rows).toEqual([
      expect.objectContaining({
        key: "ht1woHIfG-*",
        label: "Ecological Biologically Significant Areas",
        groupByKey: "*",
        sourceId: "ht1woHIfG",
        stableId: "ebsa-total",
      }),
      expect.objectContaining({
        key: "ht1woHIfG-18",
        label: "EBSA 18 custom",
        groupByKey: "18",
        sourceId: "ht1woHIfG",
        stableId: undefined,
      }),
    ]);
    // Category rows only get a single `color` when extractColorsForCategories
    // resolves one; unmatched categories intentionally have no palette fallback.
    expect(rows.find((r) => r.key === "ht1woHIfG-18")?.colors).toBeUndefined();
  });

  test("findGeostatsAttributeByName matches column names, not array indexes", () => {
    const layer = {
      attributes: [
        { attribute: "fid", type: "number", values: {} },
        { attribute: "response_id", type: "number", values: {} },
        { attribute: "priority", type: "number", values: {} },
        {
          attribute: "aquaculture_mariculture_species_other",
          type: "string",
          values: { other: 1 },
        },
        {
          attribute: "aquaculture_mariculture_functions_other",
          type: "string",
          values: { other: 1 },
        },
        {
          attribute: "aquaculture_mariculture_status",
          type: "string",
          values: { Active: 2, Inactive: 1 },
        },
      ],
    };

    expect(
      findGeostatsAttributeByName(layer as any, "aquaculture_mariculture_status")
        ?.attribute
    ).toBe("aquaculture_mariculture_status");
    expect(findGeostatsAttributeByName(layer as any, "5")).toBeUndefined();
    expect(findGeostatsAttributeByName(layer as any, "9")).toBeUndefined();
    expect(findGeostatsAttributeByName(layer as any, null)).toBeUndefined();
    expect(findGeostatsAttributeByName(undefined, "status")).toBeUndefined();
  });

  test("throws when groupBy is not an attribute name", () => {
    const source = {
      stableId: "sectors",
      geostats: {
        layers: [
          {
            attributes: [
              { attribute: "fid", type: "number", values: {} },
              {
                attribute: "aquaculture_mariculture_status",
                type: "string",
                values: { Active: 2, Inactive: 1 },
              },
            ],
          },
        ],
      },
      mapboxGlStyles: [],
      tableOfContentsItem: { title: "Sectors" },
    };

    expect(() =>
      getClassTableRows({
        dependencies: [
          {
            subjectType: "fragments",
            stableId: "sectors",
            type: "column_values",
            parameters: { groupBy: "5" },
          },
        ] as any,
        sources: [source] as any,
        allFeaturesLabel: "All features",
      })
    ).toThrow("Attribute 5 not found in geostats layer");

    const rows = getClassTableRows({
      dependencies: [
        {
          subjectType: "fragments",
          stableId: "sectors",
          type: "column_values",
          parameters: { groupBy: "aquaculture_mariculture_status" },
        },
      ] as any,
      sources: [source] as any,
      allFeaturesLabel: "All features",
    });
    expect(rows.map((r) => r.groupByKey)).toEqual(["Active", "Inactive"]);
  });

  test("builds raster rows from a real Samoa style ramp", () => {
    const rows = getClassTableRows({
      dependencies: [
        {
          subjectType: "fragments",
          stableId: "dBbilSYL6",
          type: "raster_stats",
          parameters: {},
        },
      ] as any,
      sources: [getSamoaSource("dBbilSYL6")] as any,
      allFeaturesLabel: "All features",
      stableIds: {
        "dBbilSYL6-*": "fish-caught-layer",
      },
    });

    expect(rows).toEqual([
      expect.objectContaining({
        key: "dBbilSYL6-*",
        label: "Fish Caught",
        groupByKey: "*",
        sourceId: "dBbilSYL6",
        stableId: "fish-caught-layer",
        colors: [
          "#0d0887",
          "#46039f",
          "#7201a8",
          "#9c179e",
          "#bd3786",
          "#d8576b",
          "#ed7953",
          "#fb9f3a",
          "#fdca26",
          "#f0f921",
        ],
        multiColorSwatchLayout: "raster-ramp-order",
      }),
    ]);
  });
});
