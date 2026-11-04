const deployedOrigin =
  "https://sketch-preprocessing-worker.underbluewaters.workers.dev";

/**
 * Clip and warm-cache endpoint. `npm run dev` sets
 * REACT_APP_SKETCH_PREPROCESSING_URL to the local Worker. Unset, the client
 * keeps the deployed Worker.
 */
export function sketchPreprocessingUrl(path: "clip" | "warm-cache"): string {
  const base = (
    process.env.REACT_APP_SKETCH_PREPROCESSING_URL || deployedOrigin
  ).replace(/\/$/, "");
  return `${base}/${path}`;
}
