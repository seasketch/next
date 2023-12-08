import { pluckGetExpressionsOfType } from "./utils";

test("no expression present", () => {
  // looking for interpolation of circle-radius
  const output = pluckGetExpressionsOfType(5, "interpolate", "color");
  expect(output.facets.length).toBe(0);
  expect(output.remainingValues).toBe(5);
});

test("single get expression present", () => {
  // looking for interpolation of circle-radius
  const output = pluckGetExpressionsOfType(
    ["interpolate", ["linear"], ["get", "population"], 0, 200, 0, 20],
    "interpolate",
    "number"
  );
  expect(output.facets.length).toBe(1);
  const facet = output.facets[0];
  expect(facet.expression[0]).toBe("interpolate");
  expect(facet.filters.length).toBe(0);
  expect(output.remainingValues).toBe(null);
});

test("single non-get expression present", () => {
  // looking for interpolation of circle-radius
  const output = pluckGetExpressionsOfType(
    ["interpolate", ["linear"], ["zoom"], 0, 5, 16, 10],
    "interpolate",
    "number"
  );
  expect(output.facets.length).toBe(0);
  expect(output.remainingValues).toEqual([
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    5,
    16,
    10,
  ]);
});

test("multiple get expressions conditional to a case statement", () => {
  const expression = [
    "case",
    ["==", ["get", "foo"], "bar"],
    ["interpolate", ["linear"], ["get", "population"], 1, 0, 5, 200_000],
    ["interpolate", ["linear"], ["get", "population"], 10, 0, 20, 200_000],
  ];
  const output = pluckGetExpressionsOfType(expression, "interpolate", "number");
  expect(output.facets.length).toBe(2);
  expect(output.facets[0].filters.length).toBe(1);
  // fallback does not get a filter, but this behavior may change in the future
  expect(output.facets[1].filters.length).toBe(0);
  expect(output.remainingValues).toBe(null);
});

test("multiple get expressions conditional to a case statement with a static fallback", () => {
  const expression = [
    "case",
    ["==", ["get", "foo"], "bar"],
    ["interpolate", ["linear"], ["get", "population"], 1, 0, 5, 200_000],
    ["==", ["get", "foo"], "baz"],
    ["interpolate", ["linear"], ["get", "population"], 10, 0, 20, 200_000],
    5,
  ];
  const output = pluckGetExpressionsOfType(expression, "interpolate", "number");
  expect(output.facets.length).toBe(2);
  expect(output.facets[0].filters.length).toBe(1);
  const facet1 = output.facets[0];
  expect(facet1.expression[0]).toBe("interpolate");
  expect(facet1.filters[0][0]).toBe("==");
  expect(facet1.filters[0][1]).toEqual(["get", "foo"]);
  expect(facet1.filters[0][2]).toBe("bar");
  expect(output.facets[1].filters.length).toBe(1);
  expect(output.remainingValues).toBe(5);
});

test("conditional static value falling back to the interpolation of interest", () => {
  const expression = [
    "case",
    ["==", ["get", "foo"], "bar"],
    12,
    ["interpolate", ["linear"], ["get", "population"], 1, 0, 5, 200_000],
  ];
  const output = pluckGetExpressionsOfType(expression, "interpolate", "number");
  expect(output.facets.length).toBe(1);
  expect(output.facets[0].filters.length).toBe(0);
  expect(output.remainingValues).toEqual([
    "case",
    ["==", ["get", "foo"], "bar"],
    12,
    // Notice the fallback is set to null, indicating a fallback value should
    // not be represented in subsequent list panels
    null,
  ]);
});

test("match expression with multiple interpolations", () => {
  const expression = [
    "match",
    ["get", "foo"],
    "bar",
    ["interpolate", ["linear"], ["get", "population"], 1, 0, 5, 200_000],
    "baz",
    ["interpolate", ["linear"], ["get", "population"], 10, 0, 20, 200_000],
    ["interpolate", ["linear"], ["get", "population"], 20, 0, 50, 500_000],
  ];
  const output = pluckGetExpressionsOfType(expression, "interpolate", "number");
  expect(output.facets.length).toBe(3);
  expect(output.facets[0].filters.length).toBe(1);
  expect(output.facets[1].filters.length).toBe(1);
  expect(output.facets[2].filters.length).toBe(0);
});

test("match expression with multiple interpolations and a static fallback", () => {
  const expression = [
    "match",
    ["get", "foo"],
    "bar",
    ["interpolate", ["linear"], ["get", "population"], 1, 0, 5, 200_000],
    "baz",
    ["interpolate", ["linear"], ["get", "population"], 10, 0, 20, 200_000],
    5,
  ];
  const output = pluckGetExpressionsOfType(expression, "interpolate", "number");
  expect(output.facets.length).toBe(2);
  expect(output.facets[0].filters.length).toBe(1);
  expect(output.facets[1].filters.length).toBe(1);
  const facet1 = output.facets[0];
  expect(facet1.filters[0][0]).toBe("==");
  expect(facet1.filters[0][1]).toEqual(["get", "foo"]);
  expect(facet1.filters[0][2]).toEqual("bar");
  expect(output.remainingValues).toBe(5);
});

test("match expression with fallback set to null", () => {
  const expression = [
    "match",
    ["get", "foo"],
    "bar",
    ["interpolate", ["linear"], ["get", "population"], 1, 0, 5, 200_000],
    "baz",
    5,
    ["interpolate", ["linear"], ["get", "population"], 20, 0, 50, 500_000],
  ];
  const output = pluckGetExpressionsOfType(expression, "interpolate", "number");
  expect(output.facets.length).toBe(2);
  expect(output.facets[0].filters.length).toBe(1);
  const facet1 = output.facets[0];
  expect(facet1.filters[0][0]).toBe("==");
  expect(facet1.filters[0][1]).toEqual(["get", "foo"]);
  expect(facet1.filters[0][2]).toBe("bar");
  expect(output.facets[1].filters.length).toBe(0);
  expect(output.remainingValues).toEqual([
    "match",
    ["get", "foo"],
    "baz",
    5,
    null,
  ]);
});

test.only("targetExpressionMustIncludeGet option", () => {
  const expression = [
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
  ];
  const output = pluckGetExpressionsOfType(expression, "interpolate", "color", {
    targetExpressionMustIncludeGet: false,
  });
  expect(output.facets.length).toBe(2);
});
