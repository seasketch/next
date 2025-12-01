import { Feature, Geometry } from "geojson";

/**
 * A callback function that can be used to report progress to the caller.
 * Progress is a number between 0 and 100, and message is an optional message
 * to be displayed to the user.
 */
export type OverlayWorkerProgressCallback = (
  progress: number,
  message?: string
) => Promise<void>;

/**
 * A callback function that can be used to log messages to the caller. Should be
 * used instead of console.log, so that the caller can decide whether to log to
 * the console or not.
 */
export type OverlayWorkerLogCallback = (message: string) => void;

/**
 * Can be used to save features to a file for debugging purposes. For example,
 * in calculateArea, bboxes from the polygon containment test, simplified
 * container polygons, and categorized difference features could be saved to a
 * fgb file for debugging purposes.
 */
export type OverlayWorkerLogFeatureLayerConfig = {
  name: string;
  geometryType:
    | "Polygon"
    | "MultiPolygon"
    | "Point"
    | "LineString"
    | "MultiLineString";
  fields: Record<string, "string" | "number" | "boolean">;
};

export type OverlayWorkerLogFeatureCallback = (
  layer: OverlayWorkerLogFeatureLayerConfig,
  feature: Feature
) => void;

/**
 * Long-running operations can be configured to use these helpers if provided,
 * in order to provide progress updates, log messages, and debugging information
 * to the caller. Primarily aimed at use in the overlay-worker, but could also
 * be used for testing purposes.
 */
export type OverlayWorkerHelpers = {
  progress?: OverlayWorkerProgressCallback;
  log?: OverlayWorkerLogCallback;
  logFeature?: OverlayWorkerLogFeatureCallback;
  time?: (message: string) => void;
  timeEnd?: (message: string) => void;
};

/**
 * A guaranteed version of OverlayWorkerHelpers where log and progress are always
 * callable (as no-ops when undefined), but logFeature remains optional.
 */
export type GuaranteedOverlayWorkerHelpers = {
  progress: OverlayWorkerProgressCallback;
  log: OverlayWorkerLogCallback;
  logFeature?: OverlayWorkerLogFeatureCallback;
  time: (message: string) => void;
  timeEnd: (message: string) => void;
};

/**
 * Transforms optional helpers into guaranteed interface with no-op functions for log and progress.
 * This ensures that log and progress can always be called, while preserving the optional nature
 * of logFeature for conditional usage.
 */
export function guaranteeHelpers(
  helpers?: OverlayWorkerHelpers
): GuaranteedOverlayWorkerHelpers {
  return {
    log: helpers?.log || (() => {}),
    progress: helpers?.progress || (async () => {}),
    logFeature: helpers?.logFeature,
    time: helpers?.time || (() => {}),
    timeEnd: helpers?.timeEnd || (() => {}),
  };
}
