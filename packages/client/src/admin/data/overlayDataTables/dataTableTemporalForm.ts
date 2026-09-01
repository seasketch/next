import {
  DataTableTemporalConfig,
  DataTableTemporalSourceColumns,
  TemporalDateFormat,
  TemporalInfo,
  TemporalPrecision,
  isTemporalInfo,
  nativePrecisionFromSourceColumns,
  sourceColumnNames,
  toDataTableTemporalSourceColumns,
} from "@seasketch/geostats-types";

export type DataTableTemporalMode =
  | "none"
  | "instant"
  | "components"
  | "span";

export type DataTableTemporalFormState = {
  mode: DataTableTemporalMode;
  instantColumn: string;
  instantFormat: TemporalDateFormat;
  yearColumn: string;
  monthColumn: string;
  dayColumn: string;
  spanStartColumn: string;
  spanEndColumn: string;
  spanFormat: TemporalDateFormat;
  defaultViewResolution: TemporalPrecision;
  supportedViewResolutions: TemporalPrecision[];
};

export const DATE_FORMATS: TemporalDateFormat[] = [
  "mdy",
  "dmy",
  "iso",
  "year",
];

export const VIEW_RESOLUTIONS: TemporalPrecision[] = [
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
];

export function defaultViewResolutionForNative(
  native: TemporalPrecision
): TemporalPrecision {
  if (native === "day" || native === "month") {
    return "year";
  }
  return native;
}

export function defaultSupportedViewResolutions(
  native: TemporalPrecision
): TemporalPrecision[] {
  const nativeIdx = VIEW_RESOLUTIONS.indexOf(native);
  if (nativeIdx === -1) {
    return ["year"];
  }
  return VIEW_RESOLUTIONS.slice(0, nativeIdx + 1);
}

/**
 * Views the timeslider may offer for this mapping. Never finer than the
 * columns/format the admin has identified (year-only → year; no clock
 * down to the second without a time-of-day source).
 */
export function allowedViewResolutionsForForm(
  form: DataTableTemporalFormState
): TemporalPrecision[] {
  const source = sourceColumnsFromForm(form);
  if (!source) {
    return ["year"];
  }
  return defaultSupportedViewResolutions(
    nativePrecisionFromSourceColumns(source)
  );
}

/** ISO pattern shown in the preview table for a parsed instant. */
export function parsedIsoPattern(precision: TemporalPrecision): string {
  switch (precision) {
    case "year":
      return "YYYY";
    case "month":
      return "YYYY-MM";
    case "day":
      return "YYYY-MM-DD";
    case "hour":
      return "YYYY-MM-DDTHH:00:00Z";
    case "minute":
      return "YYYY-MM-DDTHH:MM:00Z";
    case "second":
      return "YYYY-MM-DDTHH:MM:SSZ";
    default:
      return "YYYY-MM-DD";
  }
}

export function withComponentYear(
  form: DataTableTemporalFormState,
  yearColumn: string
): DataTableTemporalFormState {
  return applyNativeDefaults({
    ...form,
    yearColumn,
    monthColumn: yearColumn ? form.monthColumn : "",
    dayColumn: yearColumn ? form.dayColumn : "",
  });
}

export function withComponentMonth(
  form: DataTableTemporalFormState,
  monthColumn: string
): DataTableTemporalFormState {
  return applyNativeDefaults({
    ...form,
    monthColumn,
    dayColumn: monthColumn ? form.dayColumn : "",
  });
}

export function withSpanStart(
  form: DataTableTemporalFormState,
  spanStartColumn: string
): DataTableTemporalFormState {
  return applyNativeDefaults({
    ...form,
    spanStartColumn,
    spanEndColumn: spanStartColumn ? form.spanEndColumn : "",
  });
}

export function emptyDataTableTemporalForm(): DataTableTemporalFormState {
  return {
    mode: "none",
    instantColumn: "",
    instantFormat: "mdy",
    yearColumn: "",
    monthColumn: "",
    dayColumn: "",
    spanStartColumn: "",
    spanEndColumn: "",
    spanFormat: "mdy",
    defaultViewResolution: "year",
    supportedViewResolutions: ["year"],
  };
}

