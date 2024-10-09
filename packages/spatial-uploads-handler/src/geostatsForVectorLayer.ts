import {
  GeostatsAttribute,
  GeostatsAttributeType,
  GeostatsLayer,
  NumericGeostatsAttribute,
} from "@seasketch/geostats-types";
import gdal from "gdal-async";
import {
  equalIntervalBuckets,
  geometricIntervalBuckets,
  naturalBreaksBuckets,
  quantileBuckets,
  stdDevBuckets,
} from "./stats";

function isNumericGeostatsAttribute(
  attr: GeostatsAttribute | NumericGeostatsAttribute
): attr is NumericGeostatsAttribute {
  return attr.type === "number";
}

// Function to map OGR field types to Geostats attribute types
function ogrFieldTypeToGeostatsAttributeType(
  ogrFieldType: string
): GeostatsAttributeType {
  switch (ogrFieldType.toLowerCase()) {
    case "integer":
    case "integer64":
    case "real":
      return "number";
    case "string":
      return "string";
    case "date":
    case "time":
    case "datetime":
      return "string"; // Assuming date/time are represented as strings
    case "binary":
      return "array"; // Binary data can be considered as an array of bytes
    case "integerList":
    case "integer64List":
    case "reallist":
    case "stringlist":
      return "array";
    default:
      return "mixed"; // If the type is unknown, default to mixed
  }
}

/**
 * Given a path to a vector file, return an array of GeostatsLayer objects
 * describing the layers in the file. Each GeostatsLayer object contains
 * information about the layer, its geometry type, and the attributes of the
 * layer useful for data handling and cartography.
 * @param filepath
 * @returns
 */
export async function geostatsForVectorLayers(
  filepath: string
): Promise<GeostatsLayer[]> {
  const layers: GeostatsLayer[] = [];
  const layer = {
    layer: "",
    count: 0,
    geometry: "Unknown",
    attributeCount: 0,
    attributes: [],
    bounds: [],
    hasZ: false,
  } as GeostatsLayer;
  const dataset = await gdal.openAsync(filepath);
  // if (dataset.srs === null) {
  //   throw new Error("No spatial reference system found in dataset.");
  // }
  dataset.layers.forEach((lyr, lidx) => {
    const extent = lyr.getExtent();
    if (extent) {
      layer.bounds = [extent.minX, extent.minY, extent.maxX, extent.maxY];
    }
    layer.count = lyr.features.count();
    layer.layer = dataset.layers.get(0).name;
    // Sometimes ogr will report the geometry type as unknown even if all the
    // features are the same type. In this case, we can manually assign the
    // geometry type based on the sampled features.
    let assignGeometryTypeManually = false;
    const { geometryType, hasZ } = parseGeomType(lyr.geomType);
    layer.geometry = geometryType;
    layer.hasZ = hasZ;
    if (layer.geometry === "Unknown") {
      assignGeometryTypeManually = true;
    }
    layer.attributeCount = lyr.fields.count();
    const attrTypes: { [attr: string]: string } = {};
    lyr.fields.forEach((field) => {
      attrTypes[field.name] =
        ogrFieldTypeToGeostatsAttributeType(field.type) === "number"
          ? floatOrInteger(field.type)
          : ogrFieldTypeToGeostatsAttributeType(field.type);
    });
    layer.attributes = lyr.fields.map((field) => {
      return {
        attribute: field.name,
        type: ogrFieldTypeToGeostatsAttributeType(field.type),
      } as GeostatsAttribute;
    });

    // Initialize a place to hold stats while working through the features
    const attributeDetails: {
      [attr: string]: {
        count: number;
        uniqueValues: { [value: string]: number };
        numberStats?: {
          numberType: "float" | "integer";
          min: number | undefined;
          nonZeroMin: number | undefined;
          max: number | undefined;
          sum: number;
          mean: number;
          m2: number;
          histogram: { [value: number]: number };
        };
      };
    } = {};
    for (const attribute of layer.attributes) {
      attributeDetails[attribute.attribute] = {
        count: 0,
        uniqueValues: {},
        numberStats:
          attrTypes[attribute.attribute] === "float" ||
          attrTypes[attribute.attribute] === "integer"
            ? {
                numberType: attrTypes[attribute.attribute] as
                  | "float"
                  | "integer",
                nonZeroMin: undefined,
                min: undefined,
                max: undefined,
                sum: 0,
                mean: 0,
                m2: 0,
                histogram: {},
              }
            : undefined,
      };
    }

    lyr.features.forEach((feature) => {
      if (assignGeometryTypeManually && layer.geometry === "Unknown") {
        const { geometryType, hasZ } = parseGeomType(
          feature.getGeometry().wkbType
        );
        layer.geometry = geometryType;
        layer.hasZ = hasZ;
      }
      for (const attribute of layer.attributes) {
        const value = feature.fields.get(attribute.attribute);
        if (value === null) {
          continue;
        }
        const details = attributeDetails[attribute.attribute];
        details.count++;
        details.uniqueValues[value] = (details.uniqueValues[value] || 0) + 1;
        if (attribute.type === "number") {
          const stat = details.numberStats!;
          if (typeof value === "number") {
            stat.sum += value;
            const delta = value - stat.mean;
            stat.mean += delta / details.count;
            const delta2 = value - stat.mean;
            stat.m2 += delta * delta2;
            if (stat.min === undefined || value < stat.min) {
              stat.min = value;
            }
            if (stat.max === undefined || value > stat.max) {
              stat.max = value;
            }
            if (
              (value > 0 && stat.nonZeroMin === undefined) ||
              (stat.nonZeroMin !== undefined &&
                value > 0 &&
                value < stat.nonZeroMin)
            ) {
              stat.nonZeroMin = value;
            }
          } else if (value !== null) {
            throw new Error(
              "Non-numeric value found in numeric field. " + value.toString()
            );
          }
        } else {
        }
      }
    });

    for (const attrName in attributeDetails) {
      const attribute = layer.attributes.find(
        (a) => a.attribute === attrName
      ) as GeostatsAttribute;
      const details = attributeDetails[attrName];
      if (isNumericGeostatsAttribute(attribute)) {
        const stat = attributeDetails[attrName].numberStats!;
        attribute.min = stat.min;
        attribute.max = stat.max;
        const variance = stat.m2 / details.count;
        const stdev = Math.sqrt(variance);
        attribute.count = details.count;
        attribute.countDistinct = Object.keys(details.uniqueValues).length;
        attribute.values = Object.keys(details.uniqueValues).reduce(
          (acc, v) => {
            acc[v] = details.uniqueValues[v];
            return acc;
          },
          {} as { [key: string]: number }
        ) as { [key: string]: number };
        const sortedValues = Object.keys(details.uniqueValues)
          .sort()
          .reduce((acc, v) => {
            const number = /\./.test(v) ? parseFloat(v) : parseInt(v);
            const count = details.uniqueValues[v];
            for (let i = 0; i < count; i++) {
              acc.push(number);
            }
            return acc;
          }, [] as number[]);
        attribute.stats = {
          avg: stat.sum / details.count,
          stdev: stdev,
          histogram: equalIntervalBuckets(sortedValues, 49, stat.max!),
          geometricInterval: {},
          quantiles: [],
          standardDeviations: {},
          equalInterval: {},
          naturalBreaks: {},
        };
        // Calculate breaks
        // TODO: How does this work with negatives? Does it?
        const numBreaks = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
        for (const n of numBreaks) {
          attribute.stats.geometricInterval[n] = geometricIntervalBuckets(
            sortedValues,
            n,
            stat.min,
            stat.max
          );
          const quantiles = quantileBuckets(
            sortedValues,
            n,
            stat.min!,
            stat.max!
          );
          if (quantiles && quantiles.length) {
            attribute.stats.quantiles[n] = quantiles;
          }
          const buckets = stdDevBuckets(
            sortedValues,
            n,
            stat.mean,
            stdev,
            stat.min!,
            stat.max!
          );
          if (buckets) {
            attribute.stats.standardDeviations[n] = buckets;
          }
          attribute.stats.equalInterval[n] = equalIntervalBuckets(
            sortedValues,
            n,
            stat.max!,
            false
          );
          const naturalBreaks = naturalBreaksBuckets(
            sortedValues,
            n,
            attribute.countDistinct,
            stat.min,
            stat.max,
            5000
          );
          if (naturalBreaks) {
            attribute.stats.naturalBreaks[n] = naturalBreaks;
          }
        }
      } else {
        attribute.count = details.count;
        attribute.countDistinct = Object.keys(details.uniqueValues).length;
        attribute.values = Object.keys(details.uniqueValues).reduce(
          (acc, v) => {
            acc[v] = details.uniqueValues[v];
            return acc;
          },
          {} as { [key: string]: number }
        ) as { [key: string]: number };
      }
    }
    layers.push(layer);
  });
  return layers;
}

