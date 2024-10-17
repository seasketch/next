export type Stop = {
  h3Resolution: number;
  zoomLevel: number;
};

/**
 * These stops represent the zoom levels at which each h3 resolution should be
 * displayed. The algorithm will fill in the gaps, starting at the highest zoom
 * level and working its way down to MIN_ZOOM.
 */
export const stops: Stop[] = [
  { h3Resolution: 11, zoomLevel: 14 },
  { h3Resolution: 10, zoomLevel: 13 },
  { h3Resolution: 9, zoomLevel: 12 },
  // { h3Resolution: 9, zoomLevel: 11 },
  { h3Resolution: 8, zoomLevel: 10 },
  // { h3Resolution: 7, zoomLevel: 8 },
  { h3Resolution: 7, zoomLevel: 8 },
  { h3Resolution: 6, zoomLevel: 6 },
  // { h3Resolution: 5, zoomLevel: 5 },
].sort((a, b) => b.zoomLevel - a.zoomLevel);

export function zoomToH3Resolution(zoom: number, stops: Stop[]) {
  let h3Resolution = stops[0].h3Resolution;
  for (let i = 0; i < stops.length; i++) {
    if (zoom > stops[i].zoomLevel) {
      break;
    }
    h3Resolution = stops[i].h3Resolution;
  }
  return h3Resolution;
}
