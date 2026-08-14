import { CSSProperties, Fragment, useContext, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  MetricDependency,
  Metric,
  OusDemographicsMetric,
  OusDemographicsMetricValue,
  subjectIsFragment,
  summarizeOusDemographicsValue,
  combineMetricsForFragments,
  OUS_DEMOGRAPHICS_DEFAULT_GROUP_BY,
  OUS_DEMOGRAPHICS_ROLLUP_KEY,
} from "overlay-engine";
import {
  ReportWidget,
  TableHeadingsEditor,
  TooltipBooleanConfigurationOption,
} from "./widgets";
import {
  ReportWidgetTooltipControls,
  TooltipMorePopover,
  TooltipPopoverContent,
} from "../../editor/TooltipMenu";
import { LabeledDropdown } from "./LabeledDropdown";
import { MetricLoadingDots } from "../components/MetricLoadingDots";
import { useOverlaySources } from "../hooks/useOverlaySources";
import {
  CompatibleSpatialMetricDetailsFragment,
  OverlaySourceDetailsFragment,
  SpatialMetricState,
} from "../../generated/graphql";
import { PaginationFooter, PaginationSetting } from "./Pagination";
import { usePagination } from "../hooks/usePagination";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { GeostatsLayer, isGeostatsLayer } from "@seasketch/geostats-types";
import CollectionExpandableName from "./collection/CollectionExpandableName";
import SketchOverlapHint from "./collection/SketchOverlapHint";
import { useCollectionSketchExpand } from "./collection/useCollectionSketchExpand";
import { dedupeCompleteSpatialMetrics } from "./collection/dedupeMetrics";
import {
  overlapPartnerSketchNamesForBucket,
  ClassRowSketchContribution,
} from "./collection/sketchContributions";
import { ReportUIStateContext } from "../context/ReportUIStateContext";
import { MetricSubjectFragment } from "overlay-engine";
import { TFunction } from "i18next";

export type OusDemographicsTotalMode = "representedInSector" | "participants";

export type OusDemographicsTableSettings = {
  /** Heading for the group column (sector / gear type / village). */
  groupLabel?: string;
  /** Heading for the "People Using Ocean Within Plan" column. */
  withinLabel?: string;
  /** Heading for the "Total People Represented In Survey" column. */
  totalLabel?: string;
  /** Heading for the percent column. */
  percentLabel?: string;
  /** Label for the overall rollup row. */
  rollupLabel?: string;
  /**
   * What the Total column represents.
   *
   * - `representedInSector` (default): sum of clamped per-respondent
   *   `represented_in_sector` values over all respondents in the group.
   *   Within-plan values are exact and a percent can be shown.
   * - `participants`: sum of whole-response `participants` counts, once per
   *   respondent. Use for respondent-level groupings such as village, where
   *   per-group representation is a lower bound — within-plan values are
   *   displayed with a "+" suffix and the percent column is hidden.
   */
  totalMode?: OusDemographicsTotalMode;
  showPercentColumn?: boolean;
  /** Overall rollup row. Off by default. */
  showTotalRow?: boolean;
  sortBy?: "within" | "name";
  rowsPerPage?: number;
};

type OusDemographicsRow = {
  key: string;
  label: string;
  within: number;
  total: number;
};

/**
 * Default column headings from the original OUS reports. Both totaling
 * methods share the same labels; participants mode simply hides the
 * percent column.
 */
function defaultOusHeadingLabels(t: TFunction) {
  return {
    groupLabel: t("Group"),
    withinLabel: t("People Using Ocean Within Plan"),
    totalLabel: t("Total People Represented In Survey"),
    percentLabel: t("% People Using Ocean Within Plan"),
    rollupLabel: t("Total"),
  };
}

