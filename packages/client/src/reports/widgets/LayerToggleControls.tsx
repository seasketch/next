import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LabeledDropdown } from "./LabeledDropdown";
import { useReportContext } from "../ReportContext";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
} from "../../editor/TooltipMenu";
import * as Popover from "@radix-ui/react-popover";
import { Pencil2Icon } from "@radix-ui/react-icons";
import getSlug from "../../getSlug";
import { useOverlaysForReportLayerTogglesQuery } from "../../generated/graphql";

type LayerToggleSettings = {
  stableId?: string;
  label?: string;
};

export function useOverlayOptionsForLayerToggle(t: (k: string) => string) {
  const reportContext = useReportContext();
  const overlaysQuery = useOverlaysForReportLayerTogglesQuery({
    variables: { slug: getSlug() },
  });

  const overlayOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    const items =
      overlaysQuery.data?.projectBySlug?.draftTableOfContentsItems || [];
    for (const item of items) {
      if (!item?.stableId || seen.has(item.stableId)) continue;
      seen.add(item.stableId);
      options.push({
        value: item.stableId,
        label: item.title || t("Unknown layer"),
      });
    }
    if (!options.length) {
      const allSources = [
        ...(reportContext.overlaySources || []),
        ...(reportContext.adminSources || []),
      ];
      for (const s of allSources) {
        const sid = s.tableOfContentsItem?.stableId;
        if (!sid || seen.has(sid)) continue;
        seen.add(sid);
        options.push({
          value: sid,
          label: s.tableOfContentsItem?.title || t("Unknown layer"),
        });
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [
    overlaysQuery.data?.projectBySlug?.draftTableOfContentsItems,
    reportContext.overlaySources,
    reportContext.adminSources,
    t,
  ]);

  return overlayOptions;
}

export function LayerToggleTooltipControlsBase({
  componentSettings,
  onUpdate,
  widgetLabel,
}: {
  componentSettings: LayerToggleSettings;
  onUpdate: (update: { componentSettings: Record<string, any> }) => void;
  widgetLabel: string;
}): ReturnType<ReportWidgetTooltipControls> {
  const { t } = useTranslation("admin:reports");
  const overlayOptions = useOverlayOptionsForLayerToggle(t);
  const stableId = componentSettings?.stableId;
  const label = componentSettings?.label;

  const currentLabel =
    label || overlayOptions.find((o) => o.value === stableId)?.label || "";

  return (
    <div className="flex flex-wrap gap-3 items-center text-sm text-gray-800">
      <LabeledDropdown
        label={t("layer")}
        value={stableId || ""}
        options={overlayOptions}
        onChange={(value) => {
          const defaultLabel =
            overlayOptions.find((o) => o.value === value)?.label || "";
          onUpdate({
            componentSettings: {
              ...componentSettings,
              stableId: value,
              label: defaultLabel,
            },
          });
        }}
        getDisplayLabel={(selected) => selected?.label || ""}
      />
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
          >
            <Pencil2Icon className="w-3 h-3" />
            {t("label")}
          </button>
        </Popover.Trigger>
        <Popover.Content
          side="top"
          sideOffset={6}
          className="bg-white text-gray-900 border border-black/20 rounded shadow-lg px-2 py-2 z-50 w-64"
        >
          <label className="text-xs text-gray-500">{t("Label")}</label>
          <input
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            type="text"
            value={currentLabel}
            onChange={(e) =>
              onUpdate({
                componentSettings: {
                  ...componentSettings,
                  label: e.target.value,
                },
              })
            }
          />
        </Popover.Content>
      </Popover.Root>
      <TooltipMorePopover>
        <div className="flex">
          <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
            {t("Widget")}
          </span>
          <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
            {widgetLabel}
          </span>
        </div>
      </TooltipMorePopover>
    </div>
  );
}
