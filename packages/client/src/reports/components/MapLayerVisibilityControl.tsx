import { useContext, useMemo, useCallback } from "react";
import { LayerTreeContext, MapManagerContext } from "../../dataLayers/MapContextManager";
import { useTranslation } from "react-i18next";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";
import { LayersIcon } from "@radix-ui/react-icons";

interface MapLayerVisibilityControlProps {
  stableId: string | null | undefined;
}

export default function MapLayerVisibilityControl({
  stableId,
}: MapLayerVisibilityControlProps) {
  const mapContext = useContext(LayerTreeContext);
  const { manager } = useContext(MapManagerContext);
  const { t } = useTranslation("reports");

  // Get layer state and compute visibility, loading, and error
  const { isVisible, isLoading, error } = useMemo(() => {
    if (!stableId || !mapContext?.layerStatesByTocStaticId) {
      return { isVisible: false, isLoading: false, error: null };
    }
    const layerState = mapContext.layerStatesByTocStaticId[stableId];
    if (!layerState) {
      return { isVisible: false, isLoading: false, error: null };
    }

    // Layer is visible if visible=true and hidden is not true
    const visible = layerState.visible === true && layerState.hidden !== true;
    const loading = layerState.loading || false;
    // Convert Error object to string if needed
    const errorString = layerState.error
      ? layerState.error instanceof Error
        ? layerState.error.message
        : String(layerState.error)
      : null;

    return { isVisible: visible, isLoading: loading, error: errorString };
  }, [stableId, mapContext?.layerStatesByTocStaticId]);

  const handleToggle = useCallback(() => {
    if (!manager || !stableId) return;
    if (isVisible) {
      manager.hideTocItems([stableId]);
    } else {
      manager.showTocItems([stableId]);
    }
  }, [manager, stableId, isVisible]);

  // Don't render if MapContext is not available or stableId is missing
  if (!manager || !stableId) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2 px-4 py-2 mt-2 -mx-4">
      <LayersIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
      <VisibilityCheckboxAnimated
        id={stableId}
        onClick={handleToggle}
        disabled={false}
        visibility={isVisible}
        loading={isLoading}
        error={error || undefined}
        className="flex-none"
      />
      <label
        className="text-sm text-gray-700 cursor-pointer select-none flex-1"
        onClick={handleToggle}
      >
        {t("Show this layer on the map", {
          defaultValue: "Show this layer on the map",
        })}
      </label>
    </div>
  );
}
