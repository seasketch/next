import { identify } from "@seasketch/mapbox-gl-wms-source";
import { DataSourceDetailsFragment, DataSourceTypes } from "../../generated/graphql";
import {
  parseWmsSettings,
  metadataStubFromWmsSettings,
  resolveWmsMetadata,
} from "./wmsSettings";

export async function identifyWmsLayers(
  position: [number, number],
  source: DataSourceDetailsFragment,
  sublayers: string[],
  mapBounds: [number, number, number, number],
  width: number,
  height: number,
  x: number,
  y: number,
  abortController?: AbortController
): Promise<
  { sourceId: number; sublayer: string; attributes: { [key: string]: any } }[]
> {
  if (source.type !== DataSourceTypes.Wms) {
    throw new Error("Not a WMS source");
  }
  const settings = parseWmsSettings(source);
  const metadata =
    (await resolveWmsMetadata(source)) ||
    metadataStubFromWmsSettings(settings, source.url || "");
  try {
    const result = await identify(
      metadata,
      position,
      {
        bbox: mapBounds,
        width,
        height,
        x: Math.round(x),
        y: Math.round(y),
      },
      {
        queryLayers: sublayers,
        layers: sublayers,
        infoFormat: settings.infoFormat,
        fetch: (url, init) =>
          fetch(url, { ...init, signal: abortController?.signal }),
      }
    );
    const features = result?.features || [];
    const out: {
      sourceId: number;
      sublayer: string;
      attributes: { [key: string]: any };
    }[] = [];
    for (const feature of features) {
      const props = feature.properties || {};
      const layerName =
        (props as { layerName?: string }).layerName ||
        sublayers[0] ||
        "unknown";
      out.push({
        sourceId: source.id,
        sublayer: layerName,
        attributes: props as { [key: string]: any },
      });
    }
    return out;
  } catch (e) {
    console.warn("WMS GetFeatureInfo failed", e);
    return [];
  }
}
