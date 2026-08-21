export const TEMPLATE_ID = "GLOBAL_MANGROVE_WATCH";
export const START_YEAR = 1985;
export const BAND_COUNT = 41;
export const NATIVE_MAXZOOM = 12;
export const DISPLAY_ARCHIVE = "gmw-global.pmtiles";
export const DISPLAY_KEY = "dataLibrary/gmw-global";

export type GmwRunbook = {
  templateId: string;
  release: string;
  changelog: string;
  temporal: {
    granularity: "band";
    mapping: { bands: string[] };
  };
  urls: {
    displayPreview: string;
    displayTilejson: string;
    displayArchive: string;
    analysis: string;
  };
  register: string;
};

export function bandIds(startYear = START_YEAR, count = BAND_COUNT): string[] {
  return Array.from({ length: count }, (_, i) => String(startYear + i));
}

export function buildRunbook(options: {
  release: string;
  tilesHost?: string;
  startYear?: number;
  bandCount?: number;
}): GmwRunbook {
  const host = (options.tilesHost ?? "https://tiles.seasketch.org").replace(
    /\/$/,
    "",
  );
  const years = bandIds(options.startYear, options.bandCount);
  return {
    templateId: TEMPLATE_ID,
    release: options.release,
    changelog: `Global Mangrove Watch ${options.release}: annual mangrove presence ${years[0]}–${years[years.length - 1]}.`,
    temporal: {
      granularity: "band",
      mapping: { bands: years },
    },
    urls: {
      displayPreview: `${host}/${DISPLAY_KEY}`,
      displayTilejson: `${host}/${DISPLAY_KEY}.json`,
      displayArchive: `${host}/${DISPLAY_KEY}.pmtiles`,
      analysis: `${host}/dataLibrary/${TEMPLATE_ID}/${options.release}/analysis.tif`,
    },
    register:
      "Open the superuser GMW Data Library layer → Versions → register hosted products. Paste the display TileJSON / archive URL and the analysis COG, confirm TemporalInfo, then save. Do not run replace_data_source by hand.",
  };
}

export function formatRunbook(runbook: GmwRunbook): string {
  return [
    `# GMW Data Library runbook — ${runbook.release}`,
    "",
    runbook.changelog,
    "",
    "## Upload these two objects to R2 (ssn-tiles)",
    "",
    `- \`dataLibrary/${DISPLAY_ARCHIVE}\``,
    `- \`dataLibrary/${runbook.templateId}/${runbook.release}/analysis.tif\``,
    "",
    "## Public URLs (after upload + pmtiles-server deploy)",
    "",
    `- Display preview: ${runbook.urls.displayPreview}`,
    `- Display TileJSON: ${runbook.urls.displayTilejson}`,
    `- Display archive: ${runbook.urls.displayArchive}`,
    `- Analysis raster: ${runbook.urls.analysis}`,
    "",
    "## Suggested TemporalInfo",
    "",
    "```json",
    JSON.stringify(runbook.temporal, null, 2),
    "```",
    "",
    "## Register in production",
    "",
    runbook.register,
    "",
  ].join("\n");
}
