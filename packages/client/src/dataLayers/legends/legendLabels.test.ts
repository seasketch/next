import {
  compileLegendFromGLStyleLayers,
  SeaSketchGlLayer,
} from "./compileLegend";
import {
  GLLegendCircleSymbol,
  GLLegendListPanel,
  MultipleSymbolLegendForGLLayers,
} from "./LegendDataModel";

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

function compileListLegend(layers: SeaSketchGlLayer[]) {
  const legend = compileLegendFromGLStyleLayers(layers, "geojson");
  expect(legend.type).toBe("MultipleSymbolGLLegend");
  return legend as MultipleSymbolLegendForGLLayers;
}

function soleListPanel(layers: SeaSketchGlLayer[]): GLLegendListPanel {
  const legend = compileListLegend(layers);
  expect(legend.panels).toHaveLength(1);
  expect(legend.panels[0].type).toBe("GLLegendListPanel");
  return legend.panels[0] as GLLegendListPanel;
}

describe("s:legend-labels — match expressions", () => {
  test("renames panel title and string category values", () => {
    const panel = soleListPanel([
      {
        type: "circle",
        paint: {
          "circle-color": [
            "match",
            ["get", "type"],
            "foo",
            "#ff0000",
            "bar",
            "#00ff00",
            "#000000",
          ],
          "circle-radius": 6,
        },
        metadata: {
          "s:legend-labels": {
            type: "Habitat Type",
            foo: "Backreef",
            bar: "Deep Reef",
          },
        },
      },
    ]);

    expect(panel.label).toBe("Habitat Type");
    expect(panel.items.map((i) => i.label)).toEqual([
      "Backreef",
      "Deep Reef",
      "default",
    ]);
    expect((panel.items[0].symbol as GLLegendCircleSymbol).color).toBe(
      "#ff0000"
    );
    expect((panel.items[1].symbol as GLLegendCircleSymbol).color).toBe(
      "#00ff00"
    );
  });

  test("applies labels for numeric zero and boolean false match keys", () => {
    const panel = soleListPanel([
      {
        type: "circle",
        paint: {
          "circle-color": [
            "match",
            ["get", "code"],
            0,
            "#111111",
            1,
            "#222222",
            "#ffffff",
          ],
          "circle-radius": 6,
        },
        metadata: {
          "s:legend-labels": {
            code: "Class",
            "0": "Absent",
            "1": "Present",
          },
        },
      },
    ]);

    expect(panel.label).toBe("Class");
    expect(panel.items.map((i) => i.label)).toEqual([
      "Absent",
      "Present",
      "default",
    ]);
  });

  test("applies default fallback label from s:legend-labels", () => {
    const panel = soleListPanel([
      {
        type: "circle",
        paint: {
          "circle-color": [
            "match",
            ["get", "type"],
            "foo",
            "#ff0000",
            "#cccccc",
          ],
          "circle-radius": 6,
        },
        metadata: {
          "s:legend-labels": {
            type: "Category",
            foo: "Named",
            default: "Other",
          },
        },
      },
    ]);

    expect(panel.label).toBe("Category");
    expect(panel.items.map((i) => i.label)).toEqual(["Named", "Other"]);
  });

  test("evaluates colors when match input wraps get in to-string", () => {
    const panel = soleListPanel([
      {
        type: "circle",
        paint: {
          "circle-color": [
            "match",
            ["to-string", ["get", "active"]],
            "true",
            "#31c91d",
            "false",
            "#ebd700",
            "#ffffff",
          ],
          "circle-radius": 6,
          "circle-stroke-width": 2,
        },
        metadata: {
          "s:legend-labels": {
            active: "Buoy Status",
            true: "active",
            false: "inactive",
            default: "unknown",
          },
        },
      },
    ]);

    expect(panel.label).toBe("Buoy Status");
    expect(panel.items.map((i) => i.label)).toEqual([
      "active",
      "inactive",
      "unknown",
    ]);
    expect((panel.items[0].symbol as GLLegendCircleSymbol).color).toBe(
      "#31c91d"
    );
    expect((panel.items[1].symbol as GLLegendCircleSymbol).color).toBe(
      "#ebd700"
    );
    expect((panel.items[2].symbol as GLLegendCircleSymbol).color).toBe(
      "#ffffff"
    );
  });
});

