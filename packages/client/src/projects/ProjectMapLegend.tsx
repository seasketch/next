import { useContext, useMemo } from "react";
import { MapContext } from "../dataLayers/MapContextManager";
import Legend, { LegendItem } from "../dataLayers/Legend";

export default function ProjectMapLegend() {
  const mapContext = useContext(MapContext);
  const legendItems = useMemo(
    () =>
      Object.values(mapContext?.legends || {}).filter(
        (l) => !!l
      ) as LegendItem[],
    [mapContext.legends]
  );
  const loading = useMemo(() => {
    for (const key in mapContext.layerStatesByTocStaticId) {
      if (mapContext.layerStatesByTocStaticId[key].loading) {
        return true;
      }
    }
    return false;
  }, [mapContext.layerStatesByTocStaticId]);
  if (legendItems.length > 0) {
    return (
      <Legend
        className="absolute -top-1.5 right-8 m-4 z-20"
        items={legendItems}
        hiddenItems={[]}
        backdropBlur
        maxHeight={500}
        opacity={{}}
        zOrder={{}}
        map={mapContext.manager?.map}
        loading={loading}
        persistedStateKey="project-map-legend"
      />
    );
  } else {
    return null;
  }
}
