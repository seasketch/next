"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanCoords = cleanCoords;
const invariant_1 = require("@turf/invariant");
const helpers_1 = require("@turf/helpers");
/**
 * Cleans and normalizes GeoJSON coordinates to ensure they are within valid world bounds. This can be helpful for ensuring reliable output from clipping operations.
 *
 * This function processes GeoJSON geometries to ensure all coordinates are within:
 * - Latitude bounds: [-90, 90]
 * - Longitude bounds: [-180, 180]
 *
 * It handles various geometry types:
 * - Point (returns as-is)
 * - MultiPoint (removes duplicates)
 * - LineString
 * - MultiLineString
 * - Polygon
 * - MultiPolygon
 * - FeatureCollection (processes each feature)
 *
 * @param geojson - The GeoJSON object to clean. Can be a geometry, feature, or feature collection.
 * @returns A new GeoJSON object with cleaned coordinates. The structure matches the input type.
 * @throws Error if:
 *   - geojson is null or undefined
 *   - geometry type is not supported
 *
 * @example
 * // Clean a polygon that crosses the antimeridian
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[190, 0], [200, 0], [200, 10], [190, 10], [190, 0]]]
 * };
 * const cleaned = cleanCoords(polygon);
 * // Result: coordinates will be normalized to [-180, 180] range
 */
function cleanCoords(geojson) {
    if (!geojson)
        throw new Error("geojson is required");
    const type = (0, invariant_1.getType)(geojson);
    // Store new "clean" points in this Array
    let newCoords = [];
    switch (type) {
        case "FeatureCollection": {
            const cleanedCollection = (0, helpers_1.featureCollection)(geojson.features.map((f) => cleanCoords(f)));
            if (geojson.properties) {
                // @ts-expect-error - is this is a sketch collection we want to transfer collection-level properties
                cleanedCollection.properties = geojson.properties;
                cleanedCollection.bbox = geojson.bbox; // and bbox
            }
            return cleanedCollection;
        }
        case "LineString": {
            newCoords = cleanLine(geojson);
            break;
        }
        case "MultiLineString":
        case "Polygon": {
            for (const line of (0, invariant_1.getCoords)(geojson)) {
                newCoords.push(cleanLine(line));
            }
            break;
        }
        case "MultiPolygon": {
            (0, invariant_1.getCoords)(geojson).forEach(function (polygons) {
                const polyPoints = [];
                polygons.forEach(function (ring) {
                    polyPoints.push(cleanLine(ring));
                });
                newCoords.push(polyPoints);
            });
            break;
        }
        case "Point": {
            return geojson;
        }
        case "MultiPoint": {
            const existing = {};
            (0, invariant_1.getCoords)(geojson).forEach(function (coord) {
                const key = coord.join("-");
                if (!Object.prototype.hasOwnProperty.call(existing, key)) {
                    newCoords.push(coord);
                    existing[key] = true;
                }
            });
            break;
        }
        default: {
            throw new Error(type + " geometry not supported");
        }
    }
    if (geojson.coordinates) {
        return { type: type, coordinates: newCoords };
    }
    else {
        return (0, helpers_1.feature)({ type: type, coordinates: newCoords }, geojson.properties, {
            bbox: geojson.bbox,
            id: geojson.id,
        });
    }
}
/**
 * Cleans and normalizes a line of coordinates.
 *
 * This function processes each point in a line (array of coordinates) to ensure
 * they are within valid world bounds. It handles both LineString geometries and
 * arrays of coordinates.
 *
 * @param line - An array of coordinates representing a line, or a LineString geometry
 * @returns An array of cleaned coordinates, where each coordinate is [longitude, latitude]
 *          with values normalized to [-180, 180] and [-90, 90] respectively
 *
 * @example
 * const line = [[190, 0], [200, 0], [200, 10]];
 * const cleaned = cleanLine(line);
 * // Result: [[-170, 0], [-160, 0], [-160, 10]]
 */
function cleanLine(line) {
    const points = (0, invariant_1.getCoords)(line);
    const newPoints = [];
    for (const point of points) {
        const newPoint = [longitude(point[0]), latitude(point[1])];
        newPoints.push(newPoint);
    }
    return newPoints;
}
/**
 * Normalizes a latitude value to be within [-90, 90] degrees.
 *
 * This function handles latitude values that extend beyond the valid range by:
 * 1. Taking the modulo 180 to get a value in [-180, 180]
 * 2. Converting values outside [-90, 90] to their equivalent within the range
 * 3. Ensuring -0 is converted to 0
 *
 * @param lat - The latitude value to normalize
 * @returns A latitude value between -90 and 90 degrees
 * @throws Error if lat is undefined or null
 *
 * @example
 * latitude(100)  // returns -80
 * latitude(-100) // returns 80
 * latitude(0)    // returns 0
 */
function latitude(lat) {
    if (lat === undefined || lat === null)
        throw new Error("lat is required");
    // Latitudes cannot extends beyond +/-90 degrees
    if (lat > 90 || lat < -90) {
        lat = lat % 180;
        if (lat > 90)
            lat = -180 + lat;
        if (lat < -90)
            lat = 180 + lat;
        if (lat === 0)
            lat = Math.abs(lat); // make sure not negative zero
    }
    return lat;
}
/**
 * Normalizes a longitude value to be within [-180, 180] degrees.
 *
 * This function handles longitude values that extend beyond the valid range by:
 * 1. Taking the modulo 360 to get a value in [-360, 360]
 * 2. Converting values outside [-180, 180] to their equivalent within the range
 * 3. Ensuring -0 is converted to 0
 *
 * @param lng - The longitude value to normalize
 * @returns A longitude value between -180 and 180 degrees
 * @throws Error if lng is undefined or null
 *
 * @example
 * longitude(190)  // returns -170
 * longitude(-190) // returns 170
 * longitude(0)    // returns 0
 */
function longitude(lng) {
    if (lng === undefined || lng === undefined)
        throw new Error("lng is required");
    // lngitudes cannot extends beyond +/-90 degrees
    if (lng > 180 || lng < -180) {
        lng = lng % 360;
        if (lng > 180)
            lng = -360 + lng;
        if (lng < -180)
            lng = 360 + lng;
        if (lng === 0)
            lng = Math.abs(lng); // make sure not negative zero
    }
    return lng;
}
