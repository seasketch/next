import { LegendItem } from "./CustomGLSource";
import { getNamedLayers } from "./capabilities";
import { WMSServiceMetadata } from "./types";
import { blankDataUri } from "./util";
import { buildGetLegendGraphicUrl } from "./urls";

export function getLegendGraphicUrl(
  metadata: WMSServiceMetadata,
  layerName: string,
  options: { style?: string; format?: string; crs?: string } = {}
): string {
  const baseUrl = metadata.getLegendGraphic?.url || metadata.getMap.url;
  return buildGetLegendGraphicUrl({
    baseUrl,
    version: metadata.version,
    layer: layerName,
    style: options.style,
    format: options.format || "image/png",
    crs: options.crs,
  });
}

export function getLegendItems(
  metadata: WMSServiceMetadata,
  layerName: string,
  options: { style?: string } = {}
): LegendItem[] {
  const layer = getNamedLayers(metadata.layers).find((l) => l.name === layerName);
  if (!layer) {
    return [];
  }
  const styleName = options.style || layer.styles[0]?.name || "";
  const style =
    layer.styles.find((s) => s.name === styleName) || layer.styles[0];
  if (style?.legendUrl) {
    return [
      {
        id: `${layerName}-${style.name}`,
        label: style.title || layer.title || layerName,
        imageUrl: style.legendUrl,
        imageWidth: style.legendWidth || 20,
        imageHeight: style.legendHeight || 20,
      },
    ];
  }
  const url = getLegendGraphicUrl(metadata, layerName, { style: styleName });
  return [
    {
      id: `${layerName}-legend`,
      label: layer.title || layerName,
      imageUrl: url || blankDataUri,
      imageWidth: 20,
      imageHeight: 20,
    },
  ];
}