function completedOusFragmentMetrics(
  metrics: CompatibleSpatialMetricDetailsFragment[],
  source: OverlaySourceDetailsFragment | undefined
): CompatibleSpatialMetricDetailsFragment[] {
  return dedupeCompleteSpatialMetrics(metrics).filter(
    (m) =>
      m.type === "ous_demographics" &&
      m.state === SpatialMetricState.Complete &&
      subjectIsFragment(m.subject) &&
      (!source?.sourceUrl || m.sourceUrl === source.sourceUrl)
  );
}

function combineOusMetrics(
  fragmentMetrics: CompatibleSpatialMetricDetailsFragment[]
): OusDemographicsMetricValue {
  const combined = combineMetricsForFragments<OusDemographicsMetric>(
    fragmentMetrics as Pick<Metric, "type" | "value">[],
    "ous_demographics"
  );
  return combined.value;
}

/**
 * Per-sketch within-plan contributions for a single group row. Respondent
 * dedup happens inside combineMetricsForFragments, so each child sketch's
 * value is exact — but the same respondent may appear under multiple child
 * sketches, so sketch rows can sum to more than the collection heading.
 */
function ousSketchContributions(opts: {
  fragmentMetrics: CompatibleSpatialMetricDetailsFragment[];
  groupKey: string;
  childSketchIds: number[];
  sketchNameById: Map<number, string>;
  t: TFunction;
}): ClassRowSketchContribution[] {
  const { fragmentMetrics, groupKey, childSketchIds, sketchNameById, t } = opts;
  const collectionSketchIds =
    childSketchIds.length > 0 ? new Set(childSketchIds) : undefined;
  const rows: ClassRowSketchContribution[] = [];
  for (const sketchId of childSketchIds) {
    const bucket = fragmentMetrics.filter((m) =>
      (m.subject as MetricSubjectFragment).sketches.includes(sketchId)
    );
    const value = combineOusMetrics(bucket);
    const summary = summarizeOusDemographicsValue(value);
    const within = summary[groupKey]?.representedInSector ?? 0;
    const overlapPartnerSketchNames = overlapPartnerSketchNamesForBucket(
      sketchId,
      bucket,
      sketchNameById,
      t,
      collectionSketchIds
    );
    rows.push({
      sketchId,
      sketchName:
        sketchNameById.get(sketchId) ?? t("Sketch #{{id}}", { id: sketchId }),
      primaryValue: within,
      fractionOfGeography: 0,
      hasOverlap: overlapPartnerSketchNames.length > 0,
      overlapPartnerSketchNames,
    });
  }
  rows.sort((a, b) =>
    b.primaryValue !== a.primaryValue
      ? b.primaryValue - a.primaryValue
      : a.sketchName.localeCompare(b.sketchName)
  );
  return rows;
}

export const OusDemographicsTable: ReportWidget<
  OusDemographicsTableSettings