describe("s:legend-labels — case expressions", () => {
  test("renames panel title and boolean case branches for circle-color", () => {
    const panel = soleListPanel([
      {
        type: "circle",
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "active"], true],
            "#31c91d",
            ["==", ["get", "active"], false],
            "#ebd700",
            "#ffffff",
          ],
          "circle-radius": 6,
        },
        metadata: {
          "s:legend-labels": {
            active: "Buoy Status",
            true: "active",
            false: "inactive",
            default: "unknown",
          },
        },
      },
    ]);

    expect(panel.label).toBe("Buoy Status");
    expect(panel.items.map((i) => i.label)).toEqual([
      "active",
      "inactive",
      "unknown",
    ]);
    expect((panel.items[0].symbol as GLLegendCircleSymbol).color).toBe(
      "#31c91d"
    );
    expect((panel.items[1].symbol as GLLegendCircleSymbol).color).toBe(
      "#ebd700"
    );
  });

  test("labels boolean case on circle-opacity with unused-boolean fallback", () => {
    const panel = soleListPanel([
      {
        type: "circle",
        paint: {
          "circle-color": "#d4ff00",
          "circle-radius": 6,
          "circle-opacity": ["case", ["==", ["get", "active"], true], 1, 0.1],
          "circle-stroke-width": 2,
        },
        metadata: {
          "s:legend-labels": {
            active: "Buoy Status",
            true: "active",
            false: "inactive",
          },
        },
      },
    ]);

    expect(panel.label).toBe("Buoy Status");
    expect(panel.items.map((i) => i.label)).toEqual(["active", "inactive"]);
    expect((panel.items[0].symbol as GLLegendCircleSymbol).fillOpacity).toBe(1);
    expect((panel.items[1].symbol as GLLegendCircleSymbol).fillOpacity).toBe(
      0.1
    );
  });

  test("renames string case branches", () => {
    const panel = soleListPanel([
      {
        type: "circle",
        paint: {
          "circle-color": [
            "case",
            ["==", ["get", "type"], "foo"],
            "#ff0000",
            ["==", ["get", "type"], "bar"],
            "#00ff00",
            "#000000",
          ],
          "circle-radius": 6,
        },
        metadata: {
          "s:legend-labels": {
            type: "Kind",
            foo: "Alpha",
            bar: "Beta",
            default: "Other",
          },
        },
      },
    ]);

    expect(panel.label).toBe("Kind");
    expect(panel.items.map((i) => i.label)).toEqual([
      "Alpha",
      "Beta",
      "Other",
    ]);
  });
});

describe("s:legend-labels — filtered layers", () => {
  test("uses metadata.label for items and preserves panel title after consolidation", () => {
    const panel = soleListPanel([
      {
        type: "circle",
        filter: ["==", ["get", "active"], true],
        paint: {
          "circle-color": "#31c91d",
          "circle-radius": 6,
          "circle-stroke-width": 2,
        },
        metadata: {
          label: "active",
          "s:legend-labels": {
            active: "Buoy Status",
          },
        },
      },
      {
        type: "circle",
        filter: ["==", ["get", "active"], false],
        paint: {
          "circle-color": "#ebd700",
          "circle-radius": 6,
          "circle-stroke-width": 2,
        },
        metadata: {
          label: "inactive",
          "s:legend-labels": {
            active: "Buoy Status",
          },
        },
      },
    ]);

    expect(panel.label).toBe("Buoy Status");
    expect(panel.items.map((i) => i.label)).toEqual(["active", "inactive"]);
    expect((panel.items[0].symbol as GLLegendCircleSymbol).color).toBe(
      "#31c91d"
    );
    expect((panel.items[1].symbol as GLLegendCircleSymbol).color).toBe(
      "#ebd700"
    );
  });

  test("keeps raw property name as panel title when no legend-labels override", () => {
    const panel = soleListPanel([
      {
        type: "circle",
        filter: ["==", ["get", "active"], true],
        paint: {
          "circle-color": "#31c91d",
          "circle-radius": 6,
        },
        metadata: {
          label: "active",
        },
      },
      {
        type: "circle",
        filter: ["==", ["get", "active"], false],
        paint: {
          "circle-color": "#ebd700",
          "circle-radius": 6,
        },
        metadata: {
          label: "inactive",
        },
      },
    ]);

    expect(panel.label).toBe("active");
    expect(panel.items.map((i) => i.label)).toEqual(["active", "inactive"]);
  });
});

describe("s:legend-labels — other panel types", () => {
  test("renames step panel title", () => {
    const legend = compileListLegend([
      {
        type: "circle",
        paint: {
          "circle-color": [
            "step",
            ["get", "population"],
            "#f7fbff",
            1000,
            "#6baed6",
            10000,
            "#08306b",
          ],
          "circle-radius": 6,
        },
        metadata: {
          "s:legend-labels": {
            population: "Population",
          },
        },
      },
    ]);

    const panel = legend.panels.find((p) => p.type === "GLLegendStepPanel");
    expect(panel).toBeDefined();
    expect(panel!.label).toBe("Population");
  });

  test("renames bubble panel title", () => {
    const legend = compileLegendFromGLStyleLayers(
      [
        {
          type: "circle",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "population"],
              1000,
              5,
              100000,
              40,
            ],
            "circle-color": "#3388ff",
          },
          metadata: {
            "s:legend-labels": {
              population: "Population",
            },
          },
        },
      ],
      "geojson"
    );

    expect(legend.type).toBe("MultipleSymbolGLLegend");
    const panel = (legend as MultipleSymbolLegendForGLLayers).panels.find(
      (p) => p.type === "GLLegendBubblePanel"
    );
    expect(panel).toBeDefined();
    expect(panel!.label).toBe("Population");
  });

  test("space value hides match panel title", () => {
    const panel = soleListPanel([
      {
        type: "circle",
        paint: {
          "circle-color": [
            "match",
            ["get", "type"],
            "foo",
            "#ff0000",
            "#000000",
          ],
          "circle-radius": 6,
        },
        metadata: {
          "s:legend-labels": {
            type: " ",
            foo: "Named",
          },
        },
      },
    ]);

    expect(panel.label).toBe(" ");
    expect(panel.items[0].label).toBe("Named");
  });
});
