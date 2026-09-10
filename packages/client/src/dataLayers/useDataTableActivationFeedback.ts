import { useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../components/Toast";
import { MapManagerContext, MapOverlayContext } from "./MapContextManager";

export type DataTableActivatedEvent = {
  tocStableId: string;
  stableId: string;
  /** True when replacing an already-visualized table, not entering table mode. */
  switchedFromTable?: boolean;
};

/**
 * When a data table is activated (legend picker or map-popup CTA), open the
 * legend and show a short instructional toast. Shared by the public map and
 * the admin overlay editor.
 */
export default function useDataTableActivationFeedback(
  onFocusLegend: (layerId: string) => void
) {
  const { manager } = useContext(MapManagerContext);
  const { tableOfContentsItems } = useContext(MapOverlayContext);
  const { toast } = useToast();
  const { t } = useTranslation("homepage");

  useEffect(() => {
    if (!manager) {
      return;
    }
    const onActivated = (event: DataTableActivatedEvent) => {
      onFocusLegend(event.tocStableId);
      if (event.switchedFromTable) {
        return;
      }
      const item = (tableOfContentsItems || []).find(
        (tocItem) => tocItem.stableId === event.tocStableId
      );
      const table = item?.overlayDataTables?.find(
        (overlayTable) => overlayTable.stableId === event.stableId
      );
      const name = table?.name || t("data table");
      toast(t("Visualizing {{name}}", { name }), {
        description: t("Use the legend to adjust data table settings"),
        duration: 3000,
      });
    };
    manager.on("dataTableActivated", onActivated);
    return () => {
      manager.off("dataTableActivated", onActivated);
    };
  }, [manager, onFocusLegend, tableOfContentsItems, toast, t]);
}
