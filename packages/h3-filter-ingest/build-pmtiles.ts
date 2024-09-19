import { execSync } from "child_process";
/**
 * Creates a tile set from cells-{resolution}.fgb files, which it expects to 
 * already be in the outputs folder.
 */
const MIN_ZOOM = 1;

type Stop = {
  h3Resolution: number;
  zoomLevel: number;
}

/**
 * These stops represent the zoom levels at which each h3 resolution should be
 * displayed. The algorithm will fill in the gaps, starting at the highest zoom
 * level and working its way down to MIN_ZOOM.
 */
const stops: Stop[] = [
  { h3Resolution: 11, zoomLevel: 14 },
  { h3Resolution: 10, zoomLevel: 13 },
  { h3Resolution: 9, zoomLevel: 11 },
  { h3Resolution: 8, zoomLevel: 10 },
  { h3Resolution: 7, zoomLevel: 7 },
  { h3Resolution: 6, zoomLevel: 6 },
  { h3Resolution: 5, zoomLevel: 5 },
].sort((a, b) => b.zoomLevel - a.zoomLevel);

for (const stop of stops) {
  const resolution = stop.h3Resolution;
  const maxZoom = stop.zoomLevel;
  let minZoom = maxZoom;
  // Find the min zoom level. It may be the same as max if theres a stop for the
  // next zoom level down, or it goes to the next stop
  const nextStop = stops[stops.indexOf(stop) + 1];
  if (nextStop) {
    minZoom = nextStop.zoomLevel + 1;
  } else {
    minZoom = MIN_ZOOM;
  }
  console.log(`Create tiles for r${resolution}, z${minZoom} - z${maxZoom}`);
  execSync(`tippecanoe --force -l cells -z ${maxZoom} -Z ${minZoom} -o output/cells-${resolution}-z${minZoom}-z${maxZoom}.pmtiles output/cells-${resolution}.fgb`);
}
