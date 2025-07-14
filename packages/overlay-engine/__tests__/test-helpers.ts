import { Feature } from "geojson";
import * as fs from "fs";
import * as path from "path";

const OUTPUTS_DIR = path.join(__dirname, "outputs");

/**
 * Saves GeoJSON features to a file in the __tests__/outputs directory
 * @param key A unique identifier for this test output
 * @param features The GeoJSON features to save
 */
export function saveOutput(key: string, features: Feature | Feature[]): void {
  // Ensure outputs directory exists
  if (!fs.existsSync(OUTPUTS_DIR)) {
    fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUTS_DIR, `${key}.geojson`);
  const data = Array.isArray(features) ? features : [features];

  fs.writeFileSync(
    outputPath,
    JSON.stringify({ type: "FeatureCollection", features: data }, null, 2)
  );
}

/**
 * Reads GeoJSON features from a file in the __tests__/outputs directory
 * @param key The identifier of the test output to read
 * @returns The GeoJSON features
 */
export function readOutput(key: string): Feature[] {
  const outputPath = path.join(OUTPUTS_DIR, `${key}.geojson`);
  const data = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
  return data.features;
}

function roundCoord(coord: any, precision = 6): any {
  if (Array.isArray(coord)) {
    return coord.map((c) => roundCoord(c, precision));
  } else if (typeof coord === "number") {
    return Number(coord.toFixed(precision));
  }
  return coord;
}

export function normalizeGeometry(geometry: any): any {
  // Recursively round all coordinates and sort arrays for order-independence
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring: any) =>
        roundCoord(ring).sort((a: any, b: any) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b))
        )
      ),
    };
  } else if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates
        .map((poly: any) =>
          poly.map((ring: any) =>
            roundCoord(ring).sort((a: any, b: any) =>
              JSON.stringify(a).localeCompare(JSON.stringify(b))
            )
          )
        )
        .sort((a: any, b: any) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b))
        ),
    };
  }
  return geometry;
}

/**
 * Compares two arrays of fragments in an order-independent way.
 * Verifies that:
 * 1. The number of fragments matches
 * 2. For each fragment in the test output, the reference output contains a feature
 *    with the same __geographyIds value and matching geometry
 * @param testFragments The fragments to test
 * @param referenceFragments The reference fragments to compare against
 * @returns true if the fragments match, false otherwise
 */
export function compareFragments(
  testFragments: Feature[],
  referenceFragments: Feature[]
): boolean {
  if (testFragments.length !== referenceFragments.length) {
    console.log(
      `Fragment count mismatch: test=${testFragments.length}, reference=${referenceFragments.length}`
    );
    return false;
  }

  // Make a copy so we can remove matched fragments
  const refFrags = referenceFragments.slice();

  for (const testFragment of testFragments) {
    const testIds = [...testFragment.properties.__geographyIds]
      .sort()
      .join(",");
    const testGeom = JSON.stringify(normalizeGeometry(testFragment.geometry));
    // Find a matching reference fragment
    const matchIdx = refFrags.findIndex((refFragment) => {
      const refIds = [...refFragment.properties.__geographyIds]
        .sort()
        .join(",");
      const refGeom = JSON.stringify(normalizeGeometry(refFragment.geometry));
      return testIds === refIds && testGeom === refGeom;
    });
    if (matchIdx === -1) {
      console.log(
        `No matching reference fragment found for geography IDs: ${testIds}`
      );
      console.log("Test geometry:", testGeom);
      return false;
    }
    // Remove matched reference fragment
    refFrags.splice(matchIdx, 1);
  }

  // All test fragments matched, and no extra reference fragments
  if (refFrags.length > 0) {
    console.log(`Extra reference fragments not matched: ${refFrags.length}`);
    return false;
  }
  return true;
}
