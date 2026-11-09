import { Feature, MultiPolygon, Polygon, Position } from "geojson";
import area from "@turf/area";
import { afterEach, describe, expect, it } from "vitest";
import { GeographySettings } from "../src/fragments";
import {
  ClippingFn,
  clipSketchToPolygons,
  clipToGeographies,
  clipToGeography,
  setForcePolyclipTs,
} from "../src/geographies/geographies";
import { prepareSketch } from "../src/utils/prepareSketch";
import { unionAtAntimeridian } from "../src/utils/unionAtAntimeridian";

/**
 * United Kingdom waters in miniature. The ring crosses the prime meridian the
 * way the Marine Regions UK EEZ does, and not the antimeridian.
 */
const ukEez: Feature<Polygon> = {
  type: "Feature",
  properties: { UNION: "United Kingdom" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-5, 50],
        [3, 50],
        [3, 59],
        [-5, 59],
        [-5, 50],
      ],
    ],
  },
};

/**
 * Land whose coastline weaves across Greenwich inside the sketch, matching
 * the Humber / Holderness coast that produced issue 959.
 */
const ukLand: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-4, 52],
        [0.05, 53.4],
        [-0.35, 54.15],
        [0.1, 54.85],
        [-4, 56],
        [-4, 52],
      ],
    ],
  },
};

/**
 * Quadrilateral in the same place as the exported "Bad sketch": about
 * 53.7–54.9°N, from just west of Greenwich to about 2.4°E.
 */
const ukSketch: Feature<Polygon> = {
  type: "Feature",
  properties: { name: "Bad sketch" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-0.8, 53.72],
        [2.36, 53.99],
        [1.48, 54.94],
        [-0.45, 54.7],
        [-0.8, 53.72],
      ],
    ],
  },
};

/** Rectangle split in two by a land barrier on the prime meridian. */
const splitSketch: Feature<Polygon> = {
  type: "Feature",
  properties: { name: "Split by land" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-2, 54],
        [2, 54],
        [2, 55],
        [-2, 55],
        [-2, 54],
      ],
    ],
  },
};

const landBarrier: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-0.15, 53],
        [0.15, 53],
        [0.15, 56],
        [-0.15, 56],
        [-0.15, 53],
      ],
    ],
  },
};

const datelineEez: Feature<MultiPolygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [179, -20.5],
          [180, -20.5],
          [180, -18.5],
          [179, -18.5],
          [179, -20.5],
        ],
      ],
      [
        [
          [-180, -20.5],
          [-179, -20.5],
          [-179, -18.5],
          [-180, -18.5],
          [-180, -20.5],
        ],
      ],
    ],
  },
};

const datelineSketch: Feature<Polygon> = {
  type: "Feature",
  properties: { name: "Crosses antimeridian" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [179.2, -19.8],
        [-179.2, -19.8],
        [-179.2, -19.2],
        [179.2, -19.2],
        [179.2, -19.8],
      ],
    ],
  },
};

const ukGeography: GeographySettings[] = [
  {
    id: 1,
    clippingLayers: [
      { source: "eez", op: "INTERSECT" },
      { source: "land", op: "DIFFERENCE" },
    ],
  },
];

function clippingFnFor(
  layers: Record<string, Feature<Polygon | MultiPolygon>[]>
): ClippingFn {
  return async (sketch, source, op) => {
    const features = layers[source] ?? [];
    return clipSketchToPolygons(sketch, op, undefined, iterate(features));
  };
}

async function* iterate(
  features: Feature<Polygon | MultiPolygon>[]
): AsyncGenerator<Feature<Polygon | MultiPolygon>> {
  for (const feature of features) {
    yield feature;
  }
}

function longitudesOf(feature: Feature<Polygon | MultiPolygon>): number[] {
  const polygons =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  const longitudes: number[] = [];
  polygons.forEach((polygon) => {
    polygon.forEach((ring) => {
      ring.forEach(([longitude]) => longitudes.push(longitude));
    });
  });
  return longitudes;
}

function maxLongitudeEdge(coordinates: Position[][][]): number {
  let maxEdge = 0;
  coordinates.forEach((polygon) => {
    polygon.forEach((ring) => {
      for (let index = 1; index < ring.length; index++) {
        maxEdge = Math.max(
          maxEdge,
          Math.abs(ring[index][0] - ring[index - 1][0])
        );
      }
    });
  });
  return maxEdge;
}

