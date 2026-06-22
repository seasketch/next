import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Map, LngLatBounds } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import {
  fetchCapabilities,
  flattenLayers,
  getNamedLayers,
  normalizeWMSUrl,
  validateCORS,
  WMSDynamicSource,
  WMSTiledSource,
  WMSServiceMetadata,
  WMSLayer,
} from "@seasketch/mapbox-gl-wms-source";
import Button from "../../../components/Button";
import Switch from "../../../components/Switch";
import Spinner from "../../../components/Spinner";
import { Trans, useTranslation } from "react-i18next";
import useRecentDataServers from "../arcgis/useRecentServers";
import {
  DraftTableOfContentsDocument,
  useImportWmsServiceMutation,
  WmsImportItemInput,
  WmsImportSourceInput,
} from "../../../generated/graphql";
import { generateStableId } from "../arcgis/arcgis";
import { buildImportWmsSettings } from "../../../dataLayers/wms/wmsSettings";
import Warning from "../../../components/Warning";
import bbox from "@turf/bbox";
import { Feature } from "geojson";
import { XIcon } from "@heroicons/react/outline";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN || "";

function layerBounds(layer: WMSLayer): number[] | undefined {
  const box =
    layer.geographicBoundingBox ||
    layer.boundingBoxes.find((b) => b.crs.includes("4326") || b.crs.includes("CRS:84"));
  if (box) {
    if (Array.isArray(box)) return box;
    return [box.minx, box.miny, box.maxx, box.maxy];
  }
  return undefined;
}

