export const VERSION_TAG = "v1";
export const NATIVE_MAXZOOM = 5;
export const TILE_SIZE = 256;
export const TILE_BUFFER = 1;
export const ANNUAL_BASE_URL =
  "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/annual";
export const DAILY_BASE_URL =
  "https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily";

/** Web Mercator latitude limit (clip before warping CRW's ±89.975° grid). */
export const MERCATOR_LAT_MAX = 85.05112878;

export const DAILY_WINDOW_DAYS = 365;
/** 52 weeks of daily files, sampled every 7th day. */
export const WEEKLY_WINDOW_DAYS = 364;
/** 104 weeks (24 months). */
export const WEEKLY_24_WINDOW_DAYS = 728;

export type CrwProductId =
  | "dhw-max"
  | "dhw-max-q"
  | "dhw-daily"
  | "dhw-weekly"
  | "dhw-weekly-b"
  | "dhw-weekly-all"
  | "dhw-weekly-24"
  | "baa-max"
  | "baa-weekly-24"
  | "ssta-mean"
  | "ssta-weekly-24"
  | "sst-mean"
  | "sst-weekly-24";

export type CrwCadence = "year" | "day" | "week";

export type CrwPaintKind = "continuous" | "categorical" | "diverging";

export type CrwProduct = {
  id: CrwProductId;
  cadence: CrwCadence;
  /** NOAA filename stem: `ct5km_<filenameStem>_v3.1_<year|yyyymmdd>.nc`. */
  filenameStem: string;
  /** Daily files live under `daily/<dailyFolder>/<year>/`. */
  dailyFolder?: string;
  /**
   * Daily NetCDF basename prefix. Default `ct5km_<filenameStem>`. SST daily
   * files are `coraltemp_v3.1_YYYYMMDD.nc`.
   */
  dailyFilenamePrefix?: string;
  /** NetCDF / CF variable to stack (not date, mask, or crs). */
  variable: string;
  startYear?: number;
  /** Rolling window for `cadence: "day"`. */
  windowDays?: number;
  units: string;
  title: string;
  shortTitle: string;
  layerName: string;
  /** MRT decode: physical = offset + scale * code. Pinned per product. */
  offset: number;
  scale: number;
  /** Source nodata after gdal_translate (packed fill, before or after unscale). */
  nodata: number;
  /**
   * When true, `gdal_translate -unscale -ot Float32` so int16+scale_factor
   * becomes physical units. Categorical BAA stays packed.
   */
  applyUnscale: boolean;
  outputType: "Float32" | "Int16" | "Byte";
  paintKind: CrwPaintKind;
  resampling: "near" | "bilinear";
  /**
   * Bands per gzipped MRT block. 1 = one Range fetch per band (cheap first
   * paint, but scrubbing N days = N fetches × visible tiles). Grouping days
   * lets adjacent-band scrubs reuse an already-fetched block: profiling the
   * 364-band daily product showed ~280 Range requests/s while scrubbing, with
   * CPU nearly idle — request latency, not decode, was the bottleneck.
   *
   * Blocks are also the unit of mapbox-gl's decoded-band cache (an LRU of 30
   * blocks per tile, per layer). Keeping a product's block count at or under
   * 30 means a full pass through the timeline leaves every band decoded.
   */
  bandsPerBlock: number;
  /**
   * MRT block filters, decoded natively by mapbox-gl. `["delta", "zigzag"]`
   * difference-encodes each band spatially before varint packing — measured
   * 35% smaller on daily DHW (59% combined with 0.1 quantization). Applies on
   * the next encode; already-published archives are unaffected.
   */
  filters: Array<"delta" | "zigzag">;
  /**
   * Reuse another product's downloads (and, unless `reuseStack` is false,
   * its stacked VRT). Encode/pack still write this product's own tiles.
   */
  aliasOf?: CrwProductId;
  /**
   * When `aliasOf` is set, reuse that product's stacked VRT (same bands,
   * different encode params). `false` builds this product's own VRT from
   * the alias's per-band warps — used for weekly subsamples of daily DHW.
   */
  reuseStack?: boolean;
  /** Keep every Nth date in a day-based window (`cadence: "week"`). */
  sampleEveryDays?: number;
  /**
   * Store / look up NetCDFs under another product's download folder so
   * overlapping dates are not fetched twice.
   */
  reuseDownloadsOf?: CrwProductId;
  /** Prefer an existing per-band 3857 GeoTIFF from this product when stacking. */
  reuseWarpsOf?: CrwProductId;
  /** Reuse another product's ocean-tile occupancy allowlist at encode time. */
  reuseOccupancyOf?: CrwProductId;
};

