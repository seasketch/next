import {
  isTemporalInfo,
  toDataTableTemporalSourceColumns,
} from "@seasketch/geostats-types";
import { temporalCoverageLabel } from "./LayerTemporalFieldGroupListItem";
import { summary } from "./FieldGroupListItemBase";
import { tableVersionFromSummary } from "./dataTableSummary";

/** GraphQL enum value for `data_table:temporal` (codegen may lag the SQL enum). */
export const DATA_TABLE_TEMPORAL_FIELD_GROUP = "DATA_TABLE_TEMPORAL";

export type TemporalSettingsSnapshot = {
  coverageLabel: string;
  mappingLabel: string;
  defaultViewResolution: string;
  supportedViewResolutions: string;
};

export function isTemporalReprocess(
  fromSummary: unknown,
  toSummary: unknown,
  meta: unknown
): boolean {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    if ((meta as { reprocessed?: unknown }).reprocessed === true) {
      return true;
    }
  }
  const fromVersion = tableVersionFromSummary(summary(fromSummary));
  const toVersion = tableVersionFromSummary(summary(toSummary));
  return (
    fromVersion != null && toVersion != null && fromVersion !== toVersion
  );
}

export function mappingLabel(value: unknown, noneText: string): string {
  if (!isTemporalInfo(value) || value.mapping?.type !== "row") {
    return noneText;
  }
  const source = value.mapping.sourceColumns
    ? toDataTableTemporalSourceColumns(value.mapping.sourceColumns)
    : null;
  if (!source) {
    return noneText;
  }
  if (source.kind === "instant") {
    // eslint-disable-next-line i18next/no-literal-string
    return `${source.column} (${source.format})`;
  }
  if (source.kind === "components") {
    return [source.year, source.month, source.day]
      .filter(Boolean)
      .join(" + ");
  }
  if (source.kind === "span") {
    // eslint-disable-next-line i18next/no-literal-string
    return `${source.start} \u2013 ${source.end} (${source.format})`;
  }
  return noneText;
}

function resolutionsLabel(value: unknown, noneText: string): string {
  if (!isTemporalInfo(value) || !value.supportedViewResolutions?.length) {
    return noneText;
  }
  return value.supportedViewResolutions.join(", ");
}

function viewResolutionLabel(value: unknown, noneText: string): string {
  if (!isTemporalInfo(value)) {
    return noneText;
  }
  return value.defaultViewResolution || noneText;
}

export function temporalSettingsSnapshot(
  value: unknown,
  noneText: string,
  presentText: string
): TemporalSettingsSnapshot {
  return {
    coverageLabel: temporalCoverageLabel(value, noneText, presentText),
    mappingLabel: mappingLabel(value, noneText),
    defaultViewResolution: viewResolutionLabel(value, noneText),
    supportedViewResolutions: resolutionsLabel(value, noneText),
  };
}

export type TemporalSettingsChange = {
  coverage: boolean;
  mapping: boolean;
  defaultView: boolean;
  supportedViews: boolean;
};

export function temporalSettingsChange(
  fromValue: unknown,
  toValue: unknown,
  noneText: string,
  presentText: string
): TemporalSettingsChange {
  const from = temporalSettingsSnapshot(fromValue, noneText, presentText);
  const to = temporalSettingsSnapshot(toValue, noneText, presentText);
  return {
    coverage: from.coverageLabel !== to.coverageLabel,
    mapping: from.mappingLabel !== to.mappingLabel,
    defaultView: from.defaultViewResolution !== to.defaultViewResolution,
    supportedViews: from.supportedViewResolutions !== to.supportedViewResolutions,
  };
}
