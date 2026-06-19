import { XMLParser } from "fast-xml-parser";
import {
  WMSBoundingBox,
  WMSLayer,
  WMSOperation,
  WMSServiceMetadata,
  WMSStyle,
  WMSVersion,
} from "./types";
import {
  asArray,
  metersToDegrees,
  normalizeCrs,
  parseBoolean,
  parseNumber,
  textContent,
} from "./util";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
  isArray: (name) =>
    [
      "Layer",
      "Style",
      "BoundingBox",
      "EX_GeographicBoundingBox",
      "CRS",
      "SRS",
      "Dimension",
      "MetadataURL",
      "Format",
      "DCPType",
      "OnlineResource",
    ].includes(name),
});

function parseOperation(
  requestNode: Record<string, unknown> | undefined,
  operationName: string
): WMSOperation | undefined {
  if (!requestNode) return undefined;
  const op = requestNode[operationName] as Record<string, unknown> | undefined;
  if (!op) return undefined;
  const dcpTypes = asArray(op.DCPType as Record<string, unknown>);
  let url: string | undefined;
  const formats = asArray(op.Format as string | string[]).map(String);
  for (const dcp of dcpTypes as Record<string, unknown>[]) {
    const http = dcp.HTTP as Record<string, unknown> | undefined;
    const get = http?.Get as Record<string, unknown> | undefined;
    const onlineNodes = asArray(
      get?.OnlineResource as Record<string, unknown> | Record<string, unknown>[]
    );
    const online = onlineNodes[0] as Record<string, unknown> | undefined;
    const href =
      (online?.["xlink:href"] as string | undefined) ||
      (online?.href as string | undefined);
    if (href) {
      url = href;
      break;
    }
  }
  if (!url) return undefined;
  return { url, formats };
}

function parseStyle(styleNode: Record<string, unknown>): WMSStyle {
  const legendUrlNode = styleNode.LegendURL as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | undefined;
  const legendNodes = asArray(legendUrlNode);
  const legend = legendNodes[0] as Record<string, unknown> | undefined;
  const onlineNodes = asArray(
    legend?.OnlineResource as Record<string, unknown> | Record<string, unknown>[]
  );
  const online = onlineNodes[0] as Record<string, unknown> | undefined;
  const formatNodes = asArray(legend?.Format as string | string[]);
  return {
    name: textContent(styleNode.Name) || "",
    title: textContent(styleNode.Title),
    abstract: textContent(styleNode.Abstract),
    legendUrl:
      (online?.["xlink:href"] as string | undefined) ||
      (online?.href as string | undefined),
    legendWidth: parseNumber(legend?.width),
    legendHeight: parseNumber(legend?.height),
    legendFormat: textContent(formatNodes[0]) || textContent(legend?.Format),
  };
}

function parseBoundingBox(node: Record<string, unknown>): WMSBoundingBox {
  return {
    crs: normalizeCrs(String(node.CRS || node.SRS || "")),
    minx: parseNumber(node.minx) ?? 0,
    miny: parseNumber(node.miny) ?? 0,
    maxx: parseNumber(node.maxx) ?? 0,
    maxy: parseNumber(node.maxy) ?? 0,
  };
}

function parseGeographicBoundingBox(
  node: Record<string, unknown> | undefined
): [number, number, number, number] | undefined {
  if (!node) return undefined;
  const west = parseNumber(node.westBoundLongitude);
  const east = parseNumber(node.eastBoundLongitude);
  const south = parseNumber(node.southBoundLatitude);
  const north = parseNumber(node.northBoundLatitude);
  if (
    west === undefined ||
    east === undefined ||
    south === undefined ||
    north === undefined
  ) {
    return undefined;
  }
  return [west, south, east, north];
}

function parseLayer(
  layerNode: Record<string, unknown>,
  inheritedCrs: string[] = []
): WMSLayer {
  const crs = [
    ...inheritedCrs,
    ...asArray(layerNode.CRS as string | string[]).map(normalizeCrs),
    ...asArray(layerNode.SRS as string | string[]).map(normalizeCrs),
  ];
  const uniqueCrs = [...new Set(crs.filter(Boolean))];
  const exGeo = asArray(
    layerNode.EX_GeographicBoundingBox as Record<string, unknown>
  )[0];
  const children = asArray(layerNode.Layer as Record<string, unknown>).map(
    (child) => parseLayer(child as Record<string, unknown>, uniqueCrs)
  );
  return {
    name: textContent(layerNode.Name),
    title: textContent(layerNode.Title),
    abstract: textContent(layerNode.Abstract),
    queryable: parseBoolean(layerNode.queryable, false),
    opaque: parseBoolean(layerNode.opaque, false),
    crs: uniqueCrs,
    boundingBoxes: asArray(
      layerNode.BoundingBox as Record<string, unknown>
    ).map((node) => parseBoundingBox(node as Record<string, unknown>)),
    geographicBoundingBox: parseGeographicBoundingBox(
      exGeo as Record<string, unknown> | undefined
    ),
    styles: asArray(layerNode.Style as Record<string, unknown>).map((node) =>
      parseStyle(node as Record<string, unknown>)
    ),
    children,
    metadataUrls: asArray(
      layerNode.MetadataURL as Record<string, unknown>
    ).map((m) => {
      const node = m as Record<string, unknown>;
      return {
        type: textContent(node.type) || "",
        format: textContent(node.Format) || "",
        url:
          ((node.OnlineResource as Record<string, unknown>)?.["xlink:href"] as
            | string
            | undefined) ||
          ((node.OnlineResource as Record<string, unknown>)?.href as
            | string
            | undefined) ||
          "",
      };
    }),
    minScaleDenominator: parseNumber(layerNode.MinScaleDenominator),
    maxScaleDenominator: parseNumber(layerNode.MaxScaleDenominator),
    dimensions: asArray(layerNode.Dimension as Record<string, unknown>).map(
      (d) => {
        const node = d as Record<string, unknown>;
        return {
          name: textContent(node.name) || "",
          units: textContent(node.units),
          unitSymbol: textContent(node.unitSymbol),
          default: textContent(node.Default || node.default),
          values: textContent(node)?.split(",")?.map((v) => v.trim()),
        };
      }
    ),
  };
}

