const MAX_EDGE = 8192;

/**
 * @typedef {Object} ScreenshotClip
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} ScreenshotRequest
 * @property {number} width
 * @property {number} height
 * @property {string} url
 * @property {unknown} bookmarkData
 * @property {boolean} skipWaitForLoaded
 * @property {ScreenshotClip} [clip]
 */

/**
 * @param {string} presented
 * @param {string} expected
 */
export function tokensMatch(presented, expected) {
  if (!expected || presented.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < presented.length; i++) {
    mismatch |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Bookmark capture only needs the SeaSketch client. Keeping the browser on
 * those hosts prevents the worker from being used as an open browser.
 * Local Chrome may also open http://localhost and http://127.0.0.1 when
 * `allowLocalhost` is set. The deployed worker leaves that off.
 *
 * @param {string} value
 * @param {{ allowLocalhost?: boolean }} [options]
 */
export function isAllowedScreenshotUrl(value, options = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (
    options.allowLocalhost &&
    url.protocol === "http:" &&
    (host === "localhost" || host === "127.0.0.1")
  ) {
    return true;
  }
  if (url.protocol !== "https:") return false;
  return host === "seasketch.org" || host.endsWith(".seasketch.org");
}

/**
 * @param {unknown} value
 * @param {string} label
 * @param {number} min
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
function roundedInt(value, label, min) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: `${label} must be a finite number` };
  }
  const rounded = Math.round(value);
  if (rounded < min || rounded > MAX_EDGE) {
    return {
      ok: false,
      error: `${label} must be between ${min} and ${MAX_EDGE}`,
    };
  }
  return { ok: true, value: rounded };
}

/**
 * @param {unknown} body
 * @param {{ allowLocalhost?: boolean }} [options]
 * @returns {{ ok: true, request: ScreenshotRequest } | { ok: false, error: string }}
 */
export function parseScreenshotRequest(body, options = {}) {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Expected a JSON object" };
  }
  const record = /** @type {Record<string, unknown>} */ (body);
  const width = roundedInt(record.width, "width", 1);
  if (!width.ok) return width;
  const height = roundedInt(record.height, "height", 1);
  if (!height.ok) return height;
  if (
    typeof record.url !== "string" ||
    !isAllowedScreenshotUrl(record.url, options)
  ) {
    return { ok: false, error: "url must be https on seasketch.org" };
  }
  if (typeof record.bookmarkData !== "object" || record.bookmarkData === null) {
    return { ok: false, error: "bookmarkData must be an object" };
  }

  /** @type {ScreenshotRequest} */
  const request = {
    width: width.value,
    height: height.value,
    url: record.url,
    bookmarkData: record.bookmarkData,
    skipWaitForLoaded: record.skipWaitForLoaded === true,
  };

  if (record.clip !== undefined && record.clip !== null) {
    const clip = parseClip(record.clip, request.width, request.height);
    if (!clip.ok) return clip;
    request.clip = clip.clip;
  }

  return { ok: true, request };
}

/**
 * @param {unknown} value
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @returns {{ ok: true, clip: ScreenshotClip } | { ok: false, error: string }}
 */
function parseClip(value, viewportWidth, viewportHeight) {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "clip must be an object" };
  }
  const record = /** @type {Record<string, unknown>} */ (value);
  const x = roundedInt(record.x, "clip.x", 0);
  if (!x.ok) return x;
  const y = roundedInt(record.y, "clip.y", 0);
  if (!y.ok) return y;
  const width = roundedInt(record.width, "clip.width", 1);
  if (!width.ok) return width;
  const height = roundedInt(record.height, "clip.height", 1);
  if (!height.ok) return height;
  const clipWidth = fitEdge(x.value, width.value, viewportWidth, "width");
  if (!clipWidth.ok) return clipWidth;
  const clipHeight = fitEdge(y.value, height.value, viewportHeight, "height");
  if (!clipHeight.ok) return clipHeight;
  return {
    ok: true,
    clip: {
      x: x.value,
      y: y.value,
      width: clipWidth.value,
      height: clipHeight.value,
    },
  };
}

/**
 * Rounding the sidebar clip can land one pixel past the viewport. Shrink that
 * pixel. A larger overflow was outside the map to begin with.
 *
 * @param {number} origin
 * @param {number} edge
 * @param {number} viewport
 * @param {"width" | "height"} axis
 * @returns {{ ok: true, value: number } | { ok: false, error: string }}
 */
function fitEdge(origin, edge, viewport, axis) {
  const overflow = origin + edge - viewport;
  if (overflow > 1) {
    return { ok: false, error: `clip extends past the viewport ${axis}` };
  }
  return { ok: true, value: overflow > 0 ? edge - overflow : edge };
}
