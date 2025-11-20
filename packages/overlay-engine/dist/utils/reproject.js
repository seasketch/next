"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reprojectFeatureTo6933 = reprojectFeatureTo6933;
const proj4 = require("proj4");
const WGS84 = "EPSG:4326";
proj4.defs("EPSG:6933", "+proj=cea +lat_ts=30 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs");
const to6933 = proj4(WGS84, "EPSG:6933");
/**
 * Reproject a single GeoJSON geometry in-place or into a copy.
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
 * Reproject a GeoJSON Feature with Polygon geometry to EPSG:6933.
 */
function reprojectFeatureTo6933(feature) {
    if (feature.type !== "Feature") {
        throw new Error("Expected a GeoJSON Feature");
    }
    // shallow clone feature, reuse properties
    const out = {
        type: "Feature",
        properties: feature.properties || {},
        geometry: JSON.parse(JSON.stringify(feature.geometry)),
    };
    reprojectGeometry(out.geometry, to6933);
    return out;
}
//# sourceMappingURL=reproject.js.map