import { useContext, useMemo } from "react";
import { LayerTreeContext, LegendsContext, MapManagerContext, SketchLayerContext } from "../dataLayers/MapContextManager";
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
  const layerTree = useContext(LayerTreeContext);
  const legendsCtx = useContext(LegendsContext);
  const { manager } = useContext(MapManagerContext);
  const { sketchClassLayerStates } = useContext(SketchLayerContext);
  const loading = useMemo(() => {
    for (const key in layerTree.layerStatesByTocStaticId) {
      if (
        layerTree.layerStatesByTocStaticId[key].loading &&
        layerTree.layerStatesByTocStaticId[key].visible
      ) {
        return true;
      }
    }
    return false;
  }, [layerTree.layerStatesByTocStaticId]);

  const legendProps = useCommonLegendProps(
    { layerStatesByTocStaticId: layerTree.layerStatesByTocStaticId, legends: legendsCtx.legends },
    manager,
    sketchClassLayerStates
  );

  const isSmall = useMediaQuery("(max-width: 1535px)");

  if (legendProps.items.length > 0) {
    return (
      <Legend
        className={`absolute transition-transform right-8 -top-1.5 m-4 z-[1]`}
        backdropBlur
        maxHeight={500}
        opacity={{}}
        zOrder={{}}
        map={manager?.map}
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
