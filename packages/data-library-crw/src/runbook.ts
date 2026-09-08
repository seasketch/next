import { CrwProduct, VERSION_TAG, displayKey, nextPeriod } from "./products";

export type CrwRunbook = {
  productId: string;
  title: string;
  version: string;
  changelog: string;
  temporal: {
    version: 1;
    granularity: "band";
    coverage: {
      kind: "interval";
      start: string;
      end: string;
      precision: "year" | "day";
    };
    nativeResolution: "year" | "day";
    defaultViewResolution: "year" | "day";
    availability: {
      type: "grid";
      start: string;
      end: string;
      step: { count: 1; unit: "year" | "day" };
    };
    mapping: {
      type: "band";
      bands: Array<{
        id: string;
        index: number;
        when: {
          kind: "interval";
          start: string;
          end: string;
          precision: "year" | "day";
        };
      }>;
    };
    authoredBy: "library";
  };
  urls: {
    displayPreview: string;
    displayTilejson: string;
    displayArchive: string;
  };
  register: string;
};

export function buildRunbook(options: {
  product: CrwProduct;
  bands: string[];
  tilesHost?: string;
}): CrwRunbook {
  const host = (options.tilesHost ?? "https://tiles.seasketch.org").replace(
    /\/$/,
    "",
  );
  const bands = options.bands;
  const start = bands[0]!;
  const last = bands[bands.length - 1]!;
  const endExclusive = nextPeriod(options.product, last);
  const precision = options.product.cadence === "year" ? "year" : "day";
  const key = displayKey(options.product);
  const series =
    options.product.cadence === "week"
      ? `weekly samples ${start}–${last}`
      : options.product.cadence === "day"
        ? `daily ${start}–${last}`
        : `annual composites ${start}–${last}`;
  return {
    productId: options.product.id,
    title: options.product.title,
    version: VERSION_TAG,
    changelog: `NOAA Coral Reef Watch ${options.product.title}: ${series} (${VERSION_TAG}).`,
    temporal: {
      version: 1,
      granularity: "band",
      coverage: {
        kind: "interval",
        start,
        end: endExclusive,
        precision,
      },
      nativeResolution: precision,
      defaultViewResolution: precision,
      availability: {
        type: "grid",
        start,
        end: endExclusive,
        step: { count: 1, unit: precision },
      },
      mapping: {
        type: "band",
        bands: bands.map((id, i) => ({
          id,
          index: i + 1,
          when: {
            kind: "interval" as const,
            start: id,
            end: nextPeriod(options.product, id),
            precision,
          },
        })),
      },
      authoredBy: "library",
    },
    urls: {
      displayPreview: `${host}/${key}`,
      displayTilejson: `${host}/${key}.json`,
      displayArchive: `${host}/${key}.pmtiles`,
    },
    register:
      "Open the superuser CRW Data Library layer → Versions → register hosted products. Paste the display TileJSON / archive URL, confirm TemporalInfo, then save. Do not run replace_data_source by hand.",
  };
}

export function formatRunbook(runbook: CrwRunbook): string {
  return [
    `# CRW Data Library runbook — ${runbook.title} (${runbook.version})`,
    "",
    runbook.changelog,
    "",
    "## Upload this object to R2 (ssn-tiles)",
    "",
    `- \`dataLibrary/crw-${runbook.productId}-${runbook.version}.pmtiles\``,
    "",
    "## Public URLs (after upload + pmtiles-server)",
    "",
    `- Display preview: ${runbook.urls.displayPreview}`,
    `- Display TileJSON: ${runbook.urls.displayTilejson}`,
    `- Display archive: ${runbook.urls.displayArchive}`,
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
