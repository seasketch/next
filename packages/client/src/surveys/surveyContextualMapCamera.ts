import { CameraOptions, Map } from "mapbox-gl";

/**
 * Stable identity for a survey page's starting camera. Used so we only
 * re-apply the view when the configured extent actually changes, not on
 * every parent re-render with a new object identity.
 */
export function surveyMapCameraKey(camera?: CameraOptions | null): string {
  if (!camera) {
    return "";
  }
  return [
    serializeCenter(camera.center),
    stringifyCameraNumber(camera.zoom),
    stringifyCameraNumber(camera.pitch),
    stringifyCameraNumber(camera.bearing),
  ].join(":");
}

/**
 * Jump the existing survey contextual map to a page's configured camera.
 * Applies pitch/bearing 0 explicitly so a previous tilted view is reset.
 * Does nothing when camera is missing so inherited/unset pages keep the
 * current view.
 */
export function applySurveyMapCamera(
  map: Pick<Map, "jumpTo"> | undefined,
  camera?: CameraOptions | null
) {
  if (!map || !camera) {
    return;
  }
  const next: CameraOptions = {};
  if (camera.center !== undefined) {
    next.center = camera.center;
  }
  if (camera.zoom !== undefined) {
    next.zoom = camera.zoom;
  }
  if (camera.pitch !== undefined) {
    next.pitch = camera.pitch;
  }
  if (camera.bearing !== undefined) {
    next.bearing = camera.bearing;
  }
  if (Object.keys(next).length > 0) {
    map.jumpTo(next);
  }
}

function stringifyCameraNumber(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function serializeCenter(center: CameraOptions["center"]): string {
  if (center == null) {
    return "";
  }
  if (Array.isArray(center)) {
    return `${center[0]},${center[1]}`;
  }
  if (typeof center === "object") {
    const lng =
      "lng" in center
        ? center.lng
        : "lon" in center
        ? // Mapbox LngLatLike also allows { lon, lat }
          (center as { lon: number }).lon
        : undefined;
    const lat = "lat" in center ? center.lat : undefined;
    if (lng !== undefined && lat !== undefined) {
      return `${lng},${lat}`;
    }
  }
  return String(center);
}
