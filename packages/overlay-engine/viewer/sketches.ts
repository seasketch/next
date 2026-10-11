import { readFileSync } from "fs";
import { join } from "path";
import { Feature, Polygon, Position } from "geojson";

function square(
  name: string,
  lng: number,
  lat: number,
  delta = 0.03,
): Feature<Polygon> {
  const ring: Position[] = [
    [lng - delta, lat - delta],
    [lng + delta, lat - delta],
    [lng + delta, lat + delta],
    [lng - delta, lat + delta],
    [lng - delta, lat - delta],
  ];
  return {
    type: "Feature",
    properties: { name },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

const portTest = JSON.parse(
  readFileSync(
    join(__dirname, "../__tests__/water-path/sketches/port-test.geojson.json"),
    "utf8",
  ),
) as Feature;

/** The eighteen starts the ocean-bitmap viewer and the fixture tests share. */
export const waterPathSketches: Record<string, Feature> = {
  "port-test": {
    ...portTest,
    properties: { ...(portTest.properties ?? {}), name: "port-test" },
  },
  "west-of-dateline": square("west-of-dateline", 179.2, -17.15),
  "east-of-dateline": square("east-of-dateline", -179.85, -16.75),
  "straddle-antimeridian": square("straddle-antimeridian", 180, -17.05, 0.08),
  "natewa-bay": square("natewa-bay", 179.72, -16.58, 0.02),
  wallis: square("wallis", -176.3, -13.5, 0.04),
  "gull-island": {
    type: "Feature",
    properties: { name: "gull-island" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-119.84345985838848, 33.9536708361406],
          [-119.81547511262983, 33.9536708361406],
          [-119.81547511262983, 33.938194061214645],
          [-119.84345985838848, 33.938194061214645],
          [-119.84345985838848, 33.9536708361406],
        ],
      ],
    },
  },
  "golden-gate": square("golden-gate", -122.58, 37.82, 0.02),
  "cape-cod-bay": square("cape-cod-bay", -70.42, 41.82, 0.03),
  "bogue-banks": square("bogue-banks", -76.78, 34.48, 0.025),
  "hood-canal": square("hood-canal", -122.97, 47.55, 0.012),
  tofino: square("tofino", -126.15, 49.12, 0.03),
  bosphorus: square("bosphorus", 29.18, 41.32, 0.025),
  "sydney-heads": square("sydney-heads", 151.42, -33.84, 0.025),
  "beagle-channel": square("beagle-channel", -67.95, -54.88, 0.012),
  "mississippi-delta": square("mississippi-delta", -89.25, 28.95, 0.03),
  "aleutian-dateline": square("aleutian-dateline", -179.5, 51.7, 0.04),
  "monterey-coast": square("monterey-coast", -121.97, 36.52, 0.03),
};
