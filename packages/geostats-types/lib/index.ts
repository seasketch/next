import { GeoJsonGeometryTypes } from "geojson";

/**
 * Attribute type as translated to a javacsript type
 */
export type GeostatsAttributeType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "mixed"
  | "object"
  | "array";

/**
 * A bucket is a tuple of [break, count]. Each bucket has a count of the number
 * of features between the break and the next break. The last bucket will have
 * a null count.
 */
export type Bucket = [number, number | null];

/**
 * A set of buckets for a given number of breaks. This way cartography
 * interfaces can give the user an option to choose the number of breaks
 */
export type Buckets = { [numBreaks: number]: Bucket[] };

export interface BaseGeostatsAttribute {
  /** Name of the attribute */
  attribute: string;
  /** Number of rows with this value specified. Nulls don't count */
  count: number;
  /** Number of distinct values found for this attribute in the data source */
  countDistinct?: number;
  /** Type of the attribute */
  type: GeostatsAttributeType;
  /**
   * Strict mapbox/geostats stringifies objects and arrays, which isn't helpful
   * when dealing with sketch classes. GeoJSON can contain arrays and objects in
   * properties, and so can MVT (it's not strictly specified in the spec).
   * https://docs.mapbox.com/data/tilesets/guides/vector-tiles-standards/#how-to-encode-attributes-that-arent-strings-or-numbers
   */
  typeArrayOf?: GeostatsAttributeType;
  /** Minimum value for numeric attributes */
  min?: number;
  /** Maximum value for numeric attributes */
  max?: number;
  /**
   * An object with keys representing each unique value for the attribute,
   * along with a a count of the number of times it occurs
   */
  values: { [key: string]: number };
}

/**
 * Numeric attributes have additional statistics to facilitate cartographic
 * rendering.
 */
export interface NumericGeostatsAttribute extends BaseGeostatsAttribute {
  type: "number";
  stats: {
    /** Mean value of the attribute */
    avg: number;
    /**
     * Equal Interval class breaks
     */
    equalInterval: Buckets;
    /** Jenks or CKmeans breaks */
    naturalBreaks: Buckets;
    /** Quantile breaks */
    quantiles: Buckets;
    /** Geometric Interval breaks */
    geometricInterval: Buckets;
    /** Standard deviation breaks */
    standardDeviations: Buckets;
    /**
     * Histogram is represented as a sorted set of [value, count] records. Each
     * histogram has 50 buckets.
     */
    histogram: [number, number | null][];
    /** Standard deviation of the attribute */
    stdev: number;
  };
}

export type GeostatsAttribute =
  | BaseGeostatsAttribute
  | NumericGeostatsAttribute;

export type LegacyGeostatsAttribute = Omit<
  BaseGeostatsAttribute,
  "values" | "countDistinct"
> & {
  values: (string | number | boolean | null)[];
  quantiles?: number[];
};

export function isNumericGeostatsAttribute(
  attr: GeostatsAttribute
): attr is NumericGeostatsAttribute {
  return attr.type === "number";
}

export interface GeostatsLayer {
  /**
   * Name for the layer
   */
  layer: string;
  /**
   * Number of features in the layer
   */
  count: number;
  /**
   * Geometry type for the layer
   */
  geometry: GeoJsonGeometryTypes | "Unknown";
  hasZ: boolean;
  /**
   * Number of attributes in the layer
   */
  attributeCount: number;
  /**
   * List of attributes in the layer
   */
  attributes: GeostatsAttribute[];
  bounds?: number[];
}

export type LegacyGeostatsLayer = Omit<
  GeostatsLayer,
  "attributes" | "bounds"
> & {
  attributes: LegacyGeostatsAttribute[];
};

export function isLegacyGeostatsLayer(
  layer: LegacyGeostatsLayer | GeostatsLayer
): layer is LegacyGeostatsLayer {
  if ("attributesCount" in layer && (layer as any).attributesCount) {
    return (layer as GeostatsLayer).attributes[0].countDistinct === undefined;
  } else {
    return !("bounds" in layer);
  }
}

export function isLegacyGeostatsAttribute(
  attr: LegacyGeostatsAttribute | GeostatsAttribute
): attr is LegacyGeostatsAttribute {
  return Array.isArray(attr.values);
}

/**
 * A bucket is a tuple of [break, fraction]. Each bucket has the fraction of the
 * number of features between the break and the next break. The last bucket will
 * have a null fraction.
 */
export type RasterBucket = [number, number | null];

/**
 * A set of buckets for a given number of breaks. This way cartography
 * interfaces can give the user an option to choose the number of breaks
 */
export type RasterBuckets = { [numBreaks: number]: RasterBucket[] };

/**
 * A color table entry is a tuple of [value, color]. The value references the
 * raster value and the color is a CSS color string. Raster values should match
 * those in the stats.categories array.
 */
export type ColorTableEntry = [number, string];

export type RasterBandInfo = {
  name: string;
  colorInterpretation:
    | "Red"
    | "Green"
    | "Blue"
    | "Alpha"
    | "Gray"
    | string
    | null;
  // TODO: you probably need this for creating rgb-terrain--type tiles
  base: number;
  count: number;
  minimum: number;
  maximum: number;
  interval: number;
  noDataValue: number | null;
  scale: number | null;
  offset: number | null;
  stats: {
    mean: number;
    stdev: number;
    equalInterval: RasterBuckets;
    geometricInterval: RasterBuckets;
    naturalBreaks: RasterBuckets;
    quantiles: RasterBuckets;
    standardDeviations: RasterBuckets;
    histogram: RasterBucket[];
    categories: RasterBucket[];
  };
  metadata?: { [key: string]: string };
  colorTable?: ColorTableEntry[];
  bounds?: number[];
};

/**
 * SuggestedRasterPresentation is a hint to the client on how to present the
 * raster data. This can be used to determine the default visualization type for
 * the raster data.
 *
 * - "categorical" is used for rasters with a color interpretation of "Palette",
 *   or which have a small number of unique values
 * - "continuous" is used for rasters with a color interpretation of "Gray"
 * - "rgb" is used for rasters which can be simply presented as an RGB image
 */
export enum SuggestedRasterPresentation {
  "categorical",
  "continuous",
  "rgb",
}

export interface RasterInfo {
  bands: RasterBandInfo[];
  presentation: SuggestedRasterPresentation;
  representativeColorsForRGB?: [number, number, number][];
  metadata?: { [key: string]: string };
  /**
   * Indicates that the value should be derived using a simpler mapbox
   * expression. [0, 0,255, base] vs [65536, 256, 1, base]
   */
  byteEncoding?: boolean;
}

export function isRasterInfo(
  info: RasterInfo | GeostatsLayer | any
): info is RasterInfo {
  return (info as RasterInfo).bands !== undefined;
}

export function isGeostatsLayer(
  data: RasterInfo | GeostatsLayer | any
): data is GeostatsLayer {
  return (
    !Array.isArray(data) && (data as GeostatsLayer).attributes !== undefined
  );
}