describe.each([
  ["polygon-clipping", false],
  ["polyclip-ts", true],
])("UK EEZ clipping with %s", (_label, forcePolyclipTs) => {
  afterEach(() => {
    setForcePolyclipTs(false);
  });

  it("clips a Greenwich sketch to the EEZ minus land without wrapping the globe", async () => {
    setForcePolyclipTs(forcePolyclipTs);
    const prepared = prepareSketch(ukSketch);
    const clip = clippingFnFor({ eez: [ukEez], land: [ukLand] });

    const clipped = await clipToGeography(
      prepared,
      ukGeography[0].clippingLayers,
      clip
    );
    expect(clipped).not.toBeNull();

    const displayed = unionAtAntimeridian(clipped!);
    const longitudes = longitudesOf(displayed);
    expect(Math.min(...longitudes)).toBeGreaterThan(-5);
    expect(Math.max(...longitudes)).toBeLessThan(3);
    expect(maxLongitudeEdge(displayed.geometry.coordinates)).toBeLessThan(5);
    expect(area(displayed)).toBeLessThan(area(ukSketch));
    expect(area(displayed)).toBeGreaterThan(1_000_000);

    const { clipped: stitched, fragments } = await clipToGeographies(
      prepared,
      ukGeography,
      [1],
      [],
      null,
      clip
    );

    expect(stitched).not.toBeNull();
    const stitchedLongitudes = longitudesOf(stitched!);
    expect(Math.min(...stitchedLongitudes)).toBeGreaterThan(-5);
    expect(Math.max(...stitchedLongitudes)).toBeLessThan(3);
    expect(
      maxLongitudeEdge(stitched!.geometry.coordinates)
    ).toBeLessThan(5);
    expect(area(stitched!)).toBeLessThan(area(ukSketch));
    expect(fragments.length).toBeGreaterThan(0);
    for (const fragment of fragments) {
      expect(fragment.geometry.type).toBe("Polygon");
      const fragmentLongitudes = longitudesOf(fragment);
      expect(Math.min(...fragmentLongitudes)).toBeGreaterThan(-180);
      expect(Math.max(...fragmentLongitudes)).toBeLessThan(180);
      expect(
        maxLongitudeEdge([fragment.geometry.coordinates])
      ).toBeLessThan(5);
      expect(fragment.properties.__geographyIds).toEqual([1]);
    }
  });

  it("keeps land-split parts on either side of Greenwich next to each other", async () => {
    setForcePolyclipTs(forcePolyclipTs);
    const prepared = prepareSketch(splitSketch);
    const clip = clippingFnFor({
      eez: [ukEez],
      land: [landBarrier],
    });

    const { clipped, fragments } = await clipToGeographies(
      prepared,
      ukGeography,
      [1],
      [],
      null,
      clip
    );

    expect(clipped).not.toBeNull();
    const longitudes = longitudesOf(clipped!);
    expect(Math.min(...longitudes)).toBeCloseTo(-2, 5);
    expect(Math.max(...longitudes)).toBeCloseTo(2, 5);
    expect(maxLongitudeEdge(clipped!.geometry.coordinates)).toBeLessThan(5);
    expect(clipped!.geometry.coordinates.length).toBe(2);
    expect(fragments.length).toBe(2);
    const fragmentSpans = fragments.map((fragment) => {
      const values = longitudesOf(fragment);
      return [Math.min(...values), Math.max(...values)] as const;
    });
    expect(fragmentSpans.some(([min]) => min < 0)).toBe(true);
    expect(fragmentSpans.some(([, max]) => max > 0)).toBe(true);
    for (const [min, max] of fragmentSpans) {
      expect(max - min).toBeLessThan(5);
      expect(min).toBeGreaterThan(-3);
      expect(max).toBeLessThan(3);
    }
  });
});

describe("antimeridian clipping still stitches", () => {
  it("renders one continuous part past 180 and keeps fragments inside WGS84", async () => {
    const prepared = prepareSketch(datelineSketch);
    expect(prepared.feature.geometry.coordinates.length).toBe(2);

    const clip = clippingFnFor({ eez: [datelineEez] });
    const geography: GeographySettings[] = [
      {
        id: 7,
        clippingLayers: [{ source: "eez", op: "INTERSECT" }],
      },
    ];
    const { clipped, fragments } = await clipToGeographies(
      prepared,
      geography,
      [7],
      [],
      null,
      clip
    );

    expect(clipped).not.toBeNull();
    expect(clipped!.geometry.coordinates).toHaveLength(1);
    const longitudes = longitudesOf(clipped!);
    expect(Math.max(...longitudes) - Math.min(...longitudes)).toBeLessThan(3);
    expect(maxLongitudeEdge(clipped!.geometry.coordinates)).toBeLessThan(3);
    // Display geometry crosses ±180 by continuing past 180, which is what
    // keeps Mapbox from filling the rest of the world.
    expect(Math.max(...longitudes)).toBeGreaterThan(180);
    expect(fragments.length).toBeGreaterThan(0);
    for (const fragment of fragments) {
      const values = longitudesOf(fragment);
      expect(Math.min(...values)).toBeGreaterThanOrEqual(-180);
      expect(Math.max(...values)).toBeLessThanOrEqual(180);
      expect(maxLongitudeEdge([fragment.geometry.coordinates])).toBeLessThan(3);
    }
  });
});
