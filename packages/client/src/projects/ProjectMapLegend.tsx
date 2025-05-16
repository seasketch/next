import { useContext, useMemo } from "react";
import { MapContext } from "../dataLayers/MapContextManager";
import Legend from "../dataLayers/Legend";
import useCommonLegendProps from "../dataLayers/useCommonLegendProps";
import { useMediaQuery } from "beautiful-react-hooks";

export default function ProjectMapLegend({
  showByDefault = false,
  toolbarExpanded = false,
  sidebarOpen = false,
}: {
  showByDefault?: boolean;
  toolbarExpanded?: boolean;
  sidebarOpen?: boolean;
}) {
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

  const isSmall = useMediaQuery("(max-width: 1535px)");

  if (legendProps.items.length > 0) {
    return (
      <Legend
        className={`absolute transition-transform right-8 -top-1.5 m-4 z-[1]`}
        backdropBlur
        maxHeight={500}
        opacity={{}}
        zOrder={{}}
        map={mapContext.manager?.map}
        loading={loading}
        persistedStateKey="project-map-legend"
        {...legendProps}
        defaultToHidden={!showByDefault}
      />
    );
  } else {
    return null;
  }
}
