import type { AnySourceData, AnyLayer } from "mapbox-gl";
import { useContext, useRef, useCallback, useState, useEffect } from "react";
import { MapManagerContext } from "../../dataLayers/MapContextManager";
import type { ReportMapStyle } from "../reportUtils";
import { claimReportStyle, releaseReportStyle } from "./reportStyleClaims";

export type ReportStyleFitBounds = [[number, number], [number, number]];

export function useReportStyleToggle(
  cardId: number,
  selectedSketchId: number,
  styleId: string,
  style: ReportMapStyle | null | undefined,
  options?: {
    /** Fit the project map to this extent while the style is showing. */
    fitBounds?: ReportStyleFitBounds | null;
  }
) {
  const { manager } = useContext(MapManagerContext);

  const cardMapStylesRef = useRef<{
    [cardId: number]: {
      [styleId: string]: { sources: string[]; layers: string[] };
    };
  }>({});

  const setCardMapStyle = useCallback(
    (cardId: number, styleId: string, style: ReportMapStyle | null) => {
      if (!manager) {
        return;
      }

      // Namespace by report, sketch, and card so multiple open reports can't
      // clobber each other's dynamic layers or sources.
      const sketchIdPart = selectedSketchId ?? "sketch";
      // eslint-disable-next-line i18next/no-literal-string
      const basePrefix = `report-style-${sketchIdPart}-${cardId}-${styleId}`;

      const perCard = cardMapStylesRef.current[cardId];
      const existing = perCard?.[styleId];
      if (existing) {
        for (const layerId of existing.layers) {
          manager.removeLayer(layerId);
        }
        for (const sourceId of existing.sources) {
          manager.removeSource(sourceId);
        }
        if (perCard) {
          delete perCard[styleId];
          if (Object.keys(perCard).length === 0) {
            delete cardMapStylesRef.current[cardId];
          }
        }
      }

      if (!style) {
        return;
      }

      const sourceIds: string[] = [];
      const layerIds: string[] = [];

      for (const [sourceId, source] of Object.entries(style.sources || {})) {
        // eslint-disable-next-line i18next/no-literal-string
        const namespacedId = `${basePrefix}-source-${sourceId}`;
        manager.addSource(namespacedId, source as AnySourceData);
        sourceIds.push(namespacedId);
      }

      for (const layer of style.layers || []) {
        const originalId = layer.id;
        // eslint-disable-next-line i18next/no-literal-string
        const namespacedLayerId = `${basePrefix}-layer-${originalId}`;
        const anyLayer = layer as any;
        const originalSource: any = anyLayer.source;
        const namespacedSource =
          typeof originalSource === "string"
            ? // eslint-disable-next-line i18next/no-literal-string
              `${basePrefix}-source-${originalSource}`
            : originalSource;

        const clonedLayer: AnyLayer = {
          ...anyLayer,
          id: namespacedLayerId,
          ...(namespacedSource !== undefined
            ? { source: namespacedSource }
            : {}),
        };

        manager.addLayer(clonedLayer);
        layerIds.push(namespacedLayerId);
      }

      if (!cardMapStylesRef.current[cardId]) {
        cardMapStylesRef.current[cardId] = {};
      }
      cardMapStylesRef.current[cardId][styleId] = {
        sources: sourceIds,
        layers: layerIds,
      };
    },
    [manager, selectedSketchId]
  );

  const [visible, setVisible] = useState(false);
  const hideRef = useRef<() => void>(() => {});
  hideRef.current = () => setVisible(false);
  const fitBoundsRef = useRef(options?.fitBounds);
  fitBoundsRef.current = options?.fitBounds;
  const fitBounds = options?.fitBounds;
  const boundsKey = fitBounds
    ? `${fitBounds[0][0]},${fitBounds[0][1]},${fitBounds[1][0]},${fitBounds[1][1]}`
    : "";
  // eslint-disable-next-line i18next/no-literal-string
  const claimKey = `${selectedSketchId}:${cardId}:${styleId}`;

  const toggle = useCallback(() => {
    setVisible((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!style && visible) {
      setVisible(false);
    }
  }, [style, visible]);

  useEffect(() => {
    if (!manager || !style || !visible) {
      setCardMapStyle(cardId, styleId, null);
      releaseReportStyle(claimKey);
      return;
    }
    claimReportStyle(claimKey, () => hideRef.current());
    setCardMapStyle(cardId, styleId, style);
    return () => {
      setCardMapStyle(cardId, styleId, null);
      releaseReportStyle(claimKey);
    };
  }, [visible, style, cardId, styleId, setCardMapStyle, manager, claimKey]);

  useEffect(() => {
    const bounds = fitBoundsRef.current;
    const map = manager?.map;
    if (!visible || !bounds || !map) return;
    let cancelled = false;
    let fitted = false;
    const apply = () => {
      if (cancelled || fitted) return;
      const width = map.getContainer().clientWidth;
      const height = map.getContainer().clientHeight;
      if (width < 200 || height < 160) return;
      fitted = true;
      // The open report sits on the top-right. Leave room so the route is not
      // covered by that panel, without asking for more padding than the map has.
      const right = Math.min(540, Math.max(48, width - 160));
      const top = Math.min(72, Math.max(24, height - 120));
      map.fitBounds(bounds, {
        padding: { top, right, bottom: 48, left: 48 },
        maxZoom: 12,
        duration: 0,
      });
    };
    // addSource/addLayer rebuild the map style asynchronously. A fit that runs
    // before that rebuild is discarded, because setStyle keeps the camera from
    // the moment it is called. Wait until the map is idle again.
    map.once("idle", apply);
    const fallback = window.setTimeout(apply, 700);
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      map.off("idle", apply);
    };
  }, [visible, boundsKey, manager]);

  return {
    visible,
    toggle,
    setVisible,
    /** False when this view has no project map (the report editor). */
    canPromote: Boolean(manager),
  };
}
