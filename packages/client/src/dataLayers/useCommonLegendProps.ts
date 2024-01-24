import { useCallback, useContext, useEffect, useMemo } from "react";
import { MapContext, MapContextInterface } from "./MapContextManager";

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
      if (hidden) {
        mapContext.manager?.hideLayer(id);
      } else {
        mapContext.manager?.showHiddenLayer(id);
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
    return hiddenItems;
  }, [mapContext.layerStatesByTocStaticId]);

  return {
    onHiddenItemsChange,
    hiddenItems,
  };
}
