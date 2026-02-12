import { useContext, useMemo, useCallback } from "react";
import {
  LayerTreeContext,
  MapManagerContext,
} from "../../dataLayers/MapContextManager";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";

interface ReportLayerVisibilityCheckboxProps {
  stableId: string;
  className?: string;
}

/**
 * A self-contained layer visibility checkbox for report widgets. Pulls in map
 * context internally so that parent components (e.g. table widgets) don't need
 * to subscribe to layer state updates. When layer visibility changes, only this
 * small component re-renders—not the entire table.
 */
export default function ReportLayerVisibilityCheckbox({
  stableId,
  className,
}: ReportLayerVisibilityCheckboxProps) {
  const mapContext = useContext(LayerTreeContext);
  const { manager } = useContext(MapManagerContext);

  const { isVisible, isLoading, error } = useMemo(() => {
    if (!mapContext?.layerStatesByTocStaticId) {
      return { isVisible: false, isLoading: false, error: null };
    }
    const layerState = mapContext.layerStatesByTocStaticId[stableId];
    if (!layerState) {
      return { isVisible: false, isLoading: false, error: null };
    }
    const visible = layerState.visible === true && layerState.hidden !== true;
    const loading = layerState.loading || false;
    const errorString = layerState.error
      ? layerState.error instanceof Error
        ? layerState.error.message
        : String(layerState.error)
      : null;
    return { isVisible: visible, isLoading: loading, error: errorString };
  }, [stableId, mapContext?.layerStatesByTocStaticId]);

  const handleToggle = useCallback(() => {
    if (!manager) return;
    if (isVisible) {
      manager.hideTocItems?.([stableId]);
    } else {
      manager.showTocItems?.([stableId]);
    }
  }, [manager, stableId, isVisible]);

  return (
    <VisibilityCheckboxAnimated
      id={stableId}
      onClick={handleToggle}
      disabled={!manager}
      visibility={isVisible}
      loading={isLoading}
      error={error || undefined}
      className={className}
    />
  );
}
