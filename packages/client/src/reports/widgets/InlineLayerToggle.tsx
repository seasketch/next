import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import VisibilityCheckboxAnimated from "../../dataLayers/tableOfContents/VisibilityCheckboxAnimated";
import { MapContext } from "../../dataLayers/MapContextManager";
import { ReportWidget } from "./widgets";
import { ReportWidgetTooltipControls } from "../../editor/TooltipMenu";
import { LayerToggleTooltipControlsBase } from "./LayerToggleControls";

type InlineLayerToggleSettings = {
  stableId?: string;
  label?: string;
};

export const InlineLayerToggle: ReportWidget<InlineLayerToggleSettings> = ({
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

  if (!stableId || !mapContext?.manager) {
    return null;
  }

  const handleToggle = () => {
    if (isVisible) {
      mapContext.manager?.hideTocItems?.([stableId]);
    } else {
      mapContext.manager?.showTocItems?.([stableId]);
    }
  };

  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <VisibilityCheckboxAnimated
        id={stableId}
        onClick={handleToggle}
        disabled={false}
        visibility={isVisible}
        loading={isLoading}
        error={error || undefined}
        className="flex-none"
      />
      <button
        type="button"
        onClick={handleToggle}
        className="text-sm text-gray-700 cursor-pointer select-none hover:underline"
      >
        {label}
      </button>
    </span>
  );
};

export const InlineLayerToggleTooltipControls: ReportWidgetTooltipControls = ({
  node,
  onUpdate,
}) => {
  const { t } = useTranslation("admin:reports");
  const componentSettings = node.attrs?.componentSettings || {};

  return (
    <LayerToggleTooltipControlsBase
      componentSettings={componentSettings}
      onUpdate={onUpdate}
      widgetLabel={t("Inline Layer Toggle")}
    />
  );
};
