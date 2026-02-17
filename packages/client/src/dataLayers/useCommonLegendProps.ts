import { useCallback, useMemo } from "react";
import MapContextManager, {
  LayerTreeContextState,
  LegendsContextState,
  MapContextInterface,
  SketchClassLayerState,
} from "./MapContextManager";
import { LegendItem } from "./Legend";

/**
 * Provides handlers for the Legend state. This is used by the TOC component.
 * Functionality is shared between the ProjectApp ToC and the Admin ToC.
 * Unfortunately the Legend is also used by the ArcGIS catalog browser, which
 * behaves very differently so the Legend has props like hiddenItems and
 * onHiddenItemsChange. These can be complicated to implement, so for the
 * project homepage and layer admin ToC we use this hook to provide the
 * handlers.
 */
export default function useCommonLegendProps(
  mapContext: Pick<MapContextInterface, "layerStatesByTocStaticId" | "legends">,
  manager: MapContextManager | undefined,
  sketchClassLayerStates: { [sketchClassId: string]: SketchClassLayerState }
) {

  const onHiddenItemsChange = useCallback(
    (id: string, hidden: boolean) => {
      if (/sketch-class/.test(id)) {
        const sketchClassId = parseInt(id.split("sketch-class-")[1]);
        manager?.setSketchClassHidden(sketchClassId, hidden);
      } else {
        if (hidden) {
          manager?.hideLayer(id);
        } else {
          manager?.showHiddenLayer(id);
        }
      }
    },
    [manager]
  );

  const hiddenItems = useMemo(() => {
    const hiddenItems: string[] = [];
    for (const id in mapContext.layerStatesByTocStaticId) {
      if (mapContext.layerStatesByTocStaticId[id].hidden) {
        hiddenItems.push(id);
      }
    }
    for (const id in sketchClassLayerStates) {
      if (sketchClassLayerStates[id].hidden) {
        // eslint-disable-next-line i18next/no-literal-string
        hiddenItems.push(`sketch-class-${id}`);
      }
    }
    return hiddenItems;
  }, [mapContext.layerStatesByTocStaticId, sketchClassLayerStates]);

  const items = useMemo<LegendItem[]>(() => {
    if (mapContext.legends) {
      const visibleLegends: LegendItem[] = [];
      for (const layer of manager?.getVisibleLayersByZIndex() ||
        []) {
        if (layer.sketchClassLayerState) {
          visibleLegends.push(layer.sketchClassLayerState.legendItem);
        } else {
          const legend = mapContext.legends[layer.dataLayer?.tocId || ""];
          if (legend) {
            visibleLegends.push(legend);
          }
        }
      }
      return visibleLegends;
    } else {
      return [];
    }
  }, [mapContext.legends, mapContext.layerStatesByTocStaticId]);

  return {
    onHiddenItemsChange,
    hiddenItems,
    items,
  };
}
