import { GLLegendFillSymbol } from "./LegendDataModel";
import {
  pluckBubblePanels,
  pluckGradientPanels,
  pluckHeatmapPanels,
  pluckStepPanels,
  SeaSketchGlLayer,
} from "./compileLegend";

describe("bubble charts", () => {
  test("Simple bubble chart", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "population"],
              100000,
              5,
              10000000,
              50,
            ],
          },
        },
      ],
    };
    const output = pluckBubblePanels(context);

    expect(output.length).toBe(1);
    const { filters, panel } = output[0];
    const stops = panel.stops;
    expect(stops[0].radius).toBe(5);
    expect(stops[1].radius).toBe(55 / 2);
    expect(stops[2].radius).toBe(50);
    expect(filters.length).toBe(0);
    expect(panel.label).toBe("population");
    const firstStop = stops[0];
    expect(firstStop.value).toBe(100000);
    expect(firstStop.radius).toBe(5);
    expect(firstStop.strokeWidth).toBe(0);
    expect(firstStop.fill).toBe("#000000");
    expect(firstStop.stroke).toBe("#000000");
    expect(firstStop.fillOpacity).toBe(1);

    // layer is removed since it's been fully represented by the bubble chart
    expect(context.layers.length).toBe(0);
  });

  test("Stops are limited to 3", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "population"],
              100000,
              5,
              10000000,
              50,
              20000000,
              100,
              30000000,
              150,
              40000000,
              200,
            ],
          },
        },
      ],
    };
    const output = pluckBubblePanels(context);
    expect(output.length).toBe(1);
    const { panel } = output[0];
    const stopValues = panel.stops.map((s) => s.radius);
    expect(stopValues).toEqual([5, 100, 200]);
  });

  test("Bubble chart with static stroke style", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "population"],
              100000,
              5,
              10000000,
              50,
            ],
            "circle-stroke-color": "red",
            "circle-stroke-width": 1,
          },
        },
      ],
    };
    const output = pluckBubblePanels(context);

    expect(output.length).toBe(1);
    const { filters, panel } = output[0];
    const stops = panel.stops;
    expect(filters.length).toBe(0);
    expect(panel.label).toBe("population");
    const firstStop = stops[0];
    expect(firstStop.value).toBe(100000);
    expect(firstStop.radius).toBe(5);
    expect(firstStop.strokeWidth).toBe(1);
    expect(firstStop.fill).toBe("#000000");
    expect(firstStop.stroke).toBe("red");
    expect(firstStop.fillOpacity).toBe(1);

    // layer is removed since it's been fully represented by the bubble chart
    expect(context.layers.length).toBe(0);
  });

  test("Bubble chart with matching interpolated stroke style", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "population"],
              100000,
              5,
              10000000,
              50,
            ],
            "circle-color": [
              "interpolate-hcl",
              ["linear"],
              ["get", "population"],
              100000,
              "rgb(0,0,255)",
              10000000,
              "rgb(255,0,0)",
            ],
            "circle-stroke-width": 1,
          },
        },
      ],
    };
    const output = pluckBubblePanels(context);

    expect(output.length).toBe(1);
    const { filters, panel } = output[0];
    const stops = panel.stops;
    expect(filters.length).toBe(0);
    expect(panel.label).toBe("population");
    const firstStop = stops[0];
    expect(firstStop.value).toBe(100000);
    expect(firstStop.radius).toBe(5);
    expect(firstStop.strokeWidth).toBe(1);
    expect(firstStop.fill).toBe("rgba(0,0,255,1)");
    expect(firstStop.fillOpacity).toBe(1);
    expect(stops[2].fill).toBe("rgba(255,0,0,1)");

    // layer is removed since it's been fully represented by the bubble chart
    expect(context.layers.length).toBe(0);
  });

  test("Bubble chart with non-matching expression-based stroke style", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "population"],
              100000,
              5,
              10000000,
              50,
            ],
            "circle-color": [
              "match",
              ["get", "type"],
              "foo",
              "purple",
              "bar",
              "green",
              "black",
            ],
            "circle-stroke-width": 1,
          },
        },
      ],
    };
    const output = pluckBubblePanels(context);

    expect(output.length).toBe(1);
    const { filters, panel } = output[0];
    const stops = panel.stops;
    expect(filters.length).toBe(0);
    expect(panel.label).toBe("population");
    const firstStop = stops[0];
    expect(firstStop.value).toBe(100000);
    expect(firstStop.fill).toBe("black");
    // Layer is not removed because it does not represent the match expression
    // which changes the fill color based on "type"
    expect(context.layers.length).toBe(1);
    const remainingLayer = context.layers[0];
    expect(remainingLayer.paint).toEqual({
      "circle-radius": null,
      "circle-stroke-width": 1,
      "circle-color": [
        "match",
        ["get", "type"],
        "foo",
        "purple",
        "bar",
        "green",
        "black",
      ],
    });
  });

  test("Multiple bubble charts for different layers with filters", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          filter: ["==", ["get", "type"], "foo"],
          type: "circle",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "population"],
              100000,
              5,
              10000000,
              50,
            ],
            "circle-stroke-width": 1,
            "circle-stroke-color": "red",
          },
        },
        {
          filter: ["==", ["get", "type"], "bar"],
          type: "circle",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "users"],
              100000,
              5,
              10000000,
              50,
            ],
            "circle-stroke-width": 1,
            "circle-stroke-color": "blue",
          },
        },
      ],
    };
    const output = pluckBubblePanels(context);
    expect(output.length).toBe(2);
    expect(output[0].filters.length).toBe(1);
    expect(output[1].filters.length).toBe(1);
    expect(output[0].panel.label).toBe("population");
    expect(output[1].panel.label).toBe("users");
    const population = output[0].panel;
    expect(population.stops[0].stroke).toBe("red");
    const users = output[1].panel;
    expect(users.stops[0].stroke).toBe("blue");
  });

  test("Multiple bubble charts for different facets (case)", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-radius": [
              "case",
              ["has", "population"],
              [
                "interpolate",
                ["linear"],
                ["get", "population"],
                100000,
                5,
                10000000,
                50,
              ],
              [
                "interpolate",
                ["linear"],
                ["get", "users"],
                100000,
                5,
                10000000,
                50,
              ],
            ],
            "circle-stroke-width": 1,
          },
        },
      ],
    };
    const output = pluckBubblePanels(context);
    expect(output.length).toBe(2);
    expect(output[0].filters.length).toBe(1);
    expect(output[1].filters.length).toBe(0);
    expect(output[0].panel.label).toBe("population");
    expect(output[1].panel.label).toBe("users");
    expect(context.layers.length).toBe(0);
  });

  test("Different facets with matching stroke facets", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-radius": [
              "case",
              ["has", "population"],
              [
                "interpolate",
                ["linear"],
                ["get", "population"],
                100000,
                5,
                10000000,
                50,
              ],
              [
                "interpolate",
                ["linear"],
                ["get", "users"],
                100000,
                5,
                10000000,
                50,
              ],
            ],
            "circle-stroke-color": [
              "case",
              ["has", "population"],
              "red",
              "black",
            ],
            "circle-stroke-width": 1,
          },
        },
      ],
    };
    const output = pluckBubblePanels(context);
    expect(output.length).toBe(2);
    expect(output[0].filters.length).toBe(1);
    expect(output[1].filters.length).toBe(0);
    const population = output[0].panel;
    expect(population.label).toBe("population");
    expect(population.stops[0].stroke).toBe("red");
    const users = output[1].panel;
    expect(users.label).toBe("users");
    expect(users.stops[0].stroke).toBe("black");
    expect(context.layers.length).toBe(0);
  });

  test("Different facets with non-matching stroke facets", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-radius": [
              "case",
              ["has", "population"],
              [
                "interpolate",
                ["linear"],
                ["get", "population"],
                100000,
                5,
                10000000,
                50,
              ],
              [
                "interpolate",
                ["linear"],
                ["get", "users"],
                100000,
                5,
                10000000,
                50,
              ],
            ],
            "circle-stroke-color": [
              "case",
              ["==", ["get", "type"], "foo"],
              "red",
              "black",
            ],
            "circle-stroke-width": 1,
          },
        },
      ],
    };
    const output = pluckBubblePanels(context);
    expect(output.length).toBe(2);
    expect(output[0].filters.length).toBe(1);
    expect(output[1].filters.length).toBe(0);
    const population = output[0].panel;
    expect(population.label).toBe("population");
    expect(population.stops[0].stroke).toBe("black");
    const users = output[1].panel;
    expect(users.label).toBe("users");
    expect(users.stops[0].stroke).toBe("black");
    expect(context.layers.length).toBe(1);
    const remainingLayer = context.layers[0];
    expect(remainingLayer.paint).toEqual({
      "circle-stroke-width": 1,
      "circle-stroke-color": [
        "case",
        ["==", ["get", "type"], "foo"],
        "red",
        "black",
      ],
      "circle-radius": null,
    });
  });
});

