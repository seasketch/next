import {
  GLLegendCircleSymbol,
  GLLegendFillSymbol,
  GLLegendListPanel,
  MultipleSymbolLegendForGLLayers,
} from "./LegendDataModel";
import {
  compileLegendFromGLStyleLayers2,
  pluckBubblePanels,
  pluckFilterPanels,
  pluckGradientPanels,
  pluckHeatmapPanels,
  pluckListPanels,
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

describe("List panels", () => {
  test("Simple list panel based on match", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-color": [
              "match",
              ["get", "type"],
              "foo",
              "purple",
              "bar",
              "green",
              "black",
            ],
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.5,
          },
        },
      ],
    };
    const output = pluckListPanels(context);
    expect(output.length).toBe(1);
    const list = output[0];
    expect(list.filters.length).toBe(0);
    expect(list.panel.label).toBe("type");
    const symbols = list.panel.items.map(
      (i) => i.symbol as GLLegendCircleSymbol
    );
    expect(symbols[0].radius).toBe(6);
    expect(symbols[0].color).toBe("purple");
    expect(symbols[1].color).toBe("green");
    expect(symbols[2].color).toBe("black");
    expect(list.panel.items[0].label).toBe("foo");
    expect(list.panel.items[1].label).toBe("bar");
    expect(list.panel.items[2].label).toBe("default");
    expect(context.layers.length).toBe(0);
  });

  test("Simple list panel based on case", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "type"], "foo"],
              "purple",
              ["==", ["get", "type"], "bar"],
              "green",
              "black",
            ],
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.5,
          },
        },
      ],
    };
    const output = pluckListPanels(context);
    expect(output.length).toBe(1);
    const list = output[0];
    expect(list.filters.length).toBe(0);
    expect(list.panel.label).toBe("type");
    const symbols = list.panel.items.map(
      (i) => i.symbol as GLLegendCircleSymbol
    );
    expect(symbols[0].radius).toBe(6);
    expect(symbols[0].color).toBe("purple");
    expect(symbols[1].color).toBe("green");
    expect(symbols[2].color).toBe("black");
    expect(list.panel.items[0].label).toBe("foo");
    expect(list.panel.items[1].label).toBe("bar");
    expect(list.panel.items[2].label).toBe("default");
    expect(context.layers.length).toBe(0);
  });

  test("Combined match and case expressions to form list of fill symbols", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-color": [
              "case",
              ["!=", ["get", "state"], "California"],
              [
                "match",
                ["get", "type"],
                "foo",
                "purple",
                "bar",
                "green",
                "black",
              ],
              "red",
            ],
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.5,
          },
        },
      ],
    };
    const output = pluckListPanels(context);
    expect(output.length).toBe(1);
    const list = output[0];
    expect(list.filters.length).toBe(1);
    expect(list.panel.label).toBe("type");
    const symbols = list.panel.items.map(
      (i) => i.symbol as GLLegendCircleSymbol
    );
    expect(symbols[0].radius).toBe(6);
    expect(symbols[0].color).toBe("purple");
    expect(symbols[1].color).toBe("green");
    expect(symbols[2].color).toBe("black");
    expect(list.panel.items[0].label).toBe("foo");
    expect(list.panel.items[1].label).toBe("bar");
    expect(list.panel.items[2].label).toBe("default");
    // == California style should fall through
    expect(context.layers.length).toBe(1);
  });

  test("Previous state filter with reversed order of expressions", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          paint: {
            "circle-color": [
              "case",
              ["==", ["get", "state"], "California"],
              "red",
              [
                "match",
                ["get", "type"],
                "foo",
                "purple",
                "bar",
                "green",
                "black",
              ],
            ],
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.5,
          },
        },
      ],
    };
    const output = pluckListPanels(context);
    expect(output.length).toBe(2);
    const caPanel = output.find((p) => p.panel.label === "state")!;
    const typePanel = output.find((o) => o !== caPanel)!;
    // TODO: this might change?
    expect(caPanel.filters.length).toBe(0);
    expect(typePanel.filters.length).toBe(0);
    expect(typePanel.panel.label).toBe("type");
    const symbols = typePanel.panel.items.map(
      (i) => i.symbol as GLLegendCircleSymbol
    );
    expect(symbols[0].radius).toBe(6);
    expect(symbols[0].color).toBe("purple");
    expect(symbols[1].color).toBe("green");
    expect(symbols[2].color).toBe("black");
    expect(typePanel.panel.items[0].label).toBe("foo");
    expect(typePanel.panel.items[1].label).toBe("bar");
    expect(typePanel.panel.items[2].label).toBe("default");
    expect(context.layers.length).toBe(0);
  });

  test.todo("Mis-matched case and fill expressions");

  test("Nested under filter", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "circle",
          filter: ["==", ["get", "state"], "California"],
          paint: {
            "circle-color": [
              "match",
              ["get", "type"],
              "foo",
              "purple",
              "bar",
              "green",
              "black",
            ],
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.5,
          },
        },
      ],
    };
    const output = pluckListPanels(context);
    expect(output.length).toBe(1);
    const list = output[0];
    expect(list.filters.length).toBe(1);
    expect(list.panel.label).toBe("type");
    const symbols = list.panel.items.map(
      (i) => i.symbol as GLLegendCircleSymbol
    );
    expect(symbols[0].radius).toBe(6);
    expect(symbols[0].color).toBe("purple");
    expect(symbols[1].color).toBe("green");
    expect(symbols[2].color).toBe("black");
    expect(list.panel.items[0].label).toBe("foo");
    expect(list.panel.items[1].label).toBe("bar");
    expect(list.panel.items[2].label).toBe("default");
    // == California style should fall through
    expect(context.layers.length).toBe(0);
  });

  test.todo("Mis-matched case+match and unrelated expression");
  test.todo("Case expression with mixed get expressions");
  test.todo("Case expression with 'all' expression");
  test.todo("Case expression with 'any' expression");
});

