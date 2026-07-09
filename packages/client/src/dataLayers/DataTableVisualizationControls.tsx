import { useContext, useEffect, useMemo } from "react";
import { CaretDownIcon, CheckIcon } from "@radix-ui/react-icons";
import * as Select from "@radix-ui/react-select";
import { useTranslation } from "react-i18next";
import { ActivatedDataTableContext } from "./ActivatedDataTableContext";
import {
  DATA_TABLE_AGGREGATIONS,
  DataTableAggregation,
  DataTableVisualizationMetadata,
  resolveDataTableVisualizationSettings,
} from "./dataTableQueryApi";
import {
  DataTableColumnStatsState,
  numericColumnNames,
} from "./useDataTableColumnStats";
import clsx from "clsx";

export function DataTableVisualizationLabel({
  op,
  column,
  className,
}: {
  op: DataTableAggregation;
  column?: string;
  className?: string;
}) {
  const { t } = useTranslation("homepage");
  if (op === "count" && !column) {
    return <span className={className}>{t("Count")}</span>;
  }
  if (column) {
    return (
      <span className={className}>
        {t("{{op}} of {{column}}", { op, column })}
      </span>
    );
  }
  return <span className={className}>{op}</span>;
}

/**
 * Compact non-native select styled like the filter value chips.
 * Options can later grow a `description` field without changing the trigger.
 */
function InlineSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: { value: string; label: string; description?: string }[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        aria-label={ariaLabel}
        className={clsx(
          "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border border-gray-300 bg-white px-1.5 py-0.5",
          "text-xs font-medium capitalize text-gray-700",
          "hover:bg-gray-50",
          "focus:outline-none focus:ring-0 focus:border-gray-300",
          "focus-visible:ring-1 focus-visible:ring-primary-500 focus-visible:border-primary-500",
          "data-[state=open]:bg-gray-50"
        )}
      >
        <Select.Value asChild>
          <span className="truncate">{selected?.label || value}</span>
        </Select.Value>
        <Select.Icon className="flex-none text-gray-400">
          <CaretDownIcon className="w-3 h-3" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          align="start"
          className="z-[110] max-h-56 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-black/10 bg-white shadow-lg data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=top]:animate-slideDownAndFade"
        >
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className={clsx(
                  "relative flex cursor-pointer select-none items-start gap-2 rounded px-2 py-1.5 pr-7 text-xs outline-none",
                  "text-gray-800 data-[highlighted]:bg-gray-50 data-[state=checked]:bg-primary-50/60"
                )}
              >
                <div className="min-w-0 flex-1">
                  <Select.ItemText>
                    <span className="block truncate font-medium capitalize">
                      {option.label}
                    </span>
                  </Select.ItemText>
                  {option.description && (
                    <span className="mt-0.5 block text-[10px] leading-snug text-gray-500">
                      {option.description}
                    </span>
                  )}
                </div>
                <Select.ItemIndicator className="absolute right-2 top-1.5 text-primary-600">
                  <CheckIcon className="w-3.5 h-3.5" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

/**
 * Inline column/op controls for an activated data table visualization.
 * Renders as a compact subheading, e.g. "▼ mean of ▼ count".
 */
export default function DataTableVisualizationControls({
  layerId,
  metadata,
  columnStatsState,
  metadataLoading,
}: {
  layerId: string;
  metadata: DataTableVisualizationMetadata;
  columnStatsState?: DataTableColumnStatsState;
  metadataLoading?: boolean;
}) {
  const { t } = useTranslation("homepage");
  const { userVisualizationChoices, setUserVisualizationChoice } = useContext(
    ActivatedDataTableContext
  );

  const allowedColumns = useMemo(
    () => (metadata.visualizationColumns || []).filter(Boolean) as string[],
    [metadata.visualizationColumns]
  );
  const allowedOps = useMemo(
    () =>
      (metadata.visualizationOps || []).filter(
        Boolean
      ) as DataTableAggregation[],
    [metadata.visualizationOps]
  );
  const columnStats = columnStatsState?.columnStats;
  const error = columnStatsState?.error;
  const loading = Boolean(
    metadataLoading ||
      columnStatsState?.loading ||
      (metadata.columnStatsUrl && !columnStatsState)
  );

  const columnChoices = useMemo(
    () =>
      allowedColumns.length > 0
        ? allowedColumns
        : numericColumnNames(columnStats),
    [allowedColumns, columnStats]
  );
  const opChoices =
    allowedOps.length > 0 ? allowedOps : DATA_TABLE_AGGREGATIONS;

  const userChoice = useMemo(
    () => userVisualizationChoices[layerId] || {},
    [layerId, userVisualizationChoices]
  );
  const resolved = resolveDataTableVisualizationSettings(metadata, userChoice);
  const defaultColumn = resolved.column || columnChoices[0];
  const effectiveColumn = userChoice.column || defaultColumn;
  const showColumn = resolved.op !== "count" || Boolean(effectiveColumn);

  useEffect(() => {
    if (loading || error || !effectiveColumn) {
      return;
    }
    if (
      userChoice.column === effectiveColumn &&
      userChoice.op === resolved.op
    ) {
      return;
    }
    setUserVisualizationChoice(layerId, {
      ...userChoice,
      column: effectiveColumn,
      op: resolved.op,
      filters: userChoice.filters,
    });
  }, [
    effectiveColumn,
    error,
    layerId,
    loading,
    resolved.op,
    setUserVisualizationChoice,
    userChoice,
  ]);

  const showColumnSelect = columnChoices.length > 1;
  const showOpSelect = opChoices.length > 1;
  const opOptions = opChoices.map((op) => ({ value: op, label: op }));
  const columnOptions = columnChoices.map((column) => ({
    value: column,
    label: column,
  }));

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-500">
        <span>{t("Showing")}</span>
        {showOpSelect ? (
          <InlineSelect
            ariaLabel={t("Aggregation")}
            value={resolved.op}
            options={opOptions}
            onChange={(value) =>
              setUserVisualizationChoice(layerId, {
                ...userChoice,
                op: value as DataTableAggregation,
              })
            }
          />
        ) : (
          <span className="font-medium capitalize text-gray-700">
            {resolved.op}
          </span>
        )}
        {showColumn && (
          <>
            <span className="text-gray-400">{t("of")}</span>
            {showColumnSelect ? (
              <InlineSelect
                ariaLabel={t("Visualize column")}
                value={effectiveColumn || ""}
                options={columnOptions}
                onChange={(value) =>
                  setUserVisualizationChoice(layerId, {
                    ...userChoice,
                    column: value,
                  })
                }
              />
            ) : (
              <span className="font-medium text-gray-700">
                {effectiveColumn}
              </span>
            )}
          </>
        )}
      </div>
      {allowedColumns.length === 0 && loading && (
        <p className="text-xs text-gray-400 italic">
          {t("Loading column metadata...")}
        </p>
      )}
      {allowedColumns.length === 0 && !loading && error && (
        <p className="text-xs text-red-500">
          {t("Unable to load column metadata.")}
        </p>
      )}
      {allowedColumns.length === 0 &&
        !loading &&
        !error &&
        !metadata.columnStatsUrl && (
          <p className="text-xs text-gray-400 italic">
            {t("Column metadata is not available for this table.")}
          </p>
        )}
      {allowedColumns.length === 0 &&
        !loading &&
        !error &&
        metadata.columnStatsUrl &&
        columnChoices.length === 0 && (
          <p className="text-xs text-gray-400 italic">
            {t("No numeric columns available to visualize.")}
          </p>
        )}
    </div>
  );
}