describe("heatmaps", () => {
  test("Simple heatmap", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "heatmap",
          paint: {},
        },
      ],
    };
    const output = pluckHeatmapPanels(context);
    expect(output.length).toBe(1);
    const { filters, panel } = output[0];
  });

  test("2 Heatmaps filtered by type", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          filter: ["==", ["get", "type"], "foo"],
          type: "heatmap",
          paint: {},
        },
        {
          filter: ["==", ["get", "type"], "bar"],
          type: "heatmap",
          paint: {
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(33,102,172,0)",
              0.2,
              "rgb(103,169,207)",
              0.4,
              "rgb(209,229,240)",
              0.6,
              "rgb(253,219,199)",
              0.8,
              "rgb(239,138,98)",
              1,
              "rgb(178,24,43)",
            ],
          },
        },
      ],
    };
    const output = pluckHeatmapPanels(context);
    expect(output.length).toBe(2);
    expect(output[0].filters.length).toBe(1);
    expect(output[1].filters.length).toBe(1);
    const foo = output[0];
    const bar = output[1];
    expect(foo.filters[0]).toEqual(["==", ["get", "type"], "foo"]);
    expect(foo.panel.stops[0].color).toBe("rgba(0, 0, 255, 0)");
    expect(bar.panel.stops[0].color).toBe("rgba(33,102,172,0)");
  });

  test("2 different heatmaps controlled by case statement", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "heatmap",
          paint: {
            "heatmap-color": [
              "case",
              ["==", ["get", "type"], "foo"],
              [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(33,102,172,0)",
                0.2,
                "rgb(103,169,207)",
                0.4,
                "rgb(209,229,240)",
                0.6,
                "rgb(253,219,199)",
                0.8,
                "rgb(239,138,98)",
                1,
                "rgb(178,24,43)",
              ],
              [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(0, 0, 255, 0)",
                0.1,
                "royalblue",
                0.3,
                "cyan",
                0.5,
                "lime",
                0.7,
                "yellow",
                1,
                "red",
              ],
            ],
          },
        },
      ],
    };
    const output = pluckHeatmapPanels(context);
    expect(output.length).toBe(2);
    expect(output[0].filters.length).toBe(1);
    expect(output[1].filters.length).toBe(0);
    const foo = output[0];
    const bar = output[1];
    expect(foo.filters[0]).toEqual(["==", ["get", "type"], "foo"]);
    expect(foo.panel.stops[0].color).toBe("rgba(33,102,172,0)");
    expect(bar.panel.stops[0].color).toBe("rgba(0, 0, 255, 0)");
  });
});

