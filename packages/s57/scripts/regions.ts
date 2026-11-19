import path from "path";
import { CHANNEL_CLIP, channelChartDir, channelCellsDir } from "./channel.js";

/**
 * Demo chart regions. Each one is a clip box (west, south, east, north) and
 * the cameras the demo offers. Overview cells that spill past the box are cut
 * to it, so a general chart does not pull the map out to the whole ocean.
 *
 * California's west edge is 200 nautical miles seaward of Cape Mendocino, the
 * westernmost point of the state. A rectangle cannot follow the coast, so
 * water off San Diego is a little farther than 200 nm. Hawaii is the eight
 * main islands. Florida is the Atlantic coast from the St. Marys River to
 * Biscayne Bay, with the same 200 nm of water off the easternmost point
 * (near Highland Beach). The Gulf coast and the Keys stay outside that box.
 */

export type ChartView = {
  name: string;
  zoom: number;
  lon: number;
  lat: number;
};

export type ChartRegion = {
  id: string;
  title: string;
  note: string;
  /** West, south, east, north, in degrees. */
  clip: [number, number, number, number];
  /** The first view is where the region opens. */
  views: ChartView[];
};

const root = path.resolve(__dirname, "../../..");

export const CHART_REGIONS: ChartRegion[] = [
  {
    id: "channel",
    title: "Channel",
    note: "Santa Barbara Channel, San Miguel to Oxnard",
    clip: CHANNEL_CLIP,
    views: [
      { name: "Channel", zoom: 9, lon: -119.9, lat: 34.2 },
      { name: "Santa Barbara", zoom: 13, lon: -119.69, lat: 34.406 },
      { name: "Ventura", zoom: 14, lon: -119.265, lat: 34.248 },
      { name: "Santa Cruz", zoom: 11, lon: -119.72, lat: 34.02 },
      { name: "Santa Rosa", zoom: 12, lon: -120.15, lat: 33.97 },
      { name: "San Miguel", zoom: 12, lon: -120.36, lat: 34.04 },
      { name: "Anacapa", zoom: 13, lon: -119.4, lat: 34.01 },
    ],
  },
  {
    id: "california",
    title: "California",
    note: "The state coast, out to 200 nautical miles",
    // Cape Mendocino is 40.440°N, 124.409°W. 200 nm west at that latitude is
    // 4.38° of longitude, so the edge at 129°W is just past 200 nm.
    clip: [-129.0, 32.4, -116.9, 42.05],
    views: [
      { name: "State", zoom: 5.4, lon: -122.9, lat: 37.2 },
      { name: "San Diego", zoom: 12, lon: -117.17, lat: 32.72 },
      { name: "Los Angeles", zoom: 11, lon: -118.25, lat: 33.73 },
      { name: "Channel", zoom: 9, lon: -119.9, lat: 34.2 },
      { name: "San Francisco", zoom: 11, lon: -122.42, lat: 37.8 },
      { name: "Eureka", zoom: 11, lon: -124.18, lat: 40.78 },
    ],
  },
  {
    id: "hawaii",
    title: "Hawaii",
    note: "The main Hawaiian islands",
    clip: [-160.8, 18.5, -154.4, 22.7],
    views: [
      { name: "Islands", zoom: 7, lon: -157.6, lat: 20.6 },
      { name: "Honolulu", zoom: 13, lon: -157.87, lat: 21.3 },
      { name: "Kahului", zoom: 12, lon: -156.47, lat: 20.9 },
      { name: "Hilo", zoom: 12, lon: -155.07, lat: 19.74 },
      { name: "Lihue", zoom: 12, lon: -159.35, lat: 21.96 },
    ],
  },
  {
    id: "florida-east",
    title: "Florida east",
    note: "Atlantic coast from the state line to Biscayne Bay, out to 200 nautical miles",
    // Highland Beach is about 26.4°N, 80.07°W. 200 nm east there is 3.73°,
    // so 76.2°W is just past 200 nm. Tampa and Key West fall outside.
    clip: [-81.95, 25.35, -76.2, 30.85],
    views: [
      { name: "Coast", zoom: 6.2, lon: -79.1, lat: 28.1 },
      { name: "Miami", zoom: 12, lon: -80.16, lat: 25.77 },
      { name: "Palm Beach", zoom: 12, lon: -80.03, lat: 26.77 },
      { name: "Canaveral", zoom: 11, lon: -80.6, lat: 28.41 },
      { name: "Jacksonville", zoom: 11, lon: -81.45, lat: 30.38 },
    ],
  },
];

const ALIASES: Record<string, string> = {
  ca: "california",
  hi: "hawaii",
  florida: "florida-east",
  fl: "florida-east",
};

export function chartRegion(id: string | undefined): ChartRegion {
  const asked = (id || "channel").toLowerCase();
  const resolved = ALIASES[asked] || asked;
  const region = CHART_REGIONS.find((candidate) => candidate.id === resolved);
  if (!region) {
    const names = CHART_REGIONS.map((candidate) => candidate.id).join(", ");
    throw new Error(`Unknown chart region "${id}". Known regions: ${names}.`);
  }
  return region;
}

/** Where `npm run chart -- <region>` writes the archives. The channel keeps its original directory. */
export function regionChartDir(id: string): string {
  if (id === "channel") return channelChartDir;
  return path.join(root, ".data/enc-fixtures/regions", id);
}

/** Where that region's NOAA zips are stored. The channel keeps its original directory. */
export function regionCellsDir(id: string): string {
  if (id === "channel") return channelCellsDir;
  return path.join(root, ".data/enc-fixtures/cells", id);
}

/** Every directory a zip might already have been downloaded into. */
export function knownCellDirs(): string[] {
  return [channelCellsDir, ...CHART_REGIONS.filter((region) => region.id !== "channel").map((region) => regionCellsDir(region.id))];
}
