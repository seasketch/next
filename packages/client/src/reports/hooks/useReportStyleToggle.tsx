import type { AnySourceData, AnyLayer } from "mapbox-gl";
import { useContext, useRef, useCallback, useState, useEffect } from "react";
import { MapContext } from "../../dataLayers/MapContextManager";
import { ReportMapStyle } from "../ReportContext";


export function useReportStyleToggle(
  cardId: number,
  selectedSketchId: number,
  styleId: string,
  style: ReportMapStyle | null | undefined
) {

  const mapContext = useContext(MapContext);

  const cardMapStylesRef = useRef<{
    [cardId: number]: {
      [styleId: string]: { sources: string[]; layers: string[]; };
    };
  }>({});

  const setCardMapStyle = useCallback(
    (cardId: number, styleId: string, style: ReportMapStyle | null) => {
      const manager = mapContext.manager;
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
        for (const sourceId of existing.sources) {
          manager.removeSource(sourceId);
        }
        for (const layerId of existing.layers) {
          manager.removeLayer(layerId);
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
        const namespacedSource = typeof originalSource === "string"
          // eslint-disable-next-line i18next/no-literal-string
          ? `${basePrefix}-source-${originalSource}`
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
    [mapContext.manager, selectedSketchId]
  );

  const [visible, setVisible] = useState(false);

  const toggle = useCallback(() => {
    setVisible((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!style && visible) {
      setVisible(false);
    }
  }, [style, visible]);

  useEffect(() => {
    if (!style || !visible) {
      setCardMapStyle(cardId, styleId, null);
    } else {
      setCardMapStyle(cardId, styleId, style);
    }
  }, [visible, style, cardId, styleId, setCardMapStyle]);

  useEffect(() => {
    return () => {
      setCardMapStyle(cardId, styleId, null);
    };
  }, [cardId, styleId, setCardMapStyle]);

  return {
    visible,
    toggle,
    setVisible,
  };
}
