import { AnySourceData, Layer, Map } from "mapbox-gl";
import {
  DetailedLayerMetadata,
  Extent,
  FeatureServerMetadata,
  MapServiceMetadata,
} from "./ServiceMetadata";
import { SpatialReference } from "arcgis-rest-api";
import { MapServiceLegendMetadata } from "./ArcGISRESTServiceRequestManager";
import { blankDataUri } from "./ArcGISDynamicMapService";

/**
 * Replaced an existing source, preserving layers and their order by temporarily
 * removing them
 * @param sourceId ID of the source to replace
 * @param map Mapbox GL JS Map instance
 * @param sourceData Replacement source options
 */
export function replaceSource(
  sourceId: string,
  map: Map,
  sourceData: AnySourceData
) {
  const existingSource = map.getSource(sourceId);
  if (!existingSource) {
    throw new Error("Source does not exist");
  }
  if (existingSource.type !== sourceData.type) {
    throw new Error("Source type mismatch");
  }
  const allLayers = map.getStyle().layers || [];
  const relatedLayers = allLayers.filter((l) => {
    return "source" in l && l.source === sourceId;
  });

  relatedLayers.reverse();
  const idx = allLayers.indexOf(relatedLayers[0]);
  let before = allLayers[idx + 1]?.id || undefined;
  for (const layer of relatedLayers) {
    map.removeLayer(layer.id);
  }
  map.removeSource(sourceId);
  map.addSource(sourceId, sourceData);
  for (const layer of relatedLayers) {
    map.addLayer(layer, before);
    before = layer.id;
  }
}

/**
 * Convert meters to degrees in web mercator projection
 * @param x
 * @param y
 * @returns [lon, lat]
 */