describe("filter panels", () => {
  test("Numeric filters creating a choropleth", () => {
    const context: { layers: SeaSketchGlLayer[] } = {
      layers: [
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(49,163,84,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 145993.6237613576],
            ["<=", "EmpArts", 290160],
          ],
          metadata: {
            label: "145,995 to 290,160",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(49,163,84,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 73652.57252191499],
            ["<=", "EmpArts", 145993.6237613576],
          ],
          metadata: {
            label: "37,354 to 145,994",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(116,196,118,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 37352.65411538615],
            ["<=", "EmpArts", 73652.57252191499],
          ],
          metadata: {
            label: "37,354 to 73,653",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(186,228,179,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 19137.767080371515],
            ["<=", "EmpArts", 37352.65411538615],
          ],
          metadata: {
            label: "19,138 to 37,353",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(186,228,179,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 9997.743513853795],
            ["<=", "EmpArts", 19137.767080371515],
          ],
          metadata: {
            label: "9,999 to 19,138",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(237,248,233,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 5411.383431800605],
            ["<=", "EmpArts", 9997.743513853795],
          ],
          metadata: {
            label: "5,412 to 9,998",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(237,248,233,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: ["all", ["<=", "EmpArts", 5411.383431800605]],
          metadata: {
            label: "3,110 to 5,411",
          },
        },
      ],
    };
    const output = pluckFilterPanels(context);
    expect(output.length).toBe(7);
    expect(output[0].filters.length).toBe(1);
    expect(output[0].filters[0]).toEqual([
      "all",
      [">", "EmpArts", 145993.6237613576],
      ["<=", "EmpArts", 290160],
    ]);
    expect(output[0].panel.items.length).toBe(1);
    expect(output[0].panel.items[0].label).toBe("145,995 to 290,160");
    expect(output[0].panel.label).toBe("EmpArts");
  });
});

