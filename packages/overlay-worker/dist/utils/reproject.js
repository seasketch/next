"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reproject = reproject;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const transformation = require("transform-coordinates");
/**
 * Reproject a single GeoJSON geometry in-place.
 * Handles Point, LineString, Polygon, Multi* and GeometryCollection.
 */
function reprojectGeometry(geom, transform) {
    // @ts-ignore
    const t = ([x, y]) => transform.forward([x, y]);
    switch (geom.type) {
        case "Point":
            // @ts-ignore
            geom.coordinates = t(geom.coordinates);
            break;
        case "MultiPoint":
        case "LineString":
            // @ts-ignore
            geom.coordinates = geom.coordinates.map(t);
            break;
        case "MultiLineString":
        case "Polygon":
            // @ts-ignore
            geom.coordinates = geom.coordinates.map((ring) => ring.map(t));
            break;
        case "MultiPolygon":
            geom.coordinates = geom.coordinates.map((poly) => 
            // @ts-ignore
            poly.map((ring) => ring.map(t)));
            break;
        case "GeometryCollection":
            geom.geometries.forEach((g) => reprojectGeometry(g, transform));
            break;
        default:
            throw new Error(`Unsupported geometry type: ${geom.type}`);
    }
    return geom;
}
/**
 * Reproject a WGS84 (EPSG:4326) GeoJSON Feature to any target EPSG code.
 *
 * Uses `transform-coordinates` (proj4 + epsg-index glue) so this function
 * lives in overlay-worker rather than overlay-engine, keeping the 6 MB
 * epsg-index JSON out of the client bundle.
 *
 * @param feature     Input feature in WGS84 (EPSG:4326).
 * @param targetEpsg  Numeric EPSG code of the target CRS.
 * @throws {Error}    If the EPSG code is not found in epsg-index.
 */
function reproject(feature, targetEpsg) {
    if (feature.type !== "Feature") {
        throw new Error("Expected a GeoJSON Feature");
    }
    if (targetEpsg === 4326) {
        return {
            type: "Feature",
            properties: feature.properties || {},
            geometry: JSON.parse(JSON.stringify(feature.geometry)),
        };
    }
    let transform;
    try {
        transform = transformation(`EPSG:4326`, `EPSG:${targetEpsg}`);
    }
    catch (_a) {
        throw new Error(`EPSG:${targetEpsg} not found in epsg-index. ` +
            "Re-upload the raster in a recognised coordinate system.");
    }
    const out = {
        type: "Feature",
        properties: feature.properties || {},
        geometry: JSON.parse(JSON.stringify(feature.geometry)),
    };
    reprojectGeometry(out.geometry, transform);
    return out;
}
//# sourceMappingURL=reproject.js.map