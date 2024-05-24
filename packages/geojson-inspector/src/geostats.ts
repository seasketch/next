import {
  GeostatsAttribute,
  GeostatsAttributeType,
  GeostatsLayer,
} from "../../geostats-types/lib/geostats-types";
import { Feature, FeatureCollection, GeoJsonObject } from "geojson";

export default function geostats(
  json: Feature | FeatureCollection,
  layerName: string
) {
  const layer: GeostatsLayer = {
    layer: layerName,
    count: 0,
    geometry: isFeatureCollection(json)
      ? json.features[0].geometry.type
      : json.geometry.type,
    attributeCount: 0,
    attributes: [],
    bounds: [],
  };

  const attributeData: { [attrName: string]: GeostatsAttribute } = {};
  const attributeValues: {
    [attrName: string]: {
      count: number;
      countDistinct: number;
      values: { [value: string]: number };
    };
  } = {};

  function addFeature(feature: Feature) {
    if (layer.geometry !== feature.geometry.type) {
      if (
        layer.geometry === "Polygon" &&
        feature.geometry.type === "MultiPolygon"
      ) {
        layer.geometry = "MultiPolygon";
      } else if (
        layer.geometry === "LineString" &&
        feature.geometry.type === "MultiLineString"
      ) {
        layer.geometry = "MultiLineString";
      } else if (
        layer.geometry === "Point" &&
        feature.geometry.type === "MultiPoint"
      ) {
        layer.geometry = "MultiPoint";
      }
    }
    layer.count++;
    for (const propName in feature.properties) {
      const value = feature.properties[propName];
      if (!(propName in attributeData)) {
        const type = attributeType(value);
        attributeData[propName] = {
          attribute: propName,
          count: 0,
          values: {},
          type,
          max: type === "number" ? value : undefined,
          min: type === "number" ? value : undefined,
        };
      }
      const attr = attributeData[propName];
      const type = attributeType(value);
      if (type !== attr.type && type !== "null") {
        console.log("found non matching type", attr.type, type);
        attr.type = "mixed";
      }
      if (attr.type !== "object" && attr.type !== "array") {
        if (!(propName in attributeValues)) {
          attributeValues[propName] = {
            countDistinct: 0,
            values: {},
            count: 0,
          };
        }
        const record = attributeValues[propName];
        if (record.countDistinct < 1000) {
          if (!(value.toString() in record.values)) {
            record.values[value.toString()] = 0;
            record.countDistinct++;
          }
          record.count++;
          record.values[value.toString()]++;
        }
        if (attr.type === "number") {
          if (!attr.max || value > attr.max) {
            attr.max = value;
          }
          if (!attr.min || value < attr.min) {
            attr.min = value;
          }
        }
      }
    }
  }

  if (isFeatureCollection(json)) {
    for (const feature of json.features) {
      addFeature(feature);
    }
  } else {
    addFeature(json);
  }

  layer.attributes = Object.values(attributeData);
  for (const attr of layer.attributes) {
    const record = attributeValues[attr.attribute];
    if (record) {
      attr.count = record.count;
      attr.countDistinct = record.countDistinct;
      attr.values = record.values;
    }
  }
  layer.attributeCount = layer.attributes.length;
  return layer;
}

function isFeatureCollection(json: GeoJsonObject): json is FeatureCollection {
  return json.type === "FeatureCollection";
}

function attributeType(value: any): GeostatsAttributeType {
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "bigint":
    case "number":
      return "number";
    case "object":
      if (Array.isArray(value)) {
        return "array";
      } else {
        return "object";
      }
    default:
      throw new Error(`Unrecognized attribute type ${typeof value}`);
  }
}
