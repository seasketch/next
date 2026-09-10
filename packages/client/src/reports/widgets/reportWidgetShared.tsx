/**
 * Shared report-widget types and tooltip helpers.
 *
 * Kept out of widgets.tsx so individual widgets can import these without
 * creating an ESM cycle. That cycle left bindings like RasterTimeSeries in
 * the temporal dead zone during CRA Fast Refresh.
 */
import { FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mark, Node } from "prosemirror-model";
import { Pencil2Icon } from "@radix-ui/react-icons";
import * as Popover from "@radix-ui/react-popover";
import { MetricDependency } from "overlay-engine";
import {
  CompatibleSpatialMetricDetailsFragment,
  Geography,
  OverlaySourceDetailsFragment,
  ReportContextSketchClassDetailsFragment,
} from "../../generated/graphql";
import { TooltipPopoverContent } from "../../editor/TooltipMenu";
import useDebounce from "../../useDebounce";

export interface MetricProperties {
  metrics: MetricDependency[];
  componentSettings: Record<string, any>;
  type: string;
}

export interface ReportWidgetProps<T extends Record<string, any>> {
  dependencies: MetricDependency[];
  metrics: CompatibleSpatialMetricDetailsFragment[];
  sources: OverlaySourceDetailsFragment[];
  loading: boolean;
  errors: string[];
  geographies: Pick<Geography, "id" | "name" | "stableIds">[];
  componentSettings: T;
  marks?: Mark[];
  node?: Node;
  sketchClass: Pick<
    ReportContextSketchClassDetailsFragment,
    | "id"
    | "projectId"
    | "geometryType"
    | "form"
    | "clippingGeographies"
    | "project"
    | "validChildren"
  >;
  alternateLanguageSettings?: { [langCode: string]: any };
  lang: string;
}

export type ReportWidget<T extends Record<string, any>> = FC<
  ReportWidgetProps<T>
>;

/**
 * Reusable inline boolean option for widget tooltips.
 */
export function TooltipBooleanConfigurationOption({
  label,
  checked,
  onChange,
  checkboxFirst = false,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** When true, checkbox is shown before the label (better for stacked column toggles). */
  checkboxFirst?: boolean;
}) {
  const input = (
    <input
      type="checkbox"
      className="h-4 w-4 shrink-0 rounded border-gray-300 text-gray-600 focus:ring-slate-500"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
  const labelEl = (
    <span
      className={
        checkboxFirst
          ? "text-gray-800"
          : "font-light text-gray-400 whitespace-nowrap"
      }
    >
      {label}
    </span>
  );
  return (
    <label
      className={`flex items-center gap-2 text-sm text-gray-800 ${
        checkboxFirst ? "" : "w-full justify-between"
      }`}
    >
      {checkboxFirst ? (
        <>
          {input}
          {labelEl}
        </>
      ) : (
        <>
          {labelEl}
          {input}
        </>
      )}
    </label>
  );
}

/**
 * Reusable component for editing table headings/labels.
 * Handles state management, debouncing, and explicit save on popover close.
 */
export function TableHeadingsEditor({
  labelKeys,
  labelDisplayNames,
  componentSettings,
  onUpdate,
}: {
  /**
   * Array of keys in componentSettings that store the label values
   */
  labelKeys: string[];
  /**
   * Array of display names for the labels (used as placeholders and field labels)
   */
  labelDisplayNames: string[];
  /**
   * Current componentSettings object
   */
  componentSettings: Record<string, any>;
  /**
   * Callback to update componentSettings
   */
  onUpdate: (update: { componentSettings: Record<string, any> }) => void;
}) {
  const { t } = useTranslation("admin:reports");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // Stable signature so we don't treat new componentSettings object refs as changes
  // when values are unchanged (avoids update loops when labelKeys change).
  const headingsSettingsSignature =
    labelKeys.join("\0") +
    "\n" +
    labelKeys.map((k) => `${k}=${componentSettings[k] ?? ""}`).join("\n");

  const initialLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    labelKeys.forEach((key) => {
      labels[key] = componentSettings[key] || "";
    });
    return labels;
  }, [headingsSettingsSignature]);

  const [localState, setLocalState] = useState(initialLabels);
  const debouncedLocalState = useDebounce(localState, 100);

  // Sync local state when componentSettings change externally,
  // but only when the popover is closed to avoid overwriting
  // in-progress edits (the debounce round-trip would reset local state)
  useEffect(() => {
    if (!isPopoverOpen) {
      setLocalState(initialLabels);
    }
  }, [initialLabels, isPopoverOpen]);

  // Debounced update of componentSettings. Only persist while the popover
  // is open — changing labelKeys (e.g. hiding a column) must not write
  // back, or a new-key `undefined !== ""` comparison loops with onUpdate.
  useEffect(() => {
    if (!isPopoverOpen) {
      return;
    }
    const hasChanges = labelKeys.some(
      (key) => (debouncedLocalState[key] || "") !== (initialLabels[key] || "")
    );
    if (hasChanges) {
      const updatedSettings: Record<string, any> = {};
      labelKeys.forEach((key) => {
        updatedSettings[key] = debouncedLocalState[key] || undefined;
      });
      onUpdate({ componentSettings: updatedSettings });
    }
  }, [debouncedLocalState, initialLabels, isPopoverOpen, labelKeys, onUpdate]);

  // Explicit save when popover closes
  const handlePopoverOpenChange = (open: boolean) => {
    setIsPopoverOpen(open);
    if (!open) {
      // Popover is closing - ensure all current values are saved
      const updatedSettings: Record<string, any> = { ...componentSettings };
      labelKeys.forEach((key) => {
        updatedSettings[key] = localState[key] || undefined;
      });
      onUpdate({ componentSettings: updatedSettings });
    }
  };

  return (
    <Popover.Root open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none"
        >
          <Pencil2Icon className="w-3 h-3" />
          {/* eslint-disable-next-line i18next/no-literal-string */}
          {"headings"}
        </button>
      </Popover.Trigger>
      <TooltipPopoverContent title={t("Headings")}>
        <div className="space-y-3 px-1">
          {labelKeys.map((key, index) => (
            <div key={key}>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {labelDisplayNames[index]}
              </label>
              <input
                type="text"
                value={localState[key] ?? ""}
                onChange={(e) =>
                  setLocalState((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                }
                placeholder={t(labelDisplayNames[index])}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      </TooltipPopoverContent>
    </Popover.Root>
  );
}
