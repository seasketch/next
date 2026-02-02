import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LayersIcon } from "@radix-ui/react-icons";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";
import { MapContext } from "../../dataLayers/MapContextManager";
import { ReportWidget } from "./widgets";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { LayerToggleTooltipControlsBase } from "./LayerToggleControls";

type BlockLayerToggleSettings = {
  stableId?: string;
  label?: string;
};

export const BlockLayerToggle: ReportWidget<BlockLayerToggleSettings> = ({
  componentSettings,
  sources,
}) => {
  const mapContext = useContext(MapContext);
  const { t } = useTranslation("reports");
  const stableId = componentSettings?.stableId;

  const overlayTitle = useMemo(() => {
    const match = sources.find(
      (s) => s.tableOfContentsItem?.stableId === stableId
    );
    return match?.tableOfContentsItem?.title;
  }, [sources, stableId]);

  const label =
    componentSettings?.label || overlayTitle || t("Show this layer on the map");

  const { isVisible, isLoading, error } = useMemo(() => {
    if (!stableId || !mapContext?.layerStatesByTocStaticId) {
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

  if (!stableId) {
    return null;
  }

  const handleToggle = () => {
    const mgr: any = (mapContext as any)?.manager;
    if (!mgr) return;
    if (isVisible) {
      mgr.hideTocItems([stableId]);
    } else {
      mgr.showTocItems([stableId]);
    }
  };

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
        {label}
      </label>
    </div>
  );
};

export const BlockLayerToggleTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
}) => {
  const { t } = useTranslation("admin:reports");
  const componentSettings = node.attrs?.componentSettings || {};
  return (
    <LayerToggleTooltipControlsBase
      componentSettings={componentSettings}
      onUpdate={onUpdate}
      widgetLabel={t("Block Layer Toggle")}
    />
  );
};
