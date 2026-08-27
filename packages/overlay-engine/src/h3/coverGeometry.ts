import {
  Geometry,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from "geojson";
import distance from "@turf/distance";
import {
  getHexagonEdgeLengthAvg,
  H3Index,
  latLngToCell,
  polygonToCells,
} from "h3-js";

/**
 * Sample vertex (and interpolated) positions from a geometry.
 */
export function samplePositionsFromGeometry(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case "Point":
      return [geometry.coordinates];
    case "MultiPoint":
      return geometry.coordinates;
    case "LineString":
      return geometry.coordinates;
    case "MultiLineString":
      return (geometry as MultiLineString).coordinates.flat();
    case "Polygon":
      return (geometry as Polygon).coordinates.flat();
    case "MultiPolygon":
      return (geometry as MultiPolygon).coordinates.flat(2);
    default:
      throw new Error(`Unsupported geometry type: ${geometry.type}`);
  }
}

/**
 * Vertices plus interpolated points along edges, used as origin samples
 * for H3 lower bounds. Spacing should be no larger than half a fine hex
 * edge so the bound stays admissible on long line/polygon sides.
 */
export function densifiedPositionsFromGeometry(
  geometry: Geometry,
  spacingMeters: number
): Position[] {
  const spacing = Math.max(spacingMeters, 1);
  switch (geometry.type) {
    case "Point":
      return [geometry.coordinates];
    case "MultiPoint":
      return geometry.coordinates;
    case "LineString":
      return densifyRing((geometry as LineString).coordinates, spacing);
    case "MultiLineString":
      return (geometry as MultiLineString).coordinates.flatMap((line) =>
        densifyRing(line, spacing)
      );
    case "Polygon":
      return (geometry as Polygon).coordinates.flatMap((ring) =>
        densifyRing(ring, spacing)
      );
    case "MultiPolygon":
      return (geometry as MultiPolygon).coordinates.flatMap((poly) =>
        poly.flatMap((ring) => densifyRing(ring, spacing))
      );
    default:
      throw new Error(`Unsupported geometry type: ${geometry.type}`);
  }
}

function lerpLngLat(a: Position, b: Position, t: number): Position {
  let aLng = a[0];
  let bLng = b[0];
  let dLng = bLng - aLng;
  if (dLng > 180) bLng -= 360;
  if (dLng < -180) bLng += 360;
  const lng = aLng + (bLng - aLng) * t;
  const lat = a[1] + (b[1] - a[1]) * t;
  const wrap = ((((lng + 180) % 360) + 360) % 360) - 180;
  return [wrap, lat];
}

function densifyRing(ring: Position[], spacingMeters: number): Position[] {
  if (ring.length === 0) return [];
  const out: Position[] = [ring[0]!];
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    const meters = distance(a as any, b as any, { units: "meters" });
    const steps = Math.max(1, Math.ceil(meters / spacingMeters));
    for (let s = 1; s <= steps; s++) {
      out.push(lerpLngLat(a, b, s / steps));
    }
  }
  return out;
}

/**
 * H3 cells that cover the origin geometry at `resolution`.
 *
 * Vertices are always included. Lines are densified at half the hex edge
 * length so long segments cannot skip cells. Polygons also use
 * `polygonToCells`.
 */
export function cellsCoveringGeometry(
  geometry: Geometry,
  resolution: number
): H3Index[] {
  const cells = new Set<H3Index>();
  const addPoint = (lng: number, lat: number) => {
    cells.add(latLngToCell(lat, lng, resolution));
  };

  const edgeMeters = getHexagonEdgeLengthAvg(resolution, "m");
  const spacing = Math.max(edgeMeters / 2, 1);

  switch (geometry.type) {
    case "Point": {
      const [lng, lat] = (geometry as Point).coordinates;
      addPoint(lng, lat);
      break;
    }
    case "MultiPoint": {
      for (const [lng, lat] of geometry.coordinates) {
        addPoint(lng, lat);
      }
      break;
    }
    case "LineString": {
      for (const [lng, lat] of densifyRing(
        (geometry as LineString).coordinates,
        spacing
      )) {
        addPoint(lng, lat);
      }
      break;
    }
    case "MultiLineString": {
      for (const line of (geometry as MultiLineString).coordinates) {
        for (const [lng, lat] of densifyRing(line, spacing)) {
          addPoint(lng, lat);
        }
      }
      break;
    }
    case "Polygon": {
      const coords = (geometry as Polygon).coordinates;
      for (const ring of coords) {
        for (const [lng, lat] of densifyRing(ring, spacing)) {
          addPoint(lng, lat);
        }
      }
      try {
        for (const cell of polygonToCells(coords as any, resolution, true)) {
          cells.add(cell);
        }
      } catch {
        // Degenerate / too-small polygons: vertex coverage is enough.
      }
      break;
    }
    case "MultiPolygon": {
      for (const poly of (geometry as MultiPolygon).coordinates) {
        for (const ring of poly) {
          for (const [lng, lat] of densifyRing(ring, spacing)) {
            addPoint(lng, lat);
          }
        }
        try {
          for (const cell of polygonToCells(poly as any, resolution, true)) {
            cells.add(cell);
          }
        } catch {
          // ignore
        }
      }
      break;
    }
    default:
      throw new Error(
        `Unsupported geometry type for H3 coverage: ${geometry.type}`
      );
  }

  return Array.from(cells);
}