export default function WMSCartModal({
  onRequestClose,
  region,
  importedWmsServices,
  projectId,
}: {
  onRequestClose: () => void;
  region?: Feature<any>;
  importedWmsServices: string[];
  projectId: number;
}) {
  const { t } = useTranslation("admin:data");
  const [recent, rememberServer] = useRecentDataServers();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<WMSServiceMetadata | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [requestMode, setRequestMode] = useState<"dynamic" | "tiled">("dynamic");
  const [independentLayers, setIndependentLayers] = useState(false);
  const [map, setMap] = useState<Map | null>(null);
  const [mapDiv, setMapDiv] = useState<HTMLDivElement | null>(null);
  const [importMutation, importState] = useImportWmsServiceMutation();

  const namedLayers = useMemo(
    () => (metadata ? getNamedLayers(metadata.layers) : []),
    [metadata]
  );

  const loadService = useCallback(async () => {
    setError(null);
    setLoading(true);
    setMetadata(null);
    try {
      const normalized = normalizeWMSUrl(url.trim());
      const cors = await validateCORS(normalized.getCapabilitiesUrl);
      if (!cors.ok) {
        throw new Error(
          cors.error ||
            t("This server does not support cross-origin (CORS) requests from the browser.")
        );
      }
      const result = await fetchCapabilities(normalized.getCapabilitiesUrl);
      setMetadata(result.metadata);
      rememberServer({ type: "wms", location: normalized.baseUrl });
      const initial: Record<string, boolean> = {};
      for (const layer of getNamedLayers(result.metadata.layers).slice(0, 5)) {
        if (layer.name) initial[layer.name] = true;
      }
      setSelected(initial);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [url, rememberServer, t]);

  useEffect(() => {
    if (!mapDiv || !metadata || !map) return;
    let source: WMSDynamicSource | WMSTiledSource | undefined;
    const layers = namedLayers
      .filter((l) => l.name && selected[l.name!])
      .map((l) => ({ id: l.name!, opacity: 1 }));
    if (layers.length === 0) return;

    (async () => {
      const opts = {
        url: metadata.serviceUrl,
        sourceId: "wms-preview",
        metadata,
        supportHighDpiDisplays: true,
      };
      source =
        requestMode === "tiled"
          ? new WMSTiledSource(opts)
          : new WMSDynamicSource(opts);
      await source.prepare();
      source.updateLayers(layers);
      await source.addToMap(map);
      const { layers: glLayers } = await source.getGLStyleLayers();
      for (const layer of glLayers) {
        if (!map.getLayer("wms-preview-layer")) {
          map.addLayer({ ...layer, id: "wms-preview-layer" });
        }
      }
      const boundsLayers = namedLayers.filter(
        (l) => l.name && selected[l.name!]
      );
      for (const l of boundsLayers) {
        const b = layerBounds(l);
        if (b) {
          map.fitBounds(
            new LngLatBounds([b[0], b[1]], [b[2], b[3]]),
            { padding: 40, animate: false }
          );
          break;
        }
      }
    })();

    return () => {
      if (map.getLayer("wms-preview-layer")) map.removeLayer("wms-preview-layer");
      if (map.getSource("wms-preview")) map.removeSource("wms-preview");
      source?.destroy();
    };
  }, [map, mapDiv, metadata, selected, requestMode, namedLayers]);

  useEffect(() => {
    if (!mapDiv) return;
    const bounds = region
      ? (bbox(region) as [number, number, number, number])
      : ([-180, -85, 180, 85] as [number, number, number, number]);
    const m = new Map({
      container: mapDiv,
      style: { version: 8, sources: {}, layers: [] },
      bounds,
      projection: { name: "mercator" },
      attributionControl: false,
    });
    setMap(m);
    return () => {
      m.remove();
      setMap(null);
    };
  }, [mapDiv, region]);

  const onImport = async () => {
    const picked = namedLayers.filter((l) => l.name && selected[l.name!]);
    if (!metadata || picked.length === 0) return;

    const items: WmsImportItemInput[] = [];
    const sources: WmsImportSourceInput[] = [];

    if (independentLayers) {
      let id = 1;
      for (const layer of picked) {
        items.push({
          id,
          isFolder: false,
          title: layer.title || layer.name!,
          sourceId: id,
          sublayerName: layer.name!,
          stableId: generateStableId(),
          queryable: layer.queryable,
        });
        sources.push({
          id,
          url: metadata.serviceUrl,
          wmsSettings: buildImportWmsSettings(metadata, {
            requestMode,
            layerNames: [layer.name!],
          }),
          useDevicePixelRatio: true,
          tileSize: 256,
        });
        id++;
      }
    } else {
      const wmsSettings = buildImportWmsSettings(metadata, {
        requestMode,
        layerNames: picked.map((l) => l.name!),
      });
      let itemId = 1;
      const layerItems: WmsImportItemInput[] = [];
      for (const layer of picked) {
        layerItems.push({
          id: itemId++,
          isFolder: false,
          title: layer.title || layer.name!,
          sourceId: 1,
          sublayerName: layer.name!,
          stableId: generateStableId(),
          queryable: layer.queryable,
        });
      }
      if (layerItems.length > 1) {
        const folderStableId = generateStableId();
        items.push({
          id: 9999999,
          isFolder: true,
          title: metadata.title || t("Imported WMS Service"),
          stableId: folderStableId,
        });
        for (const item of layerItems) {
          item.parentId = folderStableId;
          items.push(item);
        }
      } else {
        items.push(...layerItems);
      }
      sources.push({
        id: 1,
        url: metadata.serviceUrl,
        wmsSettings,
        useDevicePixelRatio: true,
        tileSize: 256,
      });
    }

    await importMutation({
      variables: { projectId, items, sources },
      refetchQueries: [DraftTableOfContentsDocument],
    });
    onRequestClose();
  };

  const duplicate = importedWmsServices.some(
    (s) => metadata && s.replace(/\/$/, "") === metadata.serviceUrl.replace(/\/$/, "")
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-medium">{t("Import OGC WMS service")}</h2>
          <button className="text-gray-500" onClick={onRequestClose} aria-label={t("Close")}>
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="w-1/2 p-4 overflow-y-auto space-y-4 border-r">
            <div>
              <label className="text-sm font-medium text-gray-700">
                {t("WMS endpoint URL")}
              </label>
              <input
                className="mt-1 w-full border rounded px-2 py-1 text-sm"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/wms"
              />
              {recent.filter((r) => r.type === "wms").length > 0 && (
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  {recent
                    .filter((r) => r.type === "wms")
                    .slice(0, 5)
                    .map((r) => (
                      <button
                        key={r.location}
                        className="block text-primary-600 hover:underline text-left"
                        onClick={() => setUrl(r.location)}
                      >
                        {r.location}
                      </button>
                    ))}
                </div>
              )}
              <Button
                className="mt-2"
                disabled={!url.trim() || loading}
                onClick={loadService}
                label={loading ? <Spinner mini /> : t("Load capabilities")}
              />
            </div>
            {error && <Warning>{error}</Warning>}
            {duplicate && (
              <Warning>
                {t("This service URL has already been imported into the project.")}
              </Warning>
            )}
            {metadata && (
              <>
                <div>
                  <h3 className="font-medium text-sm">{metadata.title}</h3>
                  {metadata.abstract && (
                    <p className="text-xs text-gray-600 mt-1">{metadata.abstract}</p>
                  )}
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto border rounded p-2">
                  {flattenLayers(metadata.layers).map((layer) =>
                    layer.name ? (
                      <label
                        key={layer.name}
                        className="flex items-center space-x-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={!!selected[layer.name!]}
                          onChange={(e) =>
                            setSelected((s) => ({
                              ...s,
                              [layer.name!]: e.target.checked,
                            }))
                          }
                        />
                        <span>{layer.title || layer.name}</span>
                        {layer.queryable && (
                          <span className="text-xs text-gray-400">({t("queryable")})</span>
                        )}
                      </label>
                    ) : null
                  )}
                </div>
                <InputBlock
                  title={t("Render mode")}
                  input={
                    <select
                      className="border rounded text-sm px-2 py-1"
                      value={requestMode}
                      onChange={(e) =>
                        setRequestMode(e.target.value as "dynamic" | "tiled")
                      }
                    >
                      <option value="dynamic">{t("Dynamic (recommended)")}</option>
                      <option value="tiled">{t("Tiled")}</option>
                    </select>
                  }
                />
                <InputBlock
                  title={t("Independent layers (advanced)")}
                  input={
                    <Switch
                      isToggled={independentLayers}
                      onClick={setIndependentLayers}
                    />
                  }
                >
                  <Trans ns="admin:data">
                    Import each layer as its own service for independent z-order
                    and opacity. Default grouped import is more efficient (one
                    GetMap request).
                  </Trans>
                </InputBlock>
              </>
            )}
          </div>
          <div className="w-1/2 flex flex-col">
            <div ref={setMapDiv} className="flex-1 min-h-[300px]" />
          </div>
        </div>
        <div className="px-4 py-3 border-t flex justify-end space-x-2">
          <Button label={t("Cancel")} onClick={onRequestClose} />
          <Button
            primary
            disabled={
              !metadata ||
              namedLayers.filter((l) => l.name && selected[l.name!]).length === 0 ||
              importState.loading
            }
            onClick={onImport}
            label={
              importState.loading ? <Spinner mini /> : t("Import selected layers")
            }
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

function InputBlock({
  title,
  input,
  children,
}: {
  title: string;
  input: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{title}</span>
        {input}
      </div>
      {children && <p className="text-xs text-gray-500 mt-1">{children}</p>}
    </div>
  );
}
