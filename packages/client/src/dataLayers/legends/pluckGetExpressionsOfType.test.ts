import { pluckGetExpressionsOfType } from "./utils";

test("no expression present", () => {
  // looking for interpolation of circle-radius
  const output = pluckGetExpressionsOfType(5, "interpolate");
  expect(output.facets.length).toBe(0);
  expect(output.remainingValues).toBe(5);
});

test("single get expression present", () => {
  // looking for interpolation of circle-radius
  const output = pluckGetExpressionsOfType(
    ["interpolate", ["linear"], ["get", "population"], 0, 200, 0, 20],
    "interpolate"
  );
  expect(output.facets.length).toBe(1);
  const facet = output.facets[0];
  expect(facet.expression[0]).toBe("interpolate");
  expect(facet.filters.length).toBe(0);
});

test("single non-get expression present", () => {
  // looking for interpolation of circle-radius
  const output = pluckGetExpressionsOfType(
    ["interpolate", ["linear"], ["zoom"], 0, 5, 16, 10],
    "interpolate"
  );
  expect(output.facets.length).toBe(0);
});

test("multiple get expressions conditional to a case statement", () => {
  const expression = [
    "case",
    ["==", ["get", "foo"], "bar"],
    ["interpolate", ["linear"], ["get", "population"], 1, 0, 5, 200_000],
    ["interpolate", ["linear"], ["get", "population"], 10, 0, 20, 200_000],
  ];
  const output = pluckGetExpressionsOfType(expression, "interpolate");
  expect(output.facets.length).toBe(2);
  expect(output.facets[0].filters.length).toBe(1);
  // fallback does not get a filter, but this behavior may change in the future
  expect(output.facets[1].filters.length).toBe(0);
});

test("multiple get expressions conditional to a case statement with a fallback remaining value", () => {
  const expression = [
    "case",
    ["==", ["get", "foo"], "bar"],
    ["interpolate", ["linear"], ["get", "population"], 1, 0, 5, 200_000],
    ["==", ["get", "foo"], "baz"],
    ["interpolate", ["linear"], ["get", "population"], 10, 0, 20, 200_000],
    5,
  ];
  const output = pluckGetExpressionsOfType(expression, "interpolate");
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
  const output = pluckGetExpressionsOfType(expression, "interpolate");
  expect(output.facets.length).toBe(1);
  expect(output.facets[0].filters.length).toBe(0);
  expect(output.remainingValues).toEqual([
    "case",
    ["==", ["get", "foo"], "bar"],
    12,
    // Notice the fallback is set to null, indicating a fallback value should
    // not be represented in an subsequent list panels
    null,
  ]);
});