/**
 * Convert a GDAL geometry type to a GeoJSON geometry type
 * @param geomType
 * @returns
 */
function parseGeomType(geomType: number): {
  geometryType: GeostatsLayer["geometry"];
  hasZ: boolean;
} {
  switch (geomType) {
    case gdal.wkbPoint:
    case gdal.wkbPoint25D:
      return { geometryType: "Point", hasZ: geomType === gdal.wkbPoint25D };
    case gdal.wkbMultiPoint:
    case gdal.wkbMultiPoint25D:
      return {
        geometryType: "MultiPoint",
        hasZ: geomType === gdal.wkbMultiPoint25D,
      };
    case gdal.wkbLineString:
    case gdal.wkbLineString25D:
      return {
        geometryType: "LineString",
        hasZ: geomType === gdal.wkbLineString25D,
      };
    case gdal.wkbMultiLineString:
    case gdal.wkbMultiLineString25D:
      return {
        geometryType: "MultiLineString",
        hasZ: geomType === gdal.wkbMultiLineString25D,
      };
    case gdal.wkbPolygon:
    case gdal.wkbPolygon25D:
      return { geometryType: "Polygon", hasZ: geomType === gdal.wkbPolygon25D };
    case gdal.wkbMultiPolygon:
    case gdal.wkbMultiPolygon25D:
      return {
        geometryType: "MultiPolygon",
        hasZ: geomType === gdal.wkbMultiPolygon25D,
      };
    case gdal.wkbGeometryCollection:
      return { geometryType: "GeometryCollection", hasZ: false };
    default:
      return { geometryType: "Unknown", hasZ: false };
  }
}

function floatOrInteger(type: string) {
  return /integer/.test(type) ? "integer" : "float";
}
export { GeostatsAttribute };
