import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHART_REGIONS, chartRegion } from "../scripts/regions.js";

function inside(regionId: string, lon: number, lat: number): boolean {
  const [west, south, east, north] = chartRegion(regionId).clip;
  return lon > west && lon < east && lat > south && lat < north;
}

/** Degrees of longitude spanned by `nm` nautical miles at `lat`. */
function longitudeDegrees(nm: number, lat: number): number {
  return nm / (60 * Math.cos((lat * Math.PI) / 180));
}

describe("demo chart regions", () => {
  it("names four regions and rejects an unknown one", () => {
    assert.deepEqual(
      CHART_REGIONS.map((region) => region.id),
      ["channel", "california", "hawaii", "florida-east"]
    );
    assert.equal(chartRegion(undefined).id, "channel");
    assert.equal(chartRegion("FL").id, "florida-east");
    assert.equal(chartRegion("hi").id, "hawaii");
    assert.throws(() => chartRegion("gulf"), /Unknown chart region/);
  });

  it("keeps each clip ordered, with an opening view inside it", () => {
    for (const region of CHART_REGIONS) {
      const [west, south, east, north] = region.clip;
      assert.ok(west < east && south < north, region.id);
      const opening = region.views[0];
      assert.equal(inside(region.id, opening.lon, opening.lat), true, region.id);
    }
  });

  it("carries California out to 200 nautical miles", () => {
    // Cape Mendocino, the westernmost point of the state.
    const capeLon = -124.409;
    const capeLat = 40.44;
    const west = chartRegion("california").clip[0];
    const seaward = (capeLon - west) / longitudeDegrees(1, capeLat);
    assert.ok(seaward >= 200, `only ${seaward.toFixed(1)} nm seaward of Cape Mendocino`);
    assert.equal(inside("california", -117.17, 32.72), true);
    assert.equal(inside("california", -122.42, 37.8), true);
    assert.equal(inside("california", -124.2, 41.75), true);
    assert.equal(inside("california", -119.9, 34.2), true);
  });

  it("covers the main Hawaiian islands and not the northwestern chain", () => {
    assert.equal(inside("hawaii", -157.87, 21.3), true);
    assert.equal(inside("hawaii", -155.07, 19.74), true);
    assert.equal(inside("hawaii", -159.35, 21.96), true);
    assert.equal(inside("hawaii", -160.1, 21.9), true);
    // Nihoa is the first of the Northwestern Hawaiian Islands.
    assert.equal(inside("hawaii", -161.92, 23.06), false);
    assert.equal(inside("hawaii", -177.4, 28.2), false);
  });

  it("covers Florida's Atlantic coast and leaves the Gulf and the Keys out", () => {
    const east = chartRegion("florida-east").clip[2];
    // Highland Beach, about the easternmost point of the coast.
    const seaward = (east - -80.07) / longitudeDegrees(1, 26.4);
    assert.ok(seaward >= 200, `only ${seaward.toFixed(1)} nm seaward of Highland Beach`);
    assert.equal(inside("florida-east", -80.16, 25.77), true);
    assert.equal(inside("florida-east", -80.6, 28.41), true);
    assert.equal(inside("florida-east", -81.45, 30.4), true);
    assert.equal(inside("florida-east", -82.46, 27.95), false);
    assert.equal(inside("florida-east", -81.78, 24.56), false);
  });
});