> = ({
  metrics,
  componentSettings,
  sources,
  loading,
  sketchClass,
  dependencies,
}) => {
  const { t } = useTranslation("reports");
  const totalMode = componentSettings.totalMode || "representedInSector";
  const sortBy = componentSettings.sortBy || "name";
  const rowsPerPage = componentSettings.rowsPerPage ?? 15;
  // In participants mode within-plan values are lower bounds ("+"), so a
  // percentage against the participants total would be misleading.
  const showPercentColumn =
    (componentSettings.showPercentColumn ?? true) &&
    totalMode !== "participants";
  const showTotalRow = componentSettings.showTotalRow ?? false;
  const plusSuffix = totalMode === "participants";

  const defaults = defaultOusHeadingLabels(t);
  const groupLabel = componentSettings.groupLabel || defaults.groupLabel;
  const withinLabel = componentSettings.withinLabel || defaults.withinLabel;
  const totalLabel = componentSettings.totalLabel || defaults.totalLabel;
  const percentLabel = componentSettings.percentLabel || defaults.percentLabel;
  const rollupLabel = componentSettings.rollupLabel || defaults.rollupLabel;

  const { printing } = useContext(ReportUIStateContext);

  const dependency = useMemo(
    () => dependencies.find((d) => d.type === "ous_demographics"),
    [dependencies]
  );
  const source = useMemo(
    () => sources.find((s) => s.stableId === dependency?.stableId),
    [sources, dependency]
  );

  const fragmentMetrics = useMemo(
    () => completedOusFragmentMetrics(metrics, source),
    [metrics, source]
  );

  const { combinedValue, ready } = useMemo(() => {
    if (loading || fragmentMetrics.length === 0) {
      return { combinedValue: undefined, ready: false };
    }
    return { combinedValue: combineOusMetrics(fragmentMetrics), ready: true };
  }, [loading, fragmentMetrics]);

  const { rows, rollupRow } = useMemo(() => {
    if (!ready || !combinedValue) {
      return {
        rows: [] as OusDemographicsRow[],
        rollupRow: undefined as OusDemographicsRow | undefined,
      };
    }
    const summaries = summarizeOusDemographicsValue(combinedValue);
    const totals = combinedValue.totals || {};
    let rows: OusDemographicsRow[] = Object.keys(totals)
      .filter((key) => key !== OUS_DEMOGRAPHICS_ROLLUP_KEY)
      .map((key) => ({
        key,
        label: key,
        within: summaries[key]?.representedInSector ?? 0,
        total: totals[key]?.[totalMode] ?? 0,
      }));
    if (sortBy === "name") {
      rows = rows.sort((a, b) => a.label.localeCompare(b.label));
    } else {
      rows = rows.sort((a, b) => b.within - a.within);
    }
    const rollupTotals = totals[OUS_DEMOGRAPHICS_ROLLUP_KEY];
    const rollupRow: OusDemographicsRow | undefined =
      showTotalRow && rollupTotals
        ? {
            key: OUS_DEMOGRAPHICS_ROLLUP_KEY,
            label: rollupLabel,
            within:
              summaries[OUS_DEMOGRAPHICS_ROLLUP_KEY]?.representedInSector ?? 0,
            total: rollupTotals[totalMode] ?? 0,
          }
        : undefined;
    return { rows, rollupRow };
  }, [ready, combinedValue, totalMode, sortBy, rollupLabel, showTotalRow]);

  const {
    isCollection,
    sketchNameById,
    childSketchIds,
    toggleRow,
    hideCaretExpandTooltip,
    isSketchBreakdownExpanded,
  } = useCollectionSketchExpand(sketchClass, {
    forceAllExpanded: printing,
  });

  const sketchLinesByRowKey = useMemo(() => {
    const map = new Map<string, ClassRowSketchContribution[]>();
    if (!isCollection || !ready) {
      return map;
    }
    for (const row of [...rows, ...(rollupRow ? [rollupRow] : [])]) {
      map.set(
        row.key,
        ousSketchContributions({
          fragmentMetrics,
          groupKey: row.key,
          childSketchIds,
          sketchNameById,
          t,
        })
      );
    }
    return map;
  }, [
    isCollection,
    ready,
    rows,
    rollupRow,
    fragmentMetrics,
    childSketchIds,
    sketchNameById,
    t,
  ]);

  const {
    currentPage,
    setCurrentPage,
    paginatedItems: paginatedRows,
    paddingRowsCount,
    showPagination,
    totalPages,
    totalRows,
    pageBounds,
  } = usePagination(rows, rowsPerPage);

  if (ready && rows.length === 0) {
    return (
      <div className="mt-3 border border-black/10 rounded bg-gray-50 px-3 py-2 text-gray-600 text-sm">
        <Trans ns="reports">No survey responses found.</Trans>
      </div>
    );
  }

  /**
   * Same column tracks for header and body. Report cards are ~440px, so
   * long uppercase headings wrap — but only at spaces. Numeric columns get
   * equal leftover width; without the percent column they get more so
   * phrases like "REPRESENTED IN SURVEY" can sit on one line.
   *
   * Inline wrap styles beat ProseMirror's inherited `white-space:
   * break-spaces` / `overflow-wrap: break-word`, which otherwise split
   * headings mid-word once a column gets tight.
   */
  const gridTemplateColumns = showPercentColumn
    ? "minmax(0, 1.15fr) repeat(3, minmax(0, 1fr))"
    : "minmax(0, 0.8fr) repeat(2, minmax(0, 1fr))";
  const headerWrapStyle: CSSProperties = {
    overflowWrap: "normal",
    wordBreak: "normal",
    whiteSpace: "normal",
  };
  const rowGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns,
    alignItems: "center",
  };

  const renderWithin = (within: number) => {
    if (!ready) {
      return <MetricLoadingDots />;
    }
    return (
      <>
        {within.toLocaleString()}
        {plusSuffix && within > 0 ? "+" : ""}
      </>
    );
  };

  const renderPercent = (within: number, total: number) => {
    if (!ready) {
      return <MetricLoadingDots />;
    }
    if (!(total > 0)) {
      // eslint-disable-next-line i18next/no-literal-string
      return <>{"—"}</>;
    }
    // eslint-disable-next-line i18next/no-literal-string
    return <>{`${((within / total) * 100).toFixed(1)}%`}</>;
  };

  // eslint-disable-next-line i18next/no-literal-string
  const numericCellClass =
    "min-w-0 px-1.5 py-2 text-right text-gray-900 tabular-nums text-sm whitespace-nowrap";
  // eslint-disable-next-line i18next/no-literal-string
  const numericHeaderClass =
    "min-w-0 px-1.5 py-2 text-right text-xs font-semibold uppercase leading-snug text-gray-600 text-balance";

  const renderRow = (row: OusDemographicsRow, isRollup: boolean) => {
    const expanded = isSketchBreakdownExpanded(row.key);
    const sketchLines = sketchLinesByRowKey.get(row.key) ?? [];
    return (
      <Fragment key={row.key}>
        <div
          className={`hover:bg-gray-50 ${
            isRollup ? "bg-gray-50 font-medium" : ""
          } ${ready && row.within === 0 && !isRollup ? "opacity-50" : ""}`}
          style={rowGridStyle}
        >
          <div
            className="min-w-0 px-2 py-2 text-left text-gray-800 text-sm"
            style={headerWrapStyle}
          >
            {isCollection ? (
              <CollectionExpandableName
                displayLabel={row.label}
                truncateRowLabels={false}
                expanded={expanded}
                onToggle={() => toggleRow(row.key)}
                loading={loading}
                isCollection={isCollection}
                caretTooltipEnabled={!hideCaretExpandTooltip}
                caretTooltipLabel={t("Expand sketch details")}
                expandAriaLabelExpanded={t(
                  "Collapse sketch breakdown for {{name}}",
                  { name: row.label }
                )}
                expandAriaLabelCollapsed={t(
                  "Expand sketch breakdown for {{name}}",
                  { name: row.label }
                )}
              />
            ) : (
              row.label
            )}
          </div>
          <div className={numericCellClass}>{renderWithin(row.within)}</div>
          <div className={`${numericCellClass} text-gray-700`}>
            {ready ? row.total.toLocaleString() : <MetricLoadingDots />}
          </div>
          {showPercentColumn && (
            <div className={`${numericCellClass} text-gray-700`}>
              {renderPercent(row.within, row.total)}
            </div>
          )}
        </div>
        {isCollection && expanded && sketchLines.length === 0 && (
          <div className="bg-slate-100 px-3 py-2.5 text-sm italic text-gray-600">
            {t("No individual sketches contributed to this category.")}
          </div>
        )}
        {isCollection &&
          expanded &&
          sketchLines.map((sk) => (
            <div
              key={`${row.key}-sketch-${sk.sketchId}`}
              className="bg-slate-100 hover:bg-slate-200/30"
              style={rowGridStyle}
            >
              <div className="min-w-0 px-3 py-2 text-left text-sm text-gray-800">
                <span className="inline-flex min-w-0 items-center gap-1">
                  <span className="min-w-0">{sk.sketchName}</span>
                  <SketchOverlapHint
                    hasOverlap={sk.hasOverlap}
                    sketchDisplayName={sk.sketchName}
                    overlapPartnerSketchNames={sk.overlapPartnerSketchNames}
                  />
                </span>
              </div>
              <div className={numericCellClass}>
                {renderWithin(sk.primaryValue)}
              </div>
              <div aria-hidden />
              {showPercentColumn && <div aria-hidden />}
            </div>
          ))}
      </Fragment>
    );
  };

  const loadingCell = (
    <span className="inline-block">
      <MetricLoadingDots />
    </span>
  );

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="mt-3 rounded-md border border-gray-200 shadow-sm w-full max-w-full bg-white overflow-hidden">
        <div
          className="bg-gray-50 border-b border-gray-200"
          style={{ ...rowGridStyle, alignItems: "end" }}
        >
          <div className="min-w-0 px-2 py-2 text-left text-xs font-semibold uppercase leading-snug text-gray-600">
            {groupLabel}
          </div>
          <div className={numericHeaderClass} style={headerWrapStyle}>
            {withinLabel}
          </div>
          <div className={numericHeaderClass} style={headerWrapStyle}>
            {totalLabel}
          </div>
          {showPercentColumn && (
            <div className={numericHeaderClass} style={headerWrapStyle}>
              {percentLabel}
            </div>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {ready
            ? paginatedRows.map((row) => renderRow(row, false))
            : [0, 1, 2].map((i) => (
                <div key={i} style={rowGridStyle}>
                  <div className="px-3 py-2 text-left text-sm">
                    {loadingCell}
                  </div>
                  <div className={numericCellClass}>{loadingCell}</div>
                  <div className={numericCellClass}>{loadingCell}</div>
                  {showPercentColumn && (
                    <div className={numericCellClass}>{loadingCell}</div>
                  )}
                </div>
              ))}
          {ready &&
            paddingRowsCount > 0 &&
            Array.from({ length: paddingRowsCount }).map((_, i) => (
              <div
                key={`padding-${i}`}
                className="bg-gray-50/30 px-3 py-2 text-sm"
                aria-hidden
              >
                <span className="invisible">
                  {
                    // eslint-disable-next-line i18next/no-literal-string
                    "."
                  }
                </span>
              </div>
            ))}
          {ready && rollupRow && renderRow(rollupRow, true)}
        </div>
        {showPagination && (
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            totalRows={totalRows}
            pageBounds={pageBounds}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </Tooltip.Provider>
  );
};

function stringColumnsFromGeostats(
  source: OverlaySourceDetailsFragment | null
): string[] {
  const layer = source?.geostats?.layers?.[0];
  if (!isGeostatsLayer(layer)) {
    return [];
  }
  return ((layer as GeostatsLayer).attributes || [])
    .filter((a) => a.type === "string")
    .map((a) => a.attribute);
}

/**
 * Popover with detailed admin guidance. This widget encodes survey-specific
 * methodology, so each configuration option gets an explanation here.
 */
function OusDemographicsHelpPopover() {
  const { t } = useTranslation("admin:reports");
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="h-6 bg-transparent text-gray-900 text-sm px-1 border-none rounded inline-flex items-center gap-1.5 hover:bg-gray-100 active:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100 focus:outline-none whitespace-nowrap"
          title={t("About this widget")}
        >
          <InfoCircledIcon className="w-3.5 h-3.5" />
          {t("help")}
        </button>
      </Popover.Trigger>
      <TooltipPopoverContent title={t("OUS Demographics Table")}>
        <div className="px-1 space-y-3 text-xs text-gray-700 max-w-xs max-h-96 overflow-y-auto">
          <p>
            <Trans ns="admin:reports">
              Reports how many people from an Ocean Use Survey use the ocean
              within the plan, grouped by a column such as sector, gear type, or
              village.
            </Trans>
          </p>
          <p>
            <Trans ns="admin:reports">
              <b>Required columns.</b> The source must include{" "}
              <code>response_id</code>, <code>participants</code>,{" "}
              <code>represented_in_sector</code>, and the grouping column (
              <code>sector</code> by default).
            </Trans>
          </p>
          <p>
            <Trans ns="admin:reports">
              <b>Two counts on every response.</b>{" "}
              <code>participants</code> is how many people the whole response
              represents ("my answers stand for 20 people").{" "}
              <code>represented_in_sector</code> is how many of those people a
              given sector polygon represents. A respondent may draw many
              shapes. For each group, the metric keeps the largest sector count
              and never lets it exceed <code>participants</code>. The same
              person is counted only once in a row.
            </Trans>
          </p>
          <p>
            <Trans ns="admin:reports">
              <b>Who is within the plan.</b> A response counts if any of its
              sector polygons overlap the sketch. Geographies are not used.
              Every group in the dataset is listed, including those with no
              overlap (shown as zero).
            </Trans>
          </p>
          <p>
            <Trans ns="admin:reports">
              <b>Group by.</b> Any text column can be used for the rows.
              Comma-separated values are <i>not</i> split. For gears, start from
              Fishing shapes, split <code>fishing_method</code> into one row per
              gear, copy the polygon and <code>represented_in_sector</code>{" "}
              (do not divide it), and add a single-value <code>gear_type</code>{" "}
              column. Upload that layer as its own source.
            </Trans>
          </p>
          <p>
            <Trans ns="admin:reports">
              <b>Total column.</b> The within-plan column always uses
              overlapping <code>represented_in_sector</code> counts.
              "Sector-specific polygons" uses that same count for the whole
              survey, so a percent is meaningful. "Entire group response" uses{" "}
              <code>participants</code> instead — better for village-style
              groupings. Within-plan values are then a lower bound (shown with
              +) and the percent column is hidden.
            </Trans>
          </p>
        </div>
      </TooltipPopoverContent>
    </Popover.Root>
  );
}

export const OusDemographicsTableTooltipControls: ReportWidgetTooltipControls =
  ({ node, onUpdate, onUpdateDependencyParameters }) => {
    const { t } = useTranslation("admin:reports");
    const dependencies = node.attrs?.metrics as MetricDependency[] | undefined;

    const settings: OusDemographicsTableSettings = useMemo(
      () => node.attrs?.componentSettings || {},
      [node.attrs?.componentSettings]
    );

    const totalMode = settings.totalMode || "representedInSector";
    const sortBy = settings.sortBy || "name";
    const rowsPerPage = settings.rowsPerPage ?? 15;

    const { filteredSources: sources } = useOverlaySources(dependencies || []);
    const source = sources[0] || null;

    const groupBy =
      (dependencies || []).find((d) => d.type === "ous_demographics")
        ?.parameters?.groupBy || OUS_DEMOGRAPHICS_DEFAULT_GROUP_BY;

    const groupByOptions = useMemo(() => {
      const columns = stringColumnsFromGeostats(source);
      // Exclude bookkeeping columns that would make meaningless groupings.
      const excluded = new Set<string>(["response_id"]);
      const options = columns
        .filter((c) => !excluded.has(c))
        .map((c) => ({ value: c, label: c }));
      if (groupBy && !options.some((o) => o.value === groupBy)) {
        options.push({ value: groupBy, label: groupBy });
      }
      return options;
    }, [source, groupBy]);

    const handleUpdate = (patch: Partial<OusDemographicsTableSettings>) => {
      onUpdate({
        componentSettings: {
          ...settings,
          ...patch,
        },
      });
    };

    const headingDefaults = useMemo(() => defaultOusHeadingLabels(t), [t]);
    const headingLabelKeys = useMemo(
      () => [
        "groupLabel",
        "withinLabel",
        "totalLabel",
        ...(totalMode === "participants" ? [] : ["percentLabel"]),
        ...(settings.showTotalRow ? ["rollupLabel"] : []),
      ],
      [totalMode, settings.showTotalRow]
    );
    const headingLabelDisplayNames = useMemo(
      () => [
        headingDefaults.groupLabel,
        headingDefaults.withinLabel,
        headingDefaults.totalLabel,
        ...(totalMode === "participants" ? [] : [headingDefaults.percentLabel]),
        ...(settings.showTotalRow ? [t("Total row")] : []),
      ],
      [headingDefaults, totalMode, settings.showTotalRow, t]
    );

    const totalModeOptions = [
      {
        value: "representedInSector",
        label: t("Sector-specific polygons"),
        description: t(
          "Uses the same sector-polygon counts as the within-plan column, totaled across the whole survey. Counts are exact, and a percent can be shown."
        ),
      },
      {
        value: "participants",
        label: t("Entire group response (+)"),
        description: t(
          "Uses the full person count from each response. Best when grouping by village or similar. The within-plan column is then a lower bound (shown with +), and the percent column is hidden."
        ),
      },
    ];

    const sortOptions = [
      { value: "within", label: t("People within plan") },
      { value: "name", label: t("Name") },
    ];

    return (
      <div className="flex gap-3 items-center text-sm text-gray-800">
        <LabeledDropdown
          label={t("Group by")}
          value={groupBy}
          options={groupByOptions}
          onChange={(val) => {
            onUpdateDependencyParameters((dependency) => ({
              ...dependency.parameters,
              groupBy: val,
            }));
          }}
          title={
            <div className="max-w-[220px] text-xs font-normal normal-case text-gray-500">
              {t(
                "Text column used for table rows. Multi-value columns are not split — see help for gear-type tables."
              )}
            </div>
          }
        />
        <LabeledDropdown
          label={t("Total")}
          value={totalMode}
          options={totalModeOptions}
          contentClassName="max-h-96"
          onChange={(val) =>
            handleUpdate({
              totalMode: val as OusDemographicsTotalMode,
            })
          }
          title={
            <div className="max-w-[280px] text-xs font-normal normal-case text-gray-500 leading-snug">
              <Trans ns="admin:reports">
                Calculations are always based on overlap with sector-specific
                polygons. Choose whether the Total column should use those same
                sector counts (<code>represented_in_sector</code>), or the full{" "}
                <code>participants</code> count from each group response.
              </Trans>
            </div>
          }
        />
        <TableHeadingsEditor
          labelKeys={headingLabelKeys}
          labelDisplayNames={headingLabelDisplayNames}
          componentSettings={settings}
          onUpdate={onUpdate}
        />
        <OusDemographicsHelpPopover />
        <TooltipMorePopover>
          <LabeledDropdown
            label={t("Sort by")}
            value={sortBy}
            options={sortOptions}
            onChange={(val) =>
              handleUpdate({ sortBy: val as "within" | "name" })
            }
          />
          {totalMode !== "participants" && (
            <TooltipBooleanConfigurationOption
              label={t("Show % column")}
              checked={settings.showPercentColumn ?? true}
              onChange={(next) => handleUpdate({ showPercentColumn: next })}
            />
          )}
          <TooltipBooleanConfigurationOption
            label={t("Show total row")}
            checked={settings.showTotalRow ?? false}
            onChange={(next) => handleUpdate({ showTotalRow: next })}
          />
          <PaginationSetting
            rowsPerPage={rowsPerPage}
            onChange={(next: number) => handleUpdate({ rowsPerPage: next })}
          />
          <div className="flex">
            <span className="text-sm font-light text-gray-400 whitespace-nowrap pr-1">
              {t("Component Type")}
            </span>
            <span className="text-sm font-light whitespace-nowrap px-1 flex-1 text-right">
              {t("OUS Demographics Table")}
            </span>
          </div>
        </TooltipMorePopover>
      </div>
    );
  };
