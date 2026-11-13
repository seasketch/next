import { generateMetadataForLayer } from "../plugins/computedMetadataPlugin";

const ARCGIS_TYPES = new Set([
  "arcgis-vector",
  "arcgis-dynamic-mapserver",
  "arcgis-raster-tiles",
]);

export async function computedMetadataForArcgis(
  sourceType: string | null,
  url: string | null,
  sublayer: string | null
): Promise<unknown> {
  if (!sourceType || !url || !ARCGIS_TYPES.has(sourceType)) {
    return null;
  }
  const serviceUrl = `${url.replace(/\d+[\/]*$/, "")}?f=json`;
  const layerUrl = `${url}${sublayer !== null ? `/${sublayer}` : ""}?f=json`;
  const [serviceResponse, layerResponse] = await Promise.all([
    fetch(serviceUrl, { signal: AbortSignal.timeout(15000) }),
    fetch(layerUrl, { signal: AbortSignal.timeout(15000) }),
  ]);
  if (!serviceResponse.ok || !layerResponse.ok) {
    return null;
  }
  const serviceMetadata = await serviceResponse.json();
  const layerMetadata = await layerResponse.json();
  return generateMetadataForLayer(url, serviceMetadata, layerMetadata);
}