describe("Kitchen sink examples", () => {
  test.skip("Choropleth with california singled-out", () => {
    const context: { layers: SeaSketchGlLayer[]; sourceType: "vector" } = {
      sourceType: "vector",
      layers: [
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(49,163,84,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 145993.6237613576],
            ["<=", "EmpArts", 290160],
            ["!=", "NAME", "California"],
          ],
          metadata: {
            label: "145,995 to 290,160",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(49,163,84,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 73652.57252191499],
            ["<=", "EmpArts", 145993.6237613576],
            ["!=", "NAME", "California"],
          ],
          metadata: {
            label: "37,354 to 145,994",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(116,196,118,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 37352.65411538615],
            ["<=", "EmpArts", 73652.57252191499],
            ["!=", "NAME", "California"],
          ],
          metadata: {
            label: "37,354 to 73,653",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(186,228,179,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 19137.767080371515],
            ["<=", "EmpArts", 37352.65411538615],
            ["!=", "NAME", "California"],
          ],
          metadata: {
            label: "19,138 to 37,353",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(186,228,179,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 9997.743513853795],
            ["<=", "EmpArts", 19137.767080371515],
            ["!=", "NAME", "California"],
          ],
          metadata: {
            label: "9,999 to 19,138",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(237,248,233,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            [">", "EmpArts", 5411.383431800605],
            ["<=", "EmpArts", 9997.743513853795],
            ["!=", "NAME", "California"],
          ],
          metadata: {
            label: "5,412 to 9,998",
          },
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(237,248,233,1)",
            "fill-outline-color": "rgba(0,0,0,1)",
          },
          filter: [
            "all",
            ["<=", "EmpArts", 5411.383431800605],
            ["!=", "NAME", "California"],
          ],
          metadata: {
            label: "3,110 to 5,411",
          },
        },
        {
          type: "line",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "SUB_REGION"], "Pacific"],
              "blue",
              "rgba(0,0,0,0.2)",
            ],
          },
        },
        {
          type: "line",
          paint: {
            "line-color": "red",
          },
          filter: ["==", ["get", "NAME"], "California"],
        },
        {
          type: "fill",
          paint: {
            "fill-color": "#9c755f",
            "fill-opacity": 0.5,
          },
          filter: ["==", "NAME", "California"],
        },
        {
          type: "symbol",
          layout: {
            "icon-image": [
              "match",
              ["get", "NAME"],
              "California",
              "seasketch://sprites/1",
              "seasketch://sprites/2",
            ],
          },
        },
      ],
    };

    const legend = compileLegendFromGLStyleLayers2(context.layers, "vector");
    expect(legend.type).toBe("MultipleSymbolGLLegend");
    if (legend.type === "MultipleSymbolGLLegend") {
      expect(legend.panels.length).toBe(3);
    }
  });

  test.only("EEZ with complex expressions", () => {
    const legend = compileLegendFromGLStyleLayers2(
      [
        {
          type: "fill",
          paint: {
            "fill-color": "#FF0000",
            "fill-opacity": [
              "case",
              ["==", ["get", "ISO_SOV1"], "MEX"],
              0.15,
              0,
            ],
          },
          layout: {},
        },
        {
          type: "line",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "ISO_SOV1"], "USA"],
              "#FF0000",
              "blue",
            ],
            "line-width": ["case", ["==", ["get", "ISO_SOV1"], "MEX"], 4, 1],
            "line-opacity": 0.75,
          },
          layout: {
            "line-cap": "round",
            "line-join": "round",
            visibility: "visible",
          },
        },
      ],
      "vector"
    ) as MultipleSymbolLegendForGLLayers;
    expect(legend.type).toBe("MultipleSymbolGLLegend");
    expect(legend.panels.length).toBe(1);
    const list = legend.panels[0] as GLLegendListPanel;
    expect(list.type).toBe("GLLegendListPanel");
    expect(list.items.find((l) => l.label === "USA")).toBeDefined();
    expect(list.items.find((l) => l.label === "MEX")).toBeDefined();
    expect(list.items.find((l) => l.label === "default")).toBeDefined();
  });

  test("EEZ with complex case+match expressions", () => {
    const legend = compileLegendFromGLStyleLayers2(
      [
        {
          type: "fill",
          paint: {
            "fill-color": "#FF0000",
            "fill-opacity": [
              "case",
              ["==", ["get", "ISO_SOV1"], "MEX"],
              0.15,
              0,
            ],
          },
          layout: {},
        },
        {
          type: "line",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "ISO_SOV1"], "USA"],
              "#FF0000",
              "blue",
            ],
            "line-width": ["match", ["get", "ISO_SOV1"], "MEX", 4, 1],
            "line-opacity": 0.75,
          },
          layout: {
            "line-cap": "round",
            "line-join": "round",
            visibility: "visible",
          },
        },
      ],
      "vector"
    ) as MultipleSymbolLegendForGLLayers;
    expect(legend.type).toBe("MultipleSymbolGLLegend");
    expect(legend.panels.length).toBe(1);
    const list = legend.panels[0] as GLLegendListPanel;
    expect(list.type).toBe("GLLegendListPanel");
    expect(list.items.find((l) => l.label === "USA")).toBeDefined();
    expect(list.items.find((l) => l.label === "MEX")).toBeDefined();
    expect(list.items.find((l) => l.label === "default")).toBeDefined();
  });

  test.skip("EEZ w/filter by country and default style", () => {
    const legend = compileLegendFromGLStyleLayers2(
      [
        {
          type: "line",
          paint: {
            "line-color": "rgb(110,110,110)",
            "line-width": 1,
            "line-opacity": 1,
          },
          layout: {},
        },
        {
          type: "fill",
          paint: {
            "fill-color": "rgba(252,215,215,1)",
            "fill-outline-color": "rgba(110,110,110,1)",
          },
          filter: ["==", "ISO_SOV1", "USA"],
        },
      ],
      "vector"
    );
    expect(legend.type).toBe("MultipleSymbolGLLegend");
    if (legend.type === "MultipleSymbolGLLegend") {
      expect(legend.panels.length).toBe(1);
      expect(legend.panels[0].type).toBe("GLLegendListPanel");
      const list = legend.panels[0] as GLLegendListPanel;
      expect(list.items.length).toBe(2);
      expect(list.items[0].label).toBe("USA");
      expect(list.items[0].symbol.type).toBe("fill");
      expect(list.items[1].label).toBe("default");
    }
  });
});
