import { AsyncBuffer, FileMetaData, parquetReadObjects } from "hyparquet";
import {
  DataTableNodataConfig,
  DataTableNodataValue,
  isDataTableNodataConfig,
  nodataValueMatches,
  normalizeNodataValues,
} from "../../../geostats-types/lib/nodata";
import { WHEN_END_COLUMN, WHEN_START_COLUMN } from "../../../geostats-types/lib/temporal";
import { ColumnKind, columnsFromMetadata } from "./engine/plan";
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

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
  const names = columns.map((column) => column.name);
  const rows = (await parquetReadObjects({
    file: options.file,
    metadata: options.metadata,
    columns: names,
  })) as Record<string, unknown>[];

  const stats = new Map<
    string,
    {
      type: ColumnKind;
      excluded: boolean;
      nonNullCount: number;
      matchCount: number;
      currentNumbers: number[];
      previewNumbers: number[];
    }
  >();
  for (const column of columns) {
    stats.set(column.name, {
      type: column.kind,
      excluded: column.name === joinColumn,
      nonNullCount: 0,
      matchCount: 0,
      currentNumbers: [],
      previewNumbers: [],
    });
  }

  for (const row of rows) {
    for (const column of columns) {
      const cell = row[column.name];
      const entry = stats.get(column.name);
      if (!entry || cell === null || cell === undefined) continue;
      entry.nonNullCount += 1;
      const matched = nodataValueMatches(cell, values);
      if (matched) entry.matchCount += 1;
      const n = toNumber(cell);
      if (n !== null) {
        entry.currentNumbers.push(n);
        if (!matched) entry.previewNumbers.push(n);
      }
    }
  }

  const resultColumns: NodataPreviewColumn[] = columns.map((column) => {
    const entry = stats.get(column.name)!;
    const numeric =
      column.kind === "number"
        ? {
            currentMean: mean(entry.currentNumbers),
            previewMean: mean(entry.previewNumbers),
            currentMin:
              entry.currentNumbers.length > 0
                ? Math.min(...entry.currentNumbers)
                : null,
            previewMin:
              entry.previewNumbers.length > 0
                ? Math.min(...entry.previewNumbers)
                : null,
            currentMax:
              entry.currentNumbers.length > 0
                ? Math.max(...entry.currentNumbers)
                : null,
            previewMax:
              entry.previewNumbers.length > 0
                ? Math.max(...entry.previewNumbers)
                : null,
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
