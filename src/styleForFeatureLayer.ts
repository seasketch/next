import { symbolToLayers } from "./symbols/index";
import { Symbol } from "arcgis-rest-api";
import { Layer, Expression } from "mapbox-gl";
import { ImageList } from "./ImageList";
import esriTS from "./symbols/esriTS";
import { generateId } from "./symbols/utils";

/** @hidden */
type Renderer = SimpleRenderer | UniqueValueRenderer | ClassBreaksRenderer;

/** @hidden */
interface SimpleRenderer {
  type: "simple";
  symbol: Symbol;
  description: string;
  rotationType: "arithmetic" | "geographic";
  rotationExpression: string;
}

/** @hidden */
interface UniqueValueRenderer {
  type: "uniqueValue";
  field1: string;
  field2: string | null;
  field3: string | null;
  fieldDelimiter: string;
  defaultSymbol: Symbol;
  defaultLabel: string;
  uniqueValueInfos: {
    value: string;
    label: string;
    description: string;
    symbol: Symbol;
  }[];
  rotationType: "arithmetic" | "geographic";
  rotationExpression: string;
}

/** @hidden */
interface ClassBreaksRenderer {
  type: "classBreaks";
  field: string;
  classificationMethod: string;
  normalizationType:
    | "esriNormalizeByField"
    | "esriNormalizeByLog"
    | "esriNormalizeByPercentOfTotal";
  normalizationField: string;
  normalizationTotal: number;
  defaultSymbol: Symbol;
  defaultLabel: string;
  backgroundFillSymbol: Symbol;
  minValue: number;
  classBreakInfos: {
    classMinValue: number;
    classMaxValue: number;
    label: string;
    description: string;
    symbol: Symbol;
  }[];
  rotationType: "arithmetic" | "geographic";
  rotationExpression: string;
}

/**
 * This function retrieves rendering and style information from the ArcGIS REST
 * API for a given [Feature Layer](https://developers.arcgis.com/rest/services-reference/layer-table.htm)
 * and produces images and style layers that can be used to faithfully represent
 * these services as vectors in MapBox GL. It can be used in conjunction with
 * {@link ArcGISVectorSource}.
 *
 * Style generation is seperated from source handling so that you could even
 * use tippecanoe or other tools to generate vector tiles from a service and
 * style them using the generated layers. With this seperation of concerns it's
 * also possible to cache style information so that it does not need to
 * always be generated dynamically.
 *
 * ### Usage
 *
 * ```typescript
 * import { ArcGISVectorSource, styleForFeatureLayer } from "mapbox-gl-esri-sources";
 *
 * // setup map...
 * // add source...
 *
 * const { imageList, layers } = styleForFeatureLayer(
 *   "https://sampleserver6.arcgisonline.com/arcgis/rest/services/SampleWorldCities/MapServer/0",
 *   "cities-source-id"
 * );
 *
 * imageList.addToMap(map);
 *
 * for (const layer of layers) {
 *   map.addLayer(layer);
 * }
 *
 * ```
 *
 * @param {string} url Feature layer endpoint. Should terminate in _/MapServer/0..n_
 * @param {string} sourceId ID for the [source](https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/) of vector data to be used in rendering.
 * @returns The {@link ImageList.addToMap} function should be called before adding the generated layers to the map.
 */