export function metersToDegrees(x: number, y: number): [number, number] {
  var lon = (x * 180) / 20037508.34;
  var lat =
    (Math.atan(Math.exp((y * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
  return [lon, lat];
}

/**
 * Convert an ArcGIS REST Service extent to a Mapbox GL JS LatLngBounds
 * compatible array
 * @param extent
 * @returns [xmin, ymin, xmax, ymax]
 */
export async function extentToLatLngBounds(
  extent: Extent
): Promise<[number, number, number, number] | void> {
  if (extent) {
    const wkid = normalizeSpatialReference(extent.spatialReference);
    let bounds: [number, number, number, number];
    if (wkid === 4326) {
      bounds = [
        Math.max(-180, extent.xmin),
        Math.max(-90, extent.ymin),
        Math.min(180, extent.xmax),
        Math.min(90, extent.ymax),
      ];
    } else if (wkid === 3857 || wkid === 102100) {
      bounds = [
        ...metersToDegrees(extent.xmin, extent.ymin),
        ...metersToDegrees(extent.xmax, extent.ymax),
      ];
    } else {
      try {
        const projected = await projectExtent(extent);
        bounds = [
          projected.xmin,
          projected.ymin,
          projected.xmax,
          projected.ymax,
        ];
      } catch (e) {
        console.error(e);
        return;
      }
    }
    if (bounds) {
      // check that bounds are valid, e.g. not a super small area around null
      // island. these bad bounds can crash mapbox-gl-js
      const [xmin, ymin, xmax, ymax] = bounds;
      if (xmin === xmax || ymin === ymax) {
        return;
      } else if (
        Math.abs(ymax - ymin) < 0.001 ||
        Math.abs(xmax - xmin) < 0.001
      ) {
        return;
      } else {
        if (bounds) {
          bounds = enforceBoundsMinMax(bounds);
        }
        return bounds;
      }
    } else {
      return;
    }
  }
}

function enforceBoundsMinMax(bounds: [number, number, number, number]) {
  const [xmin, ymin, xmax, ymax] = bounds;
  return [
    Math.max(-180, xmin),
    Math.max(-90, ymin),
    Math.min(180, xmax),
    Math.min(90, ymax),
  ] as [number, number, number, number];
}

export function normalizeSpatialReference(sr: SpatialReference) {
  const wkid = "latestWkid" in sr ? sr.latestWkid : "wkid" in sr ? sr.wkid : -1;
  if (typeof wkid === "string") {
    if (/WGS\s*84/.test(wkid)) {
      return 4326;
    } else {
      return -1;
    }
  } else {
    return wkid || -1;
  }
}

export async function projectExtent(extent: Extent) {
  const endpoint =
    "https://tasks.arcgisonline.com/arcgis/rest/services/Geometry/GeometryServer/project";
  const params = new URLSearchParams({
    geometries: JSON.stringify({
      geometryType: "esriGeometryEnvelope",
      geometries: [extent],
    }),
    // @ts-ignore
    inSR: `${extent.spatialReference.wkid}`,
    outSR: "4326",
    f: "json",
  });
  const response = await fetch(`${endpoint}?${params.toString()}`);
  const data = await response.json();
  const projected = data.geometries[0];
  if (projected) {
    return projected;
  } else {
    throw new Error("Failed to reproject");
  }
}

export function contentOrFalse(str?: string) {
  if (str && str.length > 0) {
    return str;
  } else {
    return false;
  }
}

function pickDescription(
  info: MapServiceMetadata | FeatureServerMetadata,
  layer?: DetailedLayerMetadata
) {
  return (
    contentOrFalse(layer?.description) ||
    contentOrFalse(info.description) ||
    contentOrFalse(info.documentInfo?.Subject) ||
    contentOrFalse(info.documentInfo?.Comments)
  );
}

/**
 * Uses service metadata to create a markdown-like prosemirror document which
 * represents layer metadata
 * @param url
 * @param mapServerInfo
 * @param layer
 * @returns
 */
export function generateMetadataForLayer(
  url: string,
  mapServerInfo: MapServiceMetadata | FeatureServerMetadata,
  layer: DetailedLayerMetadata
) {
  const attribution =
    contentOrFalse(layer.copyrightText) ||
    contentOrFalse(mapServerInfo.copyrightText) ||
    contentOrFalse(mapServerInfo.documentInfo?.Author);
  const description = pickDescription(mapServerInfo, layer);
  let keywords =
    mapServerInfo.documentInfo?.Keywords &&
    mapServerInfo.documentInfo?.Keywords.length
      ? mapServerInfo.documentInfo?.Keywords.split(",")
      : [];
  return {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: layer.name }],
      },
      ...(description
        ? [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: description,
                },
              ],
            },
          ]
        : []),
      ...(attribution
        ? [
            { type: "paragraph" },
            {
              type: "heading",
              attrs: { level: 3 },
              content: [{ type: "text", text: "Attribution" }],
            },
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: attribution,
                },
              ],
            },
          ]
        : []),
      ...(keywords && keywords.length
        ? [
            { type: "paragraph" },
            {
              type: "heading",
              attrs: { level: 3 },
              content: [
                {
                  type: "text",
                  text: "Keywords",
                },
              ],
            },
            {
              type: "bullet_list",
              marks: [],
              attrs: {},
              content: keywords.map((word) => ({
                type: "list_item",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: word }],
                  },
                ],
              })),
            },
          ]
        : []),
      { type: "paragraph" },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            marks: [
              {
                type: "link",
                attrs: {
                  href: url,
                  title: "ArcGIS Server",
                },
              },
            ],
            text: url,
          },
        ],
      },
    ],
  };
}

export function makeLegend(data: MapServiceLegendMetadata, layerId: number) {
  const legendLayer = data.layers.find((l) => l.layerId === layerId);
  if (legendLayer) {
    return legendLayer.legend.map((legend) => {
      return {
        id: legend.url,
        label:
          legend.label && legend.label.length > 0
            ? legend.label
            : legendLayer.legend.length === 1
            ? legendLayer.layerName
            : "",
        imageUrl: legend?.imageData
          ? `data:${legend.contentType};base64,${legend.imageData}`
          : blankDataUri,
        imageWidth: 20,
        imageHeight: 20,
      };
    });
  } else {
    return undefined;
    // throw new Error(`Legend for layerId=${layerId} not found`);
  }
}