describe("Gradient panels", () => {
  test("Simple gradient panel", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "pop_max"],
              10000,
              "red",
              100000,
              "purple",
              3500000,
              "yellow",
            ],
            "circle-radius": 5,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.5,
          },
        },
        {
          type: "symbol",
          paint: {
            "text-halo-color": "white",
            "text-halo-width": 1,
          },
          layout: {
            "text-size": 12,
            "text-field": ["get", "name"],
            "text-anchor": "left",
            "text-offset": [0.5, 0.5],
            "symbol-placement": "point",
          },
        },
      ],
    };
    const output = pluckGradientPanels(context);
    expect(output.length).toBe(1);
    const stops = output[0].panel.stops;
    expect(stops[0].color).toBe("red");
    expect(stops[2].color).toBe("yellow");
    expect(output[0].filters.length).toBe(0);
    // gradient-related layer should be removed since it's been fully
    // represented
    expect(context.layers.length).toBe(1);
  });

  test("Gradient panel with unrelated expression", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "pop_max"],
              10000,
              "red",
              100000,
              "purple",
              3500000,
              "yellow",
            ],
            "circle-radius": 5,
            "circle-stroke-color": [
              "match",
              ["get", "featurecla"],
              "Admin-0 capital",
              "red",
              "Scientific station",
              "#bab0ab",
              "black",
            ],
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.5,
          },
        },
        {
          type: "symbol",
          paint: {
            "text-halo-color": "white",
            "text-halo-width": 1,
          },
          layout: {
            "text-size": 12,
            "text-field": ["get", "name"],
            "text-anchor": "left",
            "text-offset": [0.5, 0.5],
            "symbol-placement": "point",
          },
        },
      ],
    };
    const output = pluckGradientPanels(context);
    expect(output.length).toBe(1);
    const stops = output[0].panel.stops;
    expect(stops[0].color).toBe("red");
    expect(stops[2].color).toBe("yellow");
    expect(output[0].filters.length).toBe(0);
    // layer should not be removed since there are unrelated expressions present
    expect(context.layers.length).toBe(2);
  });

  test("Multiple gradients depending on filter", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          filter: ["==", ["get", "type"], "foo"],
          type: "circle",
          paint: {
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "pop_max"],
              10000,
              "red",
              100000,
              "purple",
              3500000,
              "yellow",
            ],
            "circle-radius": 5,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.5,
          },
        },
        {
          filter: ["==", ["get", "type"], "bar"],
          type: "circle",
          paint: {
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "users"],
              10000,
              "yellow",
              100000,
              "purple",
            ],
            "circle-radius": 5,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.5,
          },
        },
      ],
    };
    const output = pluckGradientPanels(context);
    expect(output.length).toBe(2);
    const [foo, bar] = output;
    expect(foo.panel.stops.map((s) => s.color)).toEqual([
      "red",
      "purple",
      "yellow",
    ]);
    expect(foo.filters.length).toBe(1);
    expect(bar.filters.length).toBe(1);
    expect(bar.panel.stops.map((s) => s.color)).toEqual(["yellow", "purple"]);
    // gradient-related layer should be removed since it's been fully
    // represented
    expect(context.layers.length).toBe(0);
  });

  test("Multiple gradients depending on case", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "type"], "foo"],
              [
                "interpolate",
                ["linear"],
                ["get", "pop_max"],
                10000,
                "red",
                100000,
                "purple",
                3500000,
                "yellow",
              ],
              [
                "interpolate",
                ["linear"],
                ["get", "users"],
                10000,
                "yellow",
                100000,
                "purple",
              ],
            ],
            "circle-radius": 5,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.5,
          },
        },
      ],
    };
    const output = pluckGradientPanels(context);
    expect(output.length).toBe(2);
    const [foo, bar] = output;
    expect(foo.panel.stops.map((s) => s.color)).toEqual([
      "red",
      "purple",
      "yellow",
    ]);
    expect(foo.filters.length).toBe(1);
    expect(bar.panel.stops.map((s) => s.color)).toEqual(["yellow", "purple"]);
    expect(bar.filters.length).toBe(0);
    // gradient-related layer should be removed since it's been fully
    // represented
    expect(context.layers.length).toBe(0);
  });

  test("Multiple gradients (case) with unrelated stroke expression", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "type"], "foo"],
              [
                "interpolate",
                ["linear"],
                ["get", "pop_max"],
                10000,
                "red",
                100000,
                "purple",
                3500000,
                "yellow",
              ],
              [
                "interpolate",
                ["linear"],
                ["get", "users"],
                10000,
                "yellow",
                100000,
                "purple",
              ],
            ],
            "circle-radius": 5,
            "circle-stroke-width": [
              "case",
              [">", ["get", "pop_max"], 100000],
              5,
              2,
            ],
            "circle-stroke-opacity": 0.5,
          },
        },
      ],
    };
    const output = pluckGradientPanels(context);
    expect(output.length).toBe(2);
    // gradient-related layer should be removed since it's been fully
    // represented
    expect(context.layers.length).toBe(1);
    // @ts-ignore
    expect(context.layers[0].paint["circle-color"]).toBe(null);
    // @ts-ignore
    expect(context.layers[0].paint["circle-stroke-width"]).toEqual([
      "case",
      [">", ["get", "pop_max"], 100000],
      5,
      2,
    ]);
  });
});

