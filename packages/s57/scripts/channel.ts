import path from "path";

/**
 * Santa Barbara Channel, from San Miguel Island to Oxnard, including Anacapa,
 * Santa Cruz, Santa Rosa, and the mainland harbours. West, south, east, north.
 */
export const CHANNEL_CLIP: [number, number, number, number] = [
  -120.55, 33.85, -119.15, 34.48,
];

const root = path.resolve(__dirname, "../../..");

/** Gitignored NOAA ENC zips for the channel demo. */
export const channelCellsDir = path.join(root, ".data/enc-fixtures/sb-channel");

/** Gitignored PMTiles archive the demo serves. */
export const channelArchivePath = path.join(root, ".data/enc-fixtures/channel.pmtiles");

/** Daily NOAA ENC product catalog. Cells and their zip URLs live here. */
export const NOAA_ENC_CATALOG_URL = "https://charts.noaa.gov/ENCs/ENCProdCat.xml";
