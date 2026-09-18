import { AsyncBuffer, FileMetaData } from "hyparquet";
import { parquetReadColumn } from "hyparquet/src/read.js";
import {
  DataTableNodataConfig,
  DataTableNodataValue,
  isDataTableNodataConfig,
  nodataValueMatches,
  normalizeNodataValues,
} from "../../../geostats-types/lib/nodata";
import { WHEN_END_COLUMN, WHEN_START_COLUMN } from "../../../geostats-types/lib/temporal";
import {
  ColumnKind,
  columnsFromMetadata,
  decodeSpans,
  rowGroupReadSpans,
} from "./engine/plan";
import { QueryError } from "./params";

export type NodataPreviewNumeric = {
  currentMean: number | null;
  previewMean: number | null;
  currentMin: number | null;
  previewMin: number | null;
  currentMax: number | null;
  previewMax: number | null;
};

export type NodataPreviewColumn = {
  name: string;
  type: ColumnKind;
  nonNullCount: number;
  matchCount: number;
  excluded: boolean;
  numeric: NodataPreviewNumeric | null;
};

export type NodataPreviewResult = {
  totalRows: number;
  values: DataTableNodataValue[];
  columns: NodataPreviewColumn[];
  joinColumnWarning: { column: string; matchCount: number } | null;
};

const DERIVED = new Set([WHEN_START_COLUMN, WHEN_END_COLUMN]);

export function parseNodataPreviewConfig(
  raw: string | null
): DataTableNodataConfig {
  if (!raw || raw.trim() === "") {
    throw new QueryError(
      'Missing "config" query parameter (JSON DataTableNodataConfig).'
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new QueryError(
      "Invalid \"config\" query parameter. Expected JSON DataTableNodataConfig."
    );
  }
  if (!isDataTableNodataConfig(parsed)) {
    throw new QueryError(
      "Invalid DataTableNodataConfig. See @seasketch/geostats-types isDataTableNodataConfig."
    );
  }
  return { values: normalizeNodataValues(parsed) };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type RunningNumbers = {
  count: number;
  sum: number;
  min: number;
  max: number;
};

function addNumber(stats: RunningNumbers, value: number): void {
  if (stats.count === 0) {
    stats.min = value;
    stats.max = value;
  } else {
    if (value < stats.min) stats.min = value;
    if (value > stats.max) stats.max = value;
  }
  stats.count += 1;
  stats.sum += value;
}

function numericSummary(stats: RunningNumbers): {
  mean: number | null;
  min: number | null;
  max: number | null;
} {
  if (stats.count === 0) {
    return { mean: null, min: null, max: null };
  }
  return {
    mean: stats.sum / stats.count,
    min: stats.min,
    max: stats.max,
  };
}

export async function previewNodataValues(options: {
  file: AsyncBuffer;
  metadata: FileMetaData;
  config: DataTableNodataConfig;
  joinColumn?: string | null;
}): Promise<NodataPreviewResult> {
  const values = normalizeNodataValues(options.config);
  const schema = columnsFromMetadata(options.metadata);
  const joinColumn = options.joinColumn || null;
  const columns = [...schema.values()].filter((column) => !DERIVED.has(column.name));
  const stats = new Map<
    string,
    {
      type: ColumnKind;
      excluded: boolean;
      nonNullCount: number;
      matchCount: number;
      currentNumbers: RunningNumbers;
      previewNumbers: RunningNumbers;
    }
  >();
  for (const column of columns) {
    stats.set(column.name, {
      type: column.kind,
      excluded: column.name === joinColumn,
      nonNullCount: 0,
      matchCount: 0,
      currentNumbers: { count: 0, sum: 0, min: 0, max: 0 },
      previewNumbers: { count: 0, sum: 0, min: 0, max: 0 },
    });
  }

  for (const span of decodeSpans(rowGroupReadSpans(options.metadata))) {
    for (const column of columns) {
      const cells = (await parquetReadColumn({
        file: options.file,
        metadata: options.metadata,
        columns: [column.name],
        rowStart: span.rowStart,
        rowEnd: span.rowEnd,
      })) as unknown[];
      const entry = stats.get(column.name);
      if (!entry) continue;
      for (const cell of cells) {
        if (cell === null || cell === undefined) continue;
        entry.nonNullCount += 1;
        const matched = nodataValueMatches(cell, values);
        if (matched) entry.matchCount += 1;
        const n = toNumber(cell);
        if (n !== null) {
          addNumber(entry.currentNumbers, n);
          if (!matched) addNumber(entry.previewNumbers, n);
        }
      }
    }
  }

  const resultColumns: NodataPreviewColumn[] = columns.map((column) => {
    const entry = stats.get(column.name)!;
    const current = numericSummary(entry.currentNumbers);
    const preview = numericSummary(entry.previewNumbers);
    const numeric =
      column.kind === "number"
        ? {
            currentMean: current.mean,
            previewMean: preview.mean,
            currentMin: current.min,
            previewMin: preview.min,
            currentMax: current.max,
            previewMax: preview.max,
          }
        : null;
    return {
      name: column.name,
      type: column.kind,
      nonNullCount: entry.nonNullCount,
      matchCount: entry.matchCount,
      excluded: entry.excluded,
      numeric,
    };
  });

  const joinWarning =
    joinColumn && stats.get(joinColumn) && stats.get(joinColumn)!.matchCount > 0
      ? { column: joinColumn, matchCount: stats.get(joinColumn)!.matchCount }
      : null;

  return {
    totalRows: Number(options.metadata.num_rows),
    values,
    columns: resultColumns,
    joinColumnWarning: joinWarning,
  };
}