export const PRODUCTS: Record<CrwProductId, CrwProduct> = {
  "dhw-max": {
    id: "dhw-max",
    cadence: "year",
    filenameStem: "dhw-max",
    variable: "degree_heating_week",
    startYear: 1986,
    units: "degree_Celsius_weeks",
    title: "Degree Heating Week (annual max)",
    shortTitle: "DHW annual max",
    layerName: "dhw",
    offset: 0,
    scale: 0.01,
    nodata: -32768,
    applyUnscale: true,
    outputType: "Float32",
    paintKind: "continuous",
    resampling: "near",
    bandsPerBlock: 8,
    filters: ["delta", "zigzag"],
  },
  "dhw-max-q": {
    id: "dhw-max-q",
    cadence: "year",
    filenameStem: "dhw-max",
    variable: "degree_heating_week",
    startYear: 1986,
    units: "degree_Celsius_weeks",
    title: "Degree Heating Week (annual max, 0.1 °C-weeks)",
    shortTitle: "DHW annual max (0.1)",
    layerName: "dhw",
    offset: 0,
    scale: 0.1,
    nodata: -32768,
    applyUnscale: true,
    outputType: "Float32",
    paintKind: "continuous",
    resampling: "near",
    bandsPerBlock: 8,
    filters: ["delta", "zigzag"],
    aliasOf: "dhw-max",
  },
  "dhw-daily": {
    id: "dhw-daily",
    cadence: "day",
    filenameStem: "dhw",
    dailyFolder: "dhw",
    variable: "degree_heating_week",
    windowDays: DAILY_WINDOW_DAYS,
    units: "degree_Celsius_weeks",
    title: "Degree Heating Week (daily, past year)",
    shortTitle: "DHW daily",
    layerName: "dhw-daily",
    offset: 0,
    // 0.1 °C-week quantization: visualization needs nowhere near the source's
    // 0.01 precision (NOAA alert thresholds are 4 and 8), and coarser codes
    // halve the varint stream (50% smaller alone, 41% with filters).
    scale: 0.1,
    nodata: -32768,
    applyUnscale: true,
    outputType: "Float32",
    paintKind: "continuous",
    resampling: "near",
    // 365 days / 30 = 13 blocks, well under mapbox-gl's 30-block decoded LRU
    // per tile — after one pass through the year every band stays decoded, so
    // scrubbing costs only a synchronous texture update. Served in partial
    // mode: a viewport fetches one ~180 KB block per tile up front and further
    // blocks on demand while scrubbing, instead of whole 2+ MB tiles.
    bandsPerBlock: 30,
    filters: ["delta", "zigzag"],
  },
  "dhw-weekly": {
    id: "dhw-weekly",
    cadence: "week",
    filenameStem: "dhw",
    dailyFolder: "dhw",
    variable: "degree_heating_week",
    windowDays: WEEKLY_WINDOW_DAYS,
    sampleEveryDays: 7,
    units: "degree_Celsius_weeks",
    title: "Degree Heating Week (weekly, past year)",
    shortTitle: "DHW weekly",
    layerName: "dhw-weekly",
    offset: 0,
    scale: 0.1,
    nodata: -32768,
    applyUnscale: true,
    outputType: "Float32",
    paintKind: "continuous",
    resampling: "near",
    // 52 weeks in one block: a full-year scrub is one Range fetch per tile.
    bandsPerBlock: 64,
    filters: ["delta", "zigzag"],
    aliasOf: "dhw-daily",
    reuseStack: false,
  },
  "dhw-weekly-b": {
    id: "dhw-weekly-b",
    cadence: "week",
    filenameStem: "dhw",
    dailyFolder: "dhw",
    variable: "degree_heating_week",
    windowDays: WEEKLY_WINDOW_DAYS,
    sampleEveryDays: 7,
    units: "degree_Celsius_weeks",
    title: "Degree Heating Week (weekly, ~100 KB blocks)",
    shortTitle: "DHW weekly (~100 KB)",
    layerName: "dhw-weekly",
    offset: 0,
    scale: 0.1,
    nodata: -32768,
    applyUnscale: true,
    outputType: "Float32",
    paintKind: "continuous",
    resampling: "near",
    // z3 weekly tiles average ~353 KB (p90 ~630 KB) for 52 bands. 8 weeks
    // per block → ~7 Range fetches and ~50–100 KB each on typical tiles.
    bandsPerBlock: 8,
    filters: ["delta", "zigzag"],
    aliasOf: "dhw-weekly",
  },
  "dhw-weekly-all": {
    id: "dhw-weekly-all",
    cadence: "week",
    filenameStem: "dhw",
    dailyFolder: "dhw",
    variable: "degree_heating_week",
    startYear: 1986,
    sampleEveryDays: 7,
    units: "degree_Celsius_weeks",
    title: "Degree Heating Week (weekly, 1986–present)",
    shortTitle: "DHW weekly (1986–)",
    layerName: "dhw-weekly-all",
    offset: 0,
    scale: 0.1,
    nodata: -32768,
    applyUnscale: true,
    outputType: "Float32",
    paintKind: "continuous",
    resampling: "near",
    // Same 8-week blocks as dhw-weekly-b (~100 KB on typical tiles). ~2123
    // weeks → ~266 blocks — well above GL JS's 30-block decoded LRU, so a
    // full-history scrub will re-decode. Payload per step stays small.
    bandsPerBlock: 8,
    filters: ["delta", "zigzag"],
    reuseDownloadsOf: "dhw-daily",
    reuseWarpsOf: "dhw-daily",
  },
  "dhw-weekly-24": {
    id: "dhw-weekly-24",
    cadence: "week",
    filenameStem: "dhw",
    dailyFolder: "dhw",
    variable: "degree_heating_week",
    windowDays: WEEKLY_24_WINDOW_DAYS,
    sampleEveryDays: 7,
    units: "degree_Celsius_weeks",
    title: "Degree Heating Week (weekly, past 24 months)",
    shortTitle: "DHW weekly (24 mo)",
    layerName: "dhw-weekly-24",
    offset: 0,
    scale: 0.1,
    nodata: -32768,
    applyUnscale: true,
    outputType: "Float32",
    paintKind: "continuous",
    resampling: "near",
    // 104 weeks. z3 mean ~7 KB/week → 16 weeks/block ≈ 110 KB typical,
    // ~190 KB on p90 tiles. 7 blocks, under the 30-block decoded LRU.
    bandsPerBlock: 16,
    filters: ["delta", "zigzag"],
    reuseDownloadsOf: "dhw-daily",
    reuseWarpsOf: "dhw-weekly-all",
  },
  "baa-max": {
    id: "baa-max",
    cadence: "year",
    filenameStem: "baa-max",
    variable: "bleaching_alert_area",
    startYear: 1986,
    units: "alert_level",
    title: "Bleaching Alert Area (annual max)",
    shortTitle: "Bleaching Alert Area",
    layerName: "baa",
    offset: 0,
    scale: 1,
    nodata: 251,
    applyUnscale: false,
    outputType: "Byte",
    paintKind: "categorical",
    resampling: "near",
    // BAA tiles average ~70 KB total, so one block per tile: a single fetch
    // covers every year (values beyond the band count collapse to "all").
    bandsPerBlock: 64,
    filters: ["delta", "zigzag"],
  },
  "baa-weekly-24": {
    id: "baa-weekly-24",
    cadence: "week",
    filenameStem: "baa",
    dailyFolder: "baa",
    variable: "bleaching_alert_area",
    windowDays: WEEKLY_24_WINDOW_DAYS,
    sampleEveryDays: 7,
    units: "alert_level",
    title: "Bleaching Alert Area (weekly, past 24 months)",
    shortTitle: "Bleaching Alert Area (24 mo)",
    layerName: "baa-weekly-24",
    offset: 0,
    scale: 1,
    nodata: 251,
    applyUnscale: false,
    outputType: "Byte",
    paintKind: "categorical",
    resampling: "near",
    bandsPerBlock: 16,
    filters: ["delta", "zigzag"],
    reuseOccupancyOf: "baa-max",
  },
  "ssta-mean": {
    id: "ssta-mean",
    cadence: "year",
    filenameStem: "ssta-mean",
    variable: "sea_surface_temperature_anomaly",
    startYear: 1985,
    units: "degree_Celsius",
    title: "SST Anomaly (annual mean)",
    shortTitle: "SST Anomaly",
    layerName: "ssta",
    offset: -15,
    scale: 0.01,
    nodata: -32768,
    applyUnscale: true,
    outputType: "Float32",
    paintKind: "diverging",
    resampling: "near",
    bandsPerBlock: 8,
    filters: ["delta", "zigzag"],
  },
  "ssta-weekly-24": {
    id: "ssta-weekly-24",
    cadence: "week",
    filenameStem: "ssta",
    dailyFolder: "ssta",
    variable: "sea_surface_temperature_anomaly",
    windowDays: WEEKLY_24_WINDOW_DAYS,
    sampleEveryDays: 7,
    units: "degree_Celsius",
    title: "SST Anomaly (weekly, past 24 months)",
    shortTitle: "SST Anomaly (24 mo)",
    layerName: "ssta-weekly-24",
    offset: -15,
    scale: 0.01,
    nodata: -32768,
    applyUnscale: true,
    outputType: "Float32",
    paintKind: "diverging",
    resampling: "near",
    bandsPerBlock: 16,
    filters: ["delta", "zigzag"],
    reuseOccupancyOf: "ssta-mean",
  },
  "sst-mean": {
    id: "sst-mean",
    cadence: "year",
    filenameStem: "sst-mean",
    variable: "sea_surface_temperature",
    startYear: 1985,
    units: "degree_Celsius",
    title: "SST CoralTemp (annual mean)",
    shortTitle: "SST (CoralTemp)",
    layerName: "sst",
    offset: -5,
    scale: 0.01,
    nodata: -32768,
    applyUnscale: true,
    outputType: "Float32",
    paintKind: "continuous",
    resampling: "near",
    bandsPerBlock: 8,
    filters: ["delta", "zigzag"],
  },
  "sst-weekly-24": {
    id: "sst-weekly-24",
    cadence: "week",
    filenameStem: "sst",
    dailyFolder: "sst",
    dailyFilenamePrefix: "coraltemp",
    variable: "analysed_sst",
    windowDays: WEEKLY_24_WINDOW_DAYS,
    sampleEveryDays: 7,
    units: "degree_Celsius",
    title: "SST CoralTemp (weekly, past 24 months)",
    shortTitle: "SST (24 mo)",
    layerName: "sst-weekly-24",
    offset: -5,
    scale: 0.01,
    nodata: -32768,
    applyUnscale: true,
    outputType: "Float32",
    paintKind: "continuous",
    resampling: "near",
    bandsPerBlock: 16,
    filters: ["delta", "zigzag"],
    reuseOccupancyOf: "sst-mean",
  },
};