function detectVersion(doc: Record<string, unknown>): WMSVersion {
  const cap =
    (doc.WMS_Capabilities as Record<string, unknown> | undefined) ||
    (doc.WMT_MS_Capabilities as Record<string, unknown> | undefined);
  const version = textContent(cap?.version) || "1.3.0";
  return version.startsWith("1.1") ? "1.1.1" : "1.3.0";
}

export function parseCapabilities(
  xml: string,
  serviceUrl?: string
): WMSServiceMetadata {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const cap =
    (doc.WMS_Capabilities as Record<string, unknown> | undefined) ||
    (doc.WMT_MS_Capabilities as Record<string, unknown> | undefined);
  if (!cap) {
    throw new Error("Invalid WMS capabilities document");
  }
  const version = detectVersion(doc);
  const service = cap.Service as Record<string, unknown> | undefined;
  const capability = cap.Capability as Record<string, unknown> | undefined;
  const request = capability?.Request as Record<string, unknown> | undefined;
  const rootLayerNodes = asArray(
    capability?.Layer as Record<string, unknown> | Record<string, unknown>[]
  );
  const rootLayer = rootLayerNodes[0] as Record<string, unknown> | undefined;
  if (!rootLayer) {
    throw new Error("WMS capabilities missing Layer element");
  }

  const contact = service?.ContactInformation as
    | Record<string, unknown>
    | undefined;
  const contactPerson = contact?.ContactPersonPrimary as
    | Record<string, unknown>
    | undefined;
  const contactInfo = contact?.ContactAddress as
    | Record<string, unknown>
    | undefined;

  const parsedRoot = parseLayer(rootLayer);
  const layers =
    parsedRoot.children.length > 0
      ? parsedRoot.children
      : parsedRoot.name
      ? [parsedRoot]
      : [];

  const getMap = parseOperation(request, "GetMap");
  if (!getMap) {
    throw new Error("WMS capabilities missing GetMap operation");
  }

  return {
    version,
    title: textContent(service?.Title) || textContent(parsedRoot.title),
    abstract: textContent(service?.Abstract) || textContent(parsedRoot.abstract),
    fees: textContent(service?.Fees),
    accessConstraints: textContent(service?.AccessConstraints),
    contact: {
      person: textContent(contactPerson?.ContactPerson),
      organization: textContent(contactPerson?.ContactOrganization),
      email: textContent(contactInfo?.ElectronicMailAddress),
    },
    getMap,
    getFeatureInfo: parseOperation(request, "GetFeatureInfo"),
    getLegendGraphic: parseOperation(request, "GetLegendGraphic"),
    layers,
    maxWidth: parseNumber(capability?.MaxWidth),
    maxHeight: parseNumber(capability?.MaxHeight),
    serviceUrl: serviceUrl || getMap.url,
  };
}

export function flattenLayers(
  layers: WMSLayer[],
  acc: WMSLayer[] = []
): WMSLayer[] {
  for (const layer of layers) {
    if (layer.name) {
      acc.push(layer);
    }
    if (layer.children.length) {
      flattenLayers(layer.children, acc);
    }
  }
  return acc;
}

export function getNamedLayers(layers: WMSLayer[]): WMSLayer[] {
  return flattenLayers(layers).filter((l) => Boolean(l.name));
}

export function getSupportedWebMercatorCrs(
  layerOrService: WMSLayer | WMSServiceMetadata
): string | undefined {
  const crsList =
    "crs" in layerOrService
      ? layerOrService.crs
      : flattenLayers(layerOrService.layers).flatMap((l) => l.crs);
  const all = [...new Set(crsList.map(normalizeCrs))];
  if (all.includes("EPSG:3857")) return "EPSG:3857";
  if (all.includes("EPSG:900913")) return "EPSG:900913";
  if (all.includes("EPSG:4326")) return "EPSG:4326";
  return all[0];
}

export function getLayerBounds(
  layer: WMSLayer
): [number, number, number, number] | undefined {
  if (layer.geographicBoundingBox) {
    return layer.geographicBoundingBox;
  }
  const crs4326 = layer.boundingBoxes.find(
    (b) => normalizeCrs(b.crs) === "EPSG:4326"
  );
  if (crs4326) {
    if (crs4326.minx >= -180 && crs4326.maxx <= 180) {
      return [crs4326.minx, crs4326.miny, crs4326.maxx, crs4326.maxy];
    }
    // 1.3.0 lat/lon axis order
    return [crs4326.miny, crs4326.minx, crs4326.maxy, crs4326.maxx];
  }
  const merc = layer.boundingBoxes.find((b) => isWebMercator(b.crs));
  if (merc) {
    return [
      ...metersToDegrees(merc.minx, merc.miny),
      ...metersToDegrees(merc.maxx, merc.maxy),
    ] as [number, number, number, number];
  }
  return undefined;
}

function isWebMercator(crs: string): boolean {
  const n = normalizeCrs(crs);
  return n === "EPSG:3857" || n === "EPSG:900913";
}