describe("Step panels", () => {
  test("Simple step panel", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "line",
          paint: {
            "line-color": [
              "step",
              ["get", "pop_max"],
              "red",
              100000,
              "purple",
              3500000,
              "yellow",
            ],
            "line-width": 2,
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": [
              "step",
              ["get", "pop_max"],
              "red",
              100000,
              "purple",
              3500000,
              "yellow",
            ],
          },
        },
      ],
    };
    const output = pluckStepPanels(context);
    expect(output.length).toBe(1);
    const steps = output[0].panel.steps;
    expect(steps[0].symbol.type).toBe("fill");
    const firstSymbol = steps[0].symbol as GLLegendFillSymbol;
    const symbols = steps.map((s) => s.symbol as GLLegendFillSymbol);
    expect(symbols[0].color).toBe("red");
    expect(symbols[0].strokeColor).toBe("red");
    expect(symbols[1].color).toBe("purple");
    expect(symbols[1].strokeColor).toBe("purple");
    expect(symbols[2].color).toBe("yellow");
    expect(symbols[2].strokeColor).toBe("yellow");
    expect(symbols[0].strokeWidth).toBe(2);
    // step layer should be removed since it's been fully
    // represented
    expect(context.layers.length).toBe(0);
  });

  test("Two step panels with different filters", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          filter: ["==", ["get", "type"], "foo"],
          type: "line",
          paint: {
            "line-color": [
              "step",
              ["get", "pop_max"],
              "red",
              100000,
              "purple",
              3500000,
              "yellow",
            ],
            "line-width": 2,
          },
        },
        {
          filter: ["==", ["get", "type"], "foo"],
          type: "fill",
          paint: {
            "fill-color": [
              "step",
              ["get", "pop_max"],
              "red",
              100000,
              "purple",
              3500000,
              "yellow",
            ],
          },
        },
        {
          filter: ["==", ["get", "type"], "bar"],
          type: "line",
          paint: {
            "line-color": ["step", ["get", "pop_max"], "pink", 3500000, "blue"],
            "line-width": 2,
          },
        },
        {
          filter: ["==", ["get", "type"], "bar"],
          type: "fill",
          paint: {
            "fill-color": ["step", ["get", "pop_max"], "pink", 3500000, "blue"],
          },
        },
      ],
    };
    const output = pluckStepPanels(context);
    expect(output.length).toBe(2);
    const [foo, bar] = output;
    expect(foo.filters.length).toBe(1);
    expect(bar.filters.length).toBe(1);
    expect(bar.filters[0][2]).toBe("bar");
    const fooSymbols = foo.panel.steps.map(
      (s) => s.symbol as GLLegendFillSymbol
    );
    expect(fooSymbols[0].color).toBe("red");
    expect(fooSymbols[1].color).toBe("purple");
    expect(fooSymbols[2].color).toBe("yellow");
    const barSymbols = bar.panel.steps.map(
      (s) => s.symbol as GLLegendFillSymbol
    );
    expect(barSymbols[0].color).toBe("pink");
    expect(barSymbols[1].color).toBe("blue");
    // step layers should be removed since it's been fully represented
    expect(context.layers.length).toBe(0);
  });

  test("Two step panels with different case statements", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "line",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "type"], "foo"],
              [
                "step",
                ["get", "pop_max"],
                "red",
                100000,
                "purple",
                3500000,
                "yellow",
              ],
              ["step", ["get", "pop_max"], "pink", 3500000, "blue"],
            ],
            "line-width": 2,
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": [
              "case",
              ["==", ["get", "type"], "foo"],
              [
                "step",
                ["get", "pop_max"],
                "red",
                100000,
                "purple",
                3500000,
                "yellow",
              ],
              ["step", ["get", "pop_max"], "pink", 3500000, "blue"],
            ],
          },
        },
      ],
    };
    const output = pluckStepPanels(context);
    expect(output.length).toBe(2);
    const [foo, bar] = output;
    expect(foo.filters.length).toBe(1);
    expect(bar.filters.length).toBe(0);
    expect(foo.filters[0][2]).toBe("foo");
    const fooSymbols = foo.panel.steps.map(
      (s) => s.symbol as GLLegendFillSymbol
    );
    expect(fooSymbols[0].color).toBe("red");
    expect(fooSymbols[1].color).toBe("purple");
    expect(fooSymbols[2].color).toBe("yellow");
    const barSymbols = bar.panel.steps.map(
      (s) => s.symbol as GLLegendFillSymbol
    );
    expect(barSymbols[0].color).toBe("pink");
    expect(barSymbols[1].color).toBe("blue");
    // step layers should be removed since it's been fully represented
    expect(context.layers.length).toBe(0);
  });

  test("Two step properties in one layer", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "line",
          paint: {
            "line-color": [
              "step",
              ["get", "users"],
              "red",
              100000,
              "purple",
              3500000,
              "yellow",
            ],
            "line-width": 2,
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": [
              "step",
              ["get", "pop_max"],
              "red",
              100000,
              "purple",
              3500000,
              "yellow",
            ],
          },
        },
      ],
    };
    const output = pluckStepPanels(context);
    expect(output.length).toBe(2);
    const [fillStep, lineStep] = output;
    const fillSymbols = fillStep.panel.steps.map(
      (step) => step.symbol as GLLegendFillSymbol
    );
    expect(fillSymbols[0].color).toBe("red");
    expect(fillSymbols[1].color).toBe("purple");
    expect(fillSymbols[0].strokeColor).toBe("red");
    expect(context.layers.length).toBe(0);
  });
});
