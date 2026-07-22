import { useCallback, useContext, useMemo, useState } from "react";
import {
  LayerTreeContext,
  LegendsContext,
  MapManagerContext,
  SketchLayerContext,
} from "../dataLayers/MapContextManager";
import Legend, { LegendFocusRequest } from "../dataLayers/Legend";
import useCommonLegendProps from "../dataLayers/useCommonLegendProps";

export default function ProjectMapLegend({
  showByDefault = false,
}: {
  showByDefault?: boolean;
  toolbarExpanded?: boolean;
  sidebarOpen?: boolean;
}) {
  const layerTree = useContext(LayerTreeContext);
  const legendsCtx = useContext(LegendsContext);
  const { manager } = useContext(MapManagerContext);
  const { sketchClassLayerStates } = useContext(SketchLayerContext);
  const [legendFocusRequest, setLegendFocusRequest] =
    useState<LegendFocusRequest | null>(null);
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
    {
      layerStatesByTocStaticId: layerTree.layerStatesByTocStaticId,
      legends: legendsCtx.legends,
    },
    manager,
    sketchClassLayerStates
  );

  const onDataTableActivated = useCallback((layerId: string) => {
    setLegendFocusRequest({ layerId, requestId: Date.now() });
  }, []);
  const onLegendFocusComplete = useCallback(() => {
    setLegendFocusRequest(null);
  }, []);

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
        legendFocusRequest={legendFocusRequest}
        onLegendFocusComplete={onLegendFocusComplete}
        onDataTableActivated={onDataTableActivated}
      />
    );
  } else {
    return null;
  }
}
