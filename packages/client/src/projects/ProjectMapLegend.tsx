import { useContext, useMemo } from "react";
import { MapContext } from "../dataLayers/MapContextManager";
import Legend from "../dataLayers/Legend";
import useCommonLegendProps from "../dataLayers/useCommonLegendProps";

export default function ProjectMapLegend() {
  const mapContext = useContext(MapContext);
  const loading = useMemo(() => {
    for (const key in mapContext.layerStatesByTocStaticId) {
      if (
        mapContext.layerStatesByTocStaticId[key].loading &&
        mapContext.layerStatesByTocStaticId[key].visible
      ) {
        return true;
      }
    }
    return false;
  }, [mapContext.layerStatesByTocStaticId]);

  const legendProps = useCommonLegendProps(mapContext);

  if (legendProps.items.length > 0) {
    return (
      <Legend
        className="absolute -top-1.5 right-8 m-4 z-20"
        backdropBlur
        maxHeight={500}
        opacity={{}}
        zOrder={{}}
        map={mapContext.manager?.map}
        loading={loading}
        persistedStateKey="project-map-legend"
        {...legendProps}
      />
    );
  } else {
    return null;
  }
}