export const PRODUCT_IDS = Object.keys(PRODUCTS) as CrwProductId[];

export function isCrwProductId(value: string): value is CrwProductId {
  return value in PRODUCTS;
}

/** Walk `aliasOf` to the product that owns downloads / per-band warps. */
export function sourceProduct(product: CrwProduct): CrwProduct {
  let current = product;
  const seen = new Set<string>();
  while (current.aliasOf && !seen.has(current.id)) {
    seen.add(current.id);
    current = PRODUCTS[current.aliasOf];
  }
  return current;
}

export function reusesStack(product: CrwProduct): boolean {
  return Boolean(product.aliasOf && product.reuseStack !== false);
}

export function usesDateBands(product: CrwProduct): boolean {
  return product.cadence === "day" || product.cadence === "week";
}

export function requireProduct(id: string): CrwProduct {
  if (!isCrwProductId(id)) {
    throw new Error(
      `Unknown product "${id}". Expected one of: ${PRODUCT_IDS.join(", ")}`,
    );
  }
  return PRODUCTS[id];
}

export function utcDateOnly(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Expected YYYY-MM-DD, got "${value}"`);
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

/** Yesterday UTC — today's daily NetCDF is often not published yet. */
export function defaultDailyEnd(now = new Date()): string {
  return isoDate(addUtcDays(utcDateOnly(now), -1));
}

/** Last complete calendar year (annual composites land in early January). */
export function defaultEndYear(now = new Date()): number {
  return now.getUTCFullYear() - 1;
}

export function yearsFor(
  product: CrwProduct,
  startYear?: number,
  endYear?: number,
): number[] {
  const start = startYear ?? product.startYear;
  if (start == null) {
    throw new Error(`${product.id} has no start year`);
  }
  const end = endYear ?? defaultEndYear();
  if (end < start) {
    throw new Error(`end year ${end} is before start year ${start}`);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function dateRange(startIso: string, endIso: string): string[] {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (end < start) {
    throw new Error(`end date ${endIso} is before start date ${startIso}`);
  }
  const out: string[] = [];
  for (let d = start; d <= end; d = addUtcDays(d, 1)) {
    out.push(isoDate(d));
  }
  return out;
}

/** Band ids: ISO years (`"1986"`) or dates (`"2026-08-04"`). */
export function periodsFor(
  product: CrwProduct,
  start?: string,
  end?: string,
): string[] {
  if (product.cadence === "day" || product.cadence === "week") {
    const endIso = end ?? defaultDailyEnd();
    const days = product.windowDays ?? DAILY_WINDOW_DAYS;
    const startIso =
      start ??
      (product.startYear != null
        ? `${product.startYear}-01-01`
        : isoDate(addUtcDays(parseIsoDate(endIso), 1 - days)));
    const all = dateRange(startIso, endIso);
    const step = product.sampleEveryDays ?? (product.cadence === "week" ? 7 : 1);
    if (step <= 1) return all;
    const sampled: string[] = [];
    for (let i = all.length - 1; i >= 0; i -= step) {
      sampled.unshift(all[i]!);
    }
    return sampled;
  }
  return yearsFor(
    product,
    start ? Number(start) : undefined,
    end ? Number(end) : undefined,
  ).map(String);
}

export function sourceFilename(product: CrwProduct, bandId: string): string {
  if (usesDateBands(product)) {
    const prefix =
      product.dailyFilenamePrefix ?? `ct5km_${product.filenameStem}`;
    return `${prefix}_v3.1_${bandId.replace(/-/g, "")}.nc`;
  }
  return `ct5km_${product.filenameStem}_v3.1_${bandId}.nc`;
}

export function sourceUrl(product: CrwProduct, bandId: string): string {
  if (usesDateBands(product)) {
    const year = bandId.slice(0, 4);
    const folder = product.dailyFolder ?? product.filenameStem;
    return `${DAILY_BASE_URL}/${folder}/${year}/${sourceFilename(product, bandId)}`;
  }
  return `${ANNUAL_BASE_URL}/${sourceFilename(product, bandId)}`;
}

export function archiveBasename(product: CrwProduct): string {
  return `crw-${product.id}-${VERSION_TAG}`;
}

export function archiveFilename(product: CrwProduct): string {
  return `${archiveBasename(product)}.pmtiles`;
}

export function r2Key(product: CrwProduct): string {
  return `dataLibrary/${archiveFilename(product)}`;
}

export function displayKey(product: CrwProduct): string {
  return `dataLibrary/${archiveBasename(product)}`;
}

export function bandIds(periods: Array<string | number>): string[] {
  return periods.map(String);
}

export function nextPeriod(product: CrwProduct, lastBandId: string): string {
  if (product.cadence === "day") {
    return isoDate(addUtcDays(parseIsoDate(lastBandId), 1));
  }
  if (product.cadence === "week") {
    return isoDate(
      addUtcDays(parseIsoDate(lastBandId), product.sampleEveryDays ?? 7),
    );
  }
  return String(Number(lastBandId) + 1);
}
