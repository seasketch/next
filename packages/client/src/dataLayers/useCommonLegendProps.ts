import { useCallback, useMemo } from "react";
import { MapContextInterface } from "./MapContextManager";
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
export default function useCommonLegendProps(mapContext: MapContextInterface) {
  const onHiddenItemsChange = useCallback(
    (id: string, hidden: boolean) => {
      if (/sketch-class/.test(id)) {
        const sketchClassId = parseInt(id.split("sketch-class-")[1]);
        mapContext.manager?.setSketchClassHidden(sketchClassId, hidden);
      } else {
        if (hidden) {
          mapContext.manager?.hideLayer(id);
        } else {
          mapContext.manager?.showHiddenLayer(id);
        }
      }
    },
    [mapContext.manager]
  );

  const hiddenItems = useMemo(() => {
    const hiddenItems: string[] = [];
    for (const id in mapContext.layerStatesByTocStaticId) {
      if (mapContext.layerStatesByTocStaticId[id].hidden) {
        hiddenItems.push(id);
      }
    }
    for (const id in mapContext.sketchClassLayerStates) {
      if (mapContext.sketchClassLayerStates[id].hidden) {
        // eslint-disable-next-line i18next/no-literal-string
        hiddenItems.push(`sketch-class-${id}`);
      }
    }
    return hiddenItems;
  }, [mapContext.layerStatesByTocStaticId, mapContext.sketchClassLayerStates]);

  const items = useMemo<LegendItem[]>(() => {
    if (mapContext.legends) {
      const visibleLegends: LegendItem[] = [];
      for (const layerId in mapContext.legends) {
        const legend = mapContext.legends[layerId];
        if (legend && /sketch-class/.test(legend?.id || "")) {
          visibleLegends.push(legend);
        }
      }
      for (const layer of mapContext.manager?.getVisibleLayersByZIndex() ||
        []) {
        const legend = mapContext.legends[layer.tocId];
        if (legend) {
          visibleLegends.push(legend);
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