export function formStateFromTemporal(
  temporal: unknown
): DataTableTemporalFormState {
  const empty = emptyDataTableTemporalForm();
  if (!isTemporalInfo(temporal) || temporal.granularity !== "row") {
    return empty;
  }
  const source = temporal.mapping?.type === "row"
    ? temporal.mapping.sourceColumns
    : undefined;
  const mapped = source ? toDataTableTemporalSourceColumns(source) : null;
  const native = mapped
    ? nativePrecisionFromSourceColumns(mapped)
    : temporal.nativeResolution;
  const next: DataTableTemporalFormState = {
    ...empty,
    defaultViewResolution:
      temporal.defaultViewResolution || defaultViewResolutionForNative(native),
    supportedViewResolutions:
      temporal.supportedViewResolutions &&
      temporal.supportedViewResolutions.length > 0
        ? temporal.supportedViewResolutions
        : defaultSupportedViewResolutions(native),
  };
  if (!mapped) {
    return next;
  }
  if (mapped.kind === "instant") {
    next.mode = "instant";
    next.instantColumn = mapped.column;
    next.instantFormat = mapped.format;
  } else if (mapped.kind === "components") {
    next.mode = "components";
    next.yearColumn = mapped.year;
    next.monthColumn = mapped.month || "";
    next.dayColumn = mapped.day || "";
  } else {
    next.mode = "span";
    next.spanStartColumn = mapped.start;
    next.spanEndColumn = mapped.end;
    next.spanFormat = mapped.format;
  }
  return next;
}

export function sourceColumnsFromForm(
  form: DataTableTemporalFormState
): DataTableTemporalSourceColumns | null {
  if (form.mode === "none") {
    return null;
  }
  if (form.mode === "instant") {
    if (!form.instantColumn) return null;
    return {
      kind: "instant",
      column: form.instantColumn,
      format: form.instantFormat,
    };
  }
  if (form.mode === "components") {
    if (!form.yearColumn) return null;
    return {
      kind: "components",
      year: form.yearColumn,
      ...(form.monthColumn ? { month: form.monthColumn } : {}),
      ...(form.dayColumn ? { day: form.dayColumn } : {}),
    };
  }
  if (!form.spanStartColumn || !form.spanEndColumn) {
    return null;
  }
  return {
    kind: "span",
    start: form.spanStartColumn,
    end: form.spanEndColumn,
    format: form.spanFormat,
  };
}

export function configFromForm(
  form: DataTableTemporalFormState
): DataTableTemporalConfig | null {
  const sourceColumns = sourceColumnsFromForm(form);
  if (!sourceColumns) return null;
  const native = nativePrecisionFromSourceColumns(sourceColumns);
  const allowed = defaultSupportedViewResolutions(native);
  const supported = form.supportedViewResolutions.filter((resolution) =>
    allowed.includes(resolution)
  );
  return {
    sourceColumns,
    defaultViewResolution: allowed.includes(form.defaultViewResolution)
      ? form.defaultViewResolution
      : allowed[0] || native,
    supportedViewResolutions: supported.length > 0 ? supported : allowed,
  };
}

export function sourceColumnsEqual(
  a: DataTableTemporalSourceColumns | null,
  b: DataTableTemporalSourceColumns | null
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function existingSourceColumns(
  temporal: unknown
): DataTableTemporalSourceColumns | null {
  if (!isTemporalInfo(temporal) || temporal.mapping?.type !== "row") {
    return null;
  }
  return temporal.mapping.sourceColumns
    ? toDataTableTemporalSourceColumns(temporal.mapping.sourceColumns)
    : null;
}

export function isResolutionOnlyChange(
  form: DataTableTemporalFormState,
  temporal: unknown
): boolean {
  const next = sourceColumnsFromForm(form);
  const prev = existingSourceColumns(temporal);
  if (!next || !prev) return false;
  return sourceColumnsEqual(next, prev);
}

export function temporalSourceColumnSet(temporal: unknown): string[] {
  const mapped = existingSourceColumns(temporal);
  return mapped ? sourceColumnNames(mapped) : [];
}

export function applyNativeDefaults(
  form: DataTableTemporalFormState
): DataTableTemporalFormState {
  const source = sourceColumnsFromForm(form);
  if (!source) return form;
  const native = nativePrecisionFromSourceColumns(source);
  return {
    ...form,
    defaultViewResolution: defaultViewResolutionForNative(native),
    supportedViewResolutions: defaultSupportedViewResolutions(native),
  };
}

export function temporalInfoWithResolutions(
  temporal: TemporalInfo,
  form: DataTableTemporalFormState
): TemporalInfo {
  return {
    ...temporal,
    defaultViewResolution: form.defaultViewResolution,
    supportedViewResolutions: form.supportedViewResolutions,
    authoredBy: "admin",
  };
}
