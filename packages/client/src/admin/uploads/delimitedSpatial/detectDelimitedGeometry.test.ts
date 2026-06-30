import {
  detectDelimitedGeometry,
  processingOptionsFromDetectionResult,
} from "./detectDelimitedGeometry";

test("standard latitude/longitude headers, comma delimited", () => {
  const csv = [
    "name,latitude,longitude",
    "Site A,42.686744,-73.822852",
    "Site B,42.718588,-73.755328",
    "Site C,42.814403,-73.930967",
  ].join("\n");
  const result = detectDelimitedGeometry(csv);
  expect(result.delimiter).toBe(",");
  expect(result.geometryMode).toBe("point_xy");
  expect(result.xField).toBe("longitude");
  expect(result.yField).toBe("latitude");
  expect(result.confidence).toBe("high");
  expect(processingOptionsFromDetectionResult(result)).toEqual({
    kind: "delimited",
    geometryMode: "point_xy",
    xField: "longitude",
    yField: "latitude",
    geometryField: undefined,
    crs: "EPSG:4326",
    delimiter: ",",
    hasHeaderRow: true,
  });
});

test("x/y headers, tab delimited", () => {
  const tsv = [
    "name\tx\ty",
    "Site A\t-73.822852\t42.686744",
    "Site B\t-73.755328\t42.718588",
    "Site C\t-73.930967\t42.814403",
  ].join("\n");
  const result = detectDelimitedGeometry(tsv);
  expect(result.delimiter).toBe("\t");
  expect(result.geometryMode).toBe("point_xy");
  expect(result.xField).toBe("x");
  expect(result.yField).toBe("y");
  expect(result.confidence).toBe("high");
});

test("WKT geometry column", () => {
  const csv = [
    "id,name,wkt",
    '1,Region A,"POLYGON((-122.5 37.7, -122.4 37.7, -122.4 37.8, -122.5 37.8, -122.5 37.7))"',
    '2,Region B,"POLYGON((-122.6 37.6, -122.5 37.6, -122.5 37.7, -122.6 37.7, -122.6 37.6))"',
    '3,Region C,"POLYGON((-122.7 37.5, -122.6 37.5, -122.6 37.6, -122.7 37.6, -122.7 37.5))"',
  ].join("\n");
  const result = detectDelimitedGeometry(csv);
  expect(result.geometryMode).toBe("wkt");
  expect(result.geometryField).toBe("wkt");
  expect(result.confidence).toBe("high");
});

test("ambiguous numeric columns trigger range-heuristic fallback with low confidence", () => {
  const csv = [
    "id,col_a,col_b",
    "1,42.686744,-73.822852",
    "2,42.718588,-73.755328",
    "3,42.814403,-73.930967",
  ].join("\n");
  const result = detectDelimitedGeometry(csv);
  expect(result.geometryMode).toBe("point_xy");
  expect(result.yField).toBe("col_a");
  expect(result.xField).toBe("col_b");
  expect(result.confidence).toBe("low");
  expect(result.warnings.length).toBeGreaterThan(0);
});

test("no detectable geometry columns", () => {
  const csv = [
    "name,description",
    "Site A,some text",
    "Site B,more text",
  ].join("\n");
  const result = detectDelimitedGeometry(csv);
  expect(result.geometryMode).toBeNull();
  expect(result.confidence).toBe("low");
  expect(processingOptionsFromDetectionResult(result)).toBeNull();
});

test("out-of-range coordinates are rejected as non-WGS 84", () => {
  // Latitude values here exceed the valid [-90, 90] range, suggesting the
  // columns may be swapped or the data is not in decimal degrees.
  const csv = [
    "name,latitude,longitude",
    "Site A,142.686744,-73.822852",
    "Site B,142.718588,-73.755328",
    "Site C,142.814403,-73.930967",
  ].join("\n");
  const result = detectDelimitedGeometry(csv);
  expect(result.geometryMode).toBe("point_xy");
  expect(result.error).toMatch(/WGS 84/);
  expect(result.confidence).toBe("low");
  expect(processingOptionsFromDetectionResult(result)).toBeNull();
});

test("semicolon delimited file", () => {
  const csv = [
    "name;lat;lon",
    "Site A;42.686744;-73.822852",
    "Site B;42.718588;-73.755328",
  ].join("\n");
  const result = detectDelimitedGeometry(csv);
  expect(result.delimiter).toBe(";");
  expect(result.geometryMode).toBe("point_xy");
});

test("file with no header row", () => {
  const csv = [
    "42.686744,-73.822852,Site A",
    "42.718588,-73.755328,Site B",
    "42.814403,-73.930967,Site C",
  ].join("\n");
  const result = detectDelimitedGeometry(csv);
  expect(result.hasHeaderRow).toBe(false);
  // Without recognizable headers, detection falls back to the numeric-range
  // heuristic.
  expect(result.geometryMode).toBe("point_xy");
  expect(result.confidence).toBe("low");
});
