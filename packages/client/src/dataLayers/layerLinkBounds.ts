export const LAYER_LINK_MAP_WIDTH = 1200;
export const LAYER_LINK_MAP_HEIGHT = 800;
export const LAYER_LINK_MAP_PADDING = 48;

const TILE_SIZE = 512;
const MAX_ZOOM = 16;

export type LayerLinkCamera = {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
};

function clampLat(lat: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

/** Mercator Y in radians, matching the geo-viewport latRad used by Mapbox. */
function latRad(lat: number) {
  const sin = Math.sin((clampLat(lat) * Math.PI) / 180);
  return Math.log((1 + sin) / (1 - sin)) / 2;
}

function zoomForFraction(pixels: number, fraction: number) {
  const safe = fraction <= 0 ? 1e-6 : fraction;
  return Math.log2(pixels / TILE_SIZE / safe);
}

/**
 * Camera that fits a layer's extent in the screenshot viewport.
 * Mapbox GL's default tile is 512px, so zoom 0 shows the world in 512px.
 */
export function cameraForLayerBounds(
  bounds: [number, number, number, number],
  width = LAYER_LINK_MAP_WIDTH,
  height = LAYER_LINK_MAP_HEIGHT,
  padding = LAYER_LINK_MAP_PADDING
): LayerLinkCamera {
  const [west, south, east, north] = bounds;
  let lngDiff = east - west;
  let centerLng: number;
  if (lngDiff < 0) {
    centerLng = west + (lngDiff + 360) / 2;
    if (centerLng > 180) {
      centerLng -= 360;
    }
    lngDiff += 360;
  } else {
    centerLng = west + lngDiff / 2;
  }
  if (lngDiff === 0) {
    lngDiff = 1e-6;
  }
  const centerLat = (clampLat(south) + clampLat(north)) / 2;
  const latFraction =
    Math.abs(latRad(north) - latRad(south)) / Math.PI || 1e-6;
  const lngFraction = lngDiff / 360;
  const availWidth = Math.max(1, width - padding * 2);
  const availHeight = Math.max(1, height - padding * 2);
  const zoom = Math.min(
    zoomForFraction(availHeight, latFraction),
    zoomForFraction(availWidth, lngFraction),
    MAX_ZOOM
  );
  return {
    center: [centerLng, centerLat],
    zoom: Math.max(0, zoom),
    bearing: 0,
    pitch: 0,
  };
}

/** True when the bounds can be framed. The empty-extent sentinel is rejected. */
export function boundsAreUsable(
  bounds: unknown
): bounds is [number, number, number, number] {
  if (!Array.isArray(bounds) || bounds.length !== 4) {
    return false;
  }
  const numbers = bounds.map((value) =>
    typeof value === "number" ? value : Number.NaN
  );
  if (numbers.some((value) => !Number.isFinite(value))) {
    return false;
  }
  const [west, south, east, north] = numbers;
  if (west === 180 && south === 90 && east === -180 && north === -90) {
    return false;
  }
  if (south > north) {
    return false;
  }
  return true;
}
