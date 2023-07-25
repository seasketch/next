import {
  Feature,
  FeatureCollection,
  GeoJsonGeometryTypes,
  GeoJsonObject,
} from "geojson";
// @ts-ignore
import MB from "@mapbox/mbtiles";

export type GeostatsAttributeType =
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "mixed"
  | "object"
  | "array";

export interface GeostatsAttribute {
  attribute: string;
  count: number;
  type: GeostatsAttributeType;
  values: (string | number | boolean | null)[];
  min?: number;
  max?: number;
}

export interface GeostatsLayer {
  layer: string;
  count: number;
  geometry: GeoJsonGeometryTypes;
  attributeCount: number;
  attributes: GeostatsAttribute[];
}

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
  };

  const attributeData: { [attrName: string]: GeostatsAttribute } = {};
  const attributeValues: {
    [attrName: string]: Set<string | number | boolean | null>;
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
          values: [],
          type,
          max: type === "number" ? value : undefined,
          min: type === "number" ? value : undefined,
        };
      }
      const attr = attributeData[propName];
      if (attributeType(value) !== attr.type) {
        attr.type = "mixed";
      }
      if (attr.type !== "object" && attr.type !== "array") {
        if (!(propName in attributeValues)) {
          attributeValues[propName] = new Set();
        }
        if (attributeValues[propName].size < 1000) {
          attributeValues[propName].add(value);
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
    const values = attributeValues[attr.attribute];
    if (values) {
      attr.count = values.size;
      attr.values = Array.from(values);
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

export async function statsFromMBTiles(mbtilesPath: string) {
  const mbtiles = await new Promise<MB>((resolve, reject) => {
    new MB(mbtilesPath!, (err: Error, mb: MB) => {
      if (err) {
        reject(err);
      } else {
        resolve(mb);
      }
    });
  });
  const info = await new Promise<any>((resolve, reject) => {
    mbtiles.getInfo(function (err: Error | null | undefined, info: any) {
      if (err) {
        reject(err);
      } else {
        resolve(info);
      }
    });
  });
  console.log("info", info);
  return {
    geostats: info?.tilestats?.layers?.length
      ? (info.tilestats.layers[0] as GeostatsLayer)
      : null,
    bounds: info.bounds,
  };
}