export default async function styleForFeatureLayer(
  url: string,
  sourceId: string
): Promise<{ imageList: ImageList; layers: Layer[] }> {
  const rootUrl = url.replace(/\/\d+[\/]*$/, "");
  const sublayer = parseInt(url.match(/\/(\d+)[\/]*$/)![1]);
  const response = await fetch(url + "?f=json").then((r) => r.json());
  const renderer = response.drawingInfo.renderer as Renderer;

  let layers: Layer[] = [];
  const imageList = new ImageList(response.currentVersion);
  let legendItemIndex = 0;
  switch (renderer.type) {
    case "uniqueValue": {
      const fields = [renderer.field1];
      if (renderer.field2) {
        fields.push(renderer.field2);
        if (renderer.field3) {
          fields.push(renderer.field3);
        }
      }
      const filters: any[] = [];
      const field = renderer.field1;
      legendItemIndex = renderer.defaultSymbol ? 1 : 0;
      const fieldTypes = fields.map((f) => {
        const fieldRecord = response.fields.find((r: any) => r.name === f);
        return FIELD_TYPES[fieldRecord?.type] || "string";
      });
      for (const info of renderer.uniqueValueInfos) {
        const values = normalizeValuesForFieldTypes(
          info.value,
          renderer.fieldDelimiter,
          fieldTypes
        );
        layers.push(
          ...symbolToLayers(
            info.symbol,
            sourceId,
            imageList,
            rootUrl,
            sublayer,
            legendItemIndex++
          ).map((lyr) => {
            if (fields.length === 1) {
              lyr.filter = ["==", field, values[0]];
              filters.push(lyr.filter);
            } else {
              lyr.filter = [
                "all",
                ...fields.map((field) => [
                  "==",
                  field,
                  values[fields.indexOf(field)],
                ]),
              ];
              filters.push(lyr.filter);
            }
            return lyr;
          })
        );
      }
      if (renderer.defaultSymbol && renderer.defaultSymbol.type) {
        layers.push(
          ...symbolToLayers(
            renderer.defaultSymbol,
            sourceId,
            imageList,
            rootUrl,
            sublayer,
            0
          ).map((lyr) => {
            lyr.filter = ["none", ...filters];
            return lyr;
          })
        );
      }
      break;
    }
    case "classBreaks":
      // TODO: look for test dataset for backgroundFillSymbol
      if (renderer.backgroundFillSymbol) {
        layers.push(
          ...symbolToLayers(
            renderer.backgroundFillSymbol,
            sourceId,
            imageList,
            rootUrl,
            sublayer,
            0
          )
        );
      }
      const field = renderer.field;
      const filters: any[] = [];
      legendItemIndex = renderer.classBreakInfos.length - 1;
      let minValue = 0;
      const minMaxValues: [number, number][] = renderer.classBreakInfos.map(
        (b) => {
          const values = [b.classMinValue || minValue, b.classMaxValue] as [
            number,
            number
          ];
          minValue = values[1];
          return values;
        }
      );

      for (const info of [...renderer.classBreakInfos].reverse()) {
        layers.push(
          ...symbolToLayers(
            info.symbol,
            sourceId,
            imageList,
            rootUrl,
            sublayer,
            legendItemIndex--
          ).map((lyr) => {
            const [min, max] = minMaxValues[
              renderer.classBreakInfos.indexOf(info)
            ];
            if (renderer.classBreakInfos.indexOf(info) === 0) {
              lyr.filter = ["all", ["<=", field, max]];
            } else {
              lyr.filter = ["all", [">", field, min], ["<=", field, max]];
            }
            filters.push(lyr.filter);
            return lyr;
          })
        );
      }

      if (renderer.defaultSymbol && renderer.defaultSymbol.type) {
        const defaultLayers = await symbolToLayers(
          renderer.defaultSymbol,
          sourceId,
          imageList,
          rootUrl,
          sublayer,
          0
        );
        for (const index in defaultLayers) {
          defaultLayers[index].filter = ["none", filters];
        }
        layers.push(...defaultLayers);
      }
      break;
    default:
      // simple
      layers = symbolToLayers(
        renderer.symbol,
        sourceId,
        imageList,
        rootUrl,
        sublayer,
        0
      );
      break;
  }
  if (response.drawingInfo.labelingInfo) {
    for (const info of response.drawingInfo.labelingInfo) {
      const layer = esriTS(
        info,
        response.geometryType,
        response.fields.map((f: any) => f.name)
      );
      layer.source = sourceId;
      layer.id = generateId();
      layers.push(layer);
    }
  }
  return {
    imageList,
    layers,
  };
}

/** @hidden */
function normalizeValuesForFieldTypes(
  value: string,
  delimiter: string,
  fieldTypes: ("string" | "integer" | "float")[]
) {
  const values = value.split(delimiter);
  return values.map((v, i) => {
    if (fieldTypes[i] === "string") {
      return v;
    } else if (fieldTypes[i] === "integer") {
      return parseInt(v);
    } else if (fieldTypes[i] === "float") {
      return parseFloat(v);
    }
  });
}

/** @hidden */
const FIELD_TYPES: { [key: string]: "string" | "float" | "integer" } = {
  esriFieldTypeSmallInteger: "integer",
  esriFieldTypeInteger: "integer",
  esriFieldTypeSingle: "float",
  esriFieldTypeDouble: "float",
  esriFieldTypeString: "string",
  esriFieldTypeDate: "string",
  esriFieldTypeOID: "integer",
  esriFieldTypeGeometry: "string",
  esriFieldTypeBlob: "string",
  esriFieldTypeRaster: "string",
  esriFieldTypeGUID: "string",
  esriFieldTypeGlobalID: "string",
  esriFieldTypeXML: "string",
};
