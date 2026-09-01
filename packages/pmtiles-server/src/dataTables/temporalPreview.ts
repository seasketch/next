import { AsyncBuffer, FileMetaData, parquetReadObjects } from "hyparquet";
import {
  availabilityFromDerivedIntervals,
  coverageFromDerivedIntervals,
  DataTableTemporalConfig,
  deriveWhenIntervalFromRow,
  isDataTableTemporalConfig,
  nativeResolutionFromDerived,
  sourceColumnNames,
  TemporalPrecision,
} from "../../../geostats-types/lib/temporal";
import { columnsFromMetadata } from "./engine/plan";
import { QueryError } from "./params";

export const PREVIEW_SAMPLE_LIMIT = 20;

export type TemporalPreviewSample = {
  raw: Record<string, unknown>;
  parsed: {
    startSec: number;
    endSec: number;
    startIso: string;
    endIso: string;
    precision: TemporalPrecision;
  } | null;
};

export type TemporalPreviewResult = {
  totalRows: number;
  parseableCount: number;
  unparseableCount: number;
  nativeResolution: TemporalPrecision;
  coverage: ReturnType<typeof coverageFromDerivedIntervals>;
  availability: ReturnType<typeof availabilityFromDerivedIntervals>;
  samples: TemporalPreviewSample[];
};

function cellJson(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  if (value === undefined) return null;
  return value;
}

function rawFromRow(
  row: Record<string, unknown>,
  columns: string[]
): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const name of columns) {
    raw[name] = cellJson(row[name]);
  }
  return raw;
}

export function parseTemporalPreviewConfig(
  raw: string | null
): DataTableTemporalConfig {
  if (!raw || raw.trim() === "") {
    throw new QueryError(
      'Missing "config" query parameter (JSON DataTableTemporalConfig).'
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new QueryError(
      'Invalid "config" query parameter. Expected JSON DataTableTemporalConfig.'
    );
  }
  if (!isDataTableTemporalConfig(parsed)) {
    throw new QueryError(
      "Invalid DataTableTemporalConfig. See @seasketch/geostats-types isDataTableTemporalConfig."
    );
  }
  return parsed;
}

export async function previewTemporalMapping(options: {
  file: AsyncBuffer;
  metadata: FileMetaData;
  config: DataTableTemporalConfig;
}): Promise<TemporalPreviewResult> {
  const { file, metadata, config } = options;
  const columns = sourceColumnNames(config.sourceColumns);
  const schema = columnsFromMetadata(metadata);
  for (const name of columns) {
    if (!schema.has(name)) {
      throw new QueryError(`Unknown column "${name}".`, 400, {
        validColumns: [...schema.values()].map((c) => ({
          name: c.name,
          type: c.kind,
        })),
      });
    }
  }

  const intervals: ReturnType<typeof deriveWhenIntervalFromRow>[] = [];
  const samples: TemporalPreviewSample[] = [];
  let successSamples = 0;
  let failureSamples = 0;
  let parseableCount = 0;
  let unparseableCount = 0;
  const totalRows = Number(metadata.num_rows);

  const rows = (await parquetReadObjects({
    file,
    metadata,
    columns,
  })) as Record<string, unknown>[];

  for (const row of rows) {
    const parsed = deriveWhenIntervalFromRow(row, config.sourceColumns);
    if (parsed) {
      parseableCount++;
      intervals.push(parsed);
      if (successSamples < Math.ceil(PREVIEW_SAMPLE_LIMIT / 2)) {
        samples.push({ raw: rawFromRow(row, columns), parsed });
        successSamples++;
      }
    } else {
      unparseableCount++;
      if (failureSamples < Math.floor(PREVIEW_SAMPLE_LIMIT / 2)) {
        samples.push({ raw: rawFromRow(row, columns), parsed: null });
        failureSamples++;
      }
    }
  }

  const derived = intervals.filter(
    (interval): interval is NonNullable<typeof interval> => interval !== null
  );
  const nativeResolution = nativeResolutionFromDerived(
    config.sourceColumns,
    derived
  );
  const histogramResolution: TemporalPrecision =
    nativeResolution === "hour" ||
    nativeResolution === "minute" ||
    nativeResolution === "second"
      ? "day"
      : nativeResolution;

  return {
    totalRows,
    parseableCount,
    unparseableCount,
    nativeResolution,
    coverage: coverageFromDerivedIntervals(derived),
    availability: availabilityFromDerivedIntervals(
      derived,
      histogramResolution
    ),
    samples,
  };
}
