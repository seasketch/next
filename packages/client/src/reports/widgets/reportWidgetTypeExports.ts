/**
 * Compile-only check that widget types and helpers resolve from both
 * reportWidgetShared and the widgets.tsx re-exports.
 */
import {
  MetricProperties,
  ReportWidget,
  ReportWidgetProps,
  TableHeadingsEditor,
  TooltipBooleanConfigurationOption,
} from "./reportWidgetShared";
import {
  MetricProperties as WidgetsMetricProperties,
  ReportWidget as WidgetsReportWidget,
  ReportWidgetProps as WidgetsReportWidgetProps,
  TableHeadingsEditor as WidgetsTableHeadingsEditor,
  TooltipBooleanConfigurationOption as WidgetsTooltipBooleanConfigurationOption,
} from "./widgets";

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export const reportWidgetMatches: Same<
  ReportWidget<{ n: number }>,
  WidgetsReportWidget<{ n: number }>
> = true;

export const reportWidgetPropsMatch: Same<
  ReportWidgetProps<{ n: number }>,
  WidgetsReportWidgetProps<{ n: number }>
> = true;

export const metricPropertiesMatch: Same<
  MetricProperties,
  WidgetsMetricProperties
> = true;

export const headingsEditor: typeof TableHeadingsEditor =
  WidgetsTableHeadingsEditor;
export const booleanOption: typeof TooltipBooleanConfigurationOption =
  WidgetsTooltipBooleanConfigurationOption;
