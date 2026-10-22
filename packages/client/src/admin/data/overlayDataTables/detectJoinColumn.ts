import {
  GeostatsAttribute,
  GeostatsAttributeType,
  GeostatsLayer,
} from "@seasketch/geostats-types";

/**
 * Share of table rows whose join value is missing from the layer that still
 * allows the upload. At or above this, ingest refuses the file. Kept in sync
 * with MAX_UNMATCHED_RECORD_FRACTION in data-tables-handler.
 */
export const MAX_UNMATCHED_JOIN_RECORD_FRACTION = 0.1;

/** Distinct missing keys listed in the upload warning. Further keys are omitted. */
export const MAX_LISTED_UNMATCHED_JOIN_VALUES = 100;

export type JoinColumnCandidate = {
  csvColumn: string;
  overlayAttribute: string;
  /** Number of distinct CSV values that match the overlay join attribute. */
  score: number;
  totalRowCount: number;
  matchedRowCount: number;
  /** Rows whose join value is blank or not on the layer. */
  unmatchedRowCount: number;
  /** Blank join cells included in {@link unmatchedRowCount}. */
  blankRowCount: number;
  /** Distinct non-empty join values that are not on the layer. */
  unmatchedValues: string[];
  /**
   * True when more distinct missing keys were seen than
   * {@link MAX_LISTED_UNMATCHED_JOIN_VALUES}.
   */
  unmatchedValuesTruncated: boolean;
  /**
   * True when geostats includes every distinct overlay identifier. Only then
   * can a CSV value missing from the histogram be treated as missing from the
   * layer.
   */
  histogramComplete: boolean;
};

type ColumnScan = {
  matched: Set<string>;
  unmatched: Set<string>;
  unmatchedValuesTruncated: boolean;
  matchedRowCount: number;
  unmatchedRowCount: number;
  blankRowCount: number;
  totalRowCount: number;
  incompatible: boolean;
};

export type JoinColumnScan = {
  scans: ColumnScan[];
  overlayAttr: GeostatsAttribute;
  overlayKeys: Set<string>;
  histogramComplete: boolean;
};

export function isOverlayJoinHistogramComplete(
  attr: GeostatsAttribute,
): boolean {
  const keyCount = Object.keys(attr.values || {}).length;
  return (
    typeof attr.countDistinct !== "number" || attr.countDistinct <= keyCount
  );
}

export function unmatchedJoinFractionBlocksUpload(
  candidate: Pick<
    JoinColumnCandidate,
    | "histogramComplete"
    | "totalRowCount"
    | "unmatchedRowCount"
    | "unmatchedValues"
    | "unmatchedValuesTruncated"
  >,
): boolean {
  if (!candidate.histogramComplete) {
    return false;
  }
  if (
    candidate.unmatchedValues.length === 0 &&
    !candidate.unmatchedValuesTruncated
  ) {
    return false;
  }
  if (candidate.totalRowCount <= 0) {
    return false;
  }
  return (
    candidate.unmatchedRowCount / candidate.totalRowCount >=
    MAX_UNMATCHED_JOIN_RECORD_FRACTION
  );
}

export function isOverlayIdAttribute(
  attr: GeostatsAttribute,
  featureCount: number,
): boolean {
  if (featureCount <= 0) {
    return false;
  }
  if (attr.type !== "string" && attr.type !== "number") {
    return false;
  }
  const distinct = attr.countDistinct;
  if (distinct !== featureCount) {
    return false;
  }
  const valueEntries = Object.entries(attr.values || {});
  if (valueEntries.length === 0) {
    return false;
  }
  if (valueEntries.length !== distinct) {
    return false;
  }
  const total = valueEntries.reduce((sum, [, count]) => sum + count, 0);
  if (total !== featureCount) {
    return false;
  }
  return valueEntries.every(([, count]) => count === 1);
}

function normalizeValue(value: string, type: GeostatsAttributeType): string {
  const trimmed = value.trim();
  if (type === "number") {
    const n = Number(trimmed);
    if (!Number.isNaN(n)) {
      return String(n);
    }
  }
  return trimmed;
}

function emptyColumnScan(): ColumnScan {
  return {
    matched: new Set(),
    unmatched: new Set(),
    unmatchedValuesTruncated: false,
    matchedRowCount: 0,
    unmatchedRowCount: 0,
    blankRowCount: 0,
    totalRowCount: 0,
    incompatible: false,
  };
}

export function startJoinColumnScan(
  columnCount: number,
  overlayAttr: GeostatsAttribute,
): JoinColumnScan {
  return {
    scans: Array.from({ length: columnCount }, () => emptyColumnScan()),
    overlayAttr,
    overlayKeys: new Set(Object.keys(overlayAttr.values || {})),
    histogramComplete: isOverlayJoinHistogramComplete(overlayAttr),
  };
}

export function pushJoinColumnScanRow(
  scan: JoinColumnScan,
  row: string[],
): void {
  const { overlayAttr, overlayKeys, histogramComplete } = scan;
  for (let index = 0; index < scan.scans.length; index++) {
    const column = scan.scans[index];
    column.totalRowCount++;
    const raw = (row[index] ?? "").trim();
    if (!raw) {
      column.blankRowCount++;
      column.unmatchedRowCount++;
      continue;
    }
    if (overlayAttr.type === "number" && Number.isNaN(Number(raw))) {
      column.incompatible = true;
      continue;
    }
    const normalized = normalizeValue(raw, overlayAttr.type);
    if (overlayKeys.has(normalized)) {
      column.matched.add(normalized);
      column.matchedRowCount++;
      continue;
    }
    if (!histogramComplete) {
      continue;
    }
    const alreadyListed = column.unmatched.has(normalized);
    if (
      !alreadyListed &&
      column.unmatched.size >= MAX_LISTED_UNMATCHED_JOIN_VALUES
    ) {
      column.unmatchedValuesTruncated = true;
    } else if (!alreadyListed) {
      column.unmatched.add(normalized);
    }
    column.unmatchedRowCount++;
  }
}

export function finishJoinColumnScan(
  scan: JoinColumnScan,
  headers: string[],
  overlayJoinColumn: string,
): JoinColumnCandidate[] {
  const candidates: JoinColumnCandidate[] = [];
  scan.scans.forEach((column, index) => {
    const csvColumn = headers[index];
    if (!csvColumn || column.incompatible || column.matched.size === 0) {
      return;
    }
    candidates.push({
      csvColumn,
      overlayAttribute: overlayJoinColumn,
      score: column.matched.size,
      totalRowCount: column.totalRowCount,
      matchedRowCount: column.matchedRowCount,
      unmatchedRowCount: column.unmatchedRowCount,
      blankRowCount: column.blankRowCount,
      unmatchedValues: [...column.unmatched].sort((a, b) =>
        a.localeCompare(b),
      ),
      unmatchedValuesTruncated: column.unmatchedValuesTruncated,
      histogramComplete: scan.histogramComplete,
    });
  });
  return candidates.sort((a, b) => b.score - a.score);
}

export function detectJoinColumnCandidates(
  headers: string[],
  rows: string[][],
  geostatsLayer: GeostatsLayer | undefined,
  overlayJoinColumn: string,
): JoinColumnCandidate[] {
  if (
    !geostatsLayer?.attributes?.length ||
    headers.length === 0 ||
    !overlayJoinColumn
  ) {
    return [];
  }

  const overlayAttr = geostatsLayer.attributes.find(
    (attr) => attr.attribute === overlayJoinColumn,
  );
  if (!overlayAttr) {
    return [];
  }

  const scan = startJoinColumnScan(headers.length, overlayAttr);
  for (const row of rows) {
    pushJoinColumnScanRow(scan, row);
  }
  return finishJoinColumnScan(scan, headers, overlayJoinColumn);
}

export function pickJoinColumn(
  candidates: JoinColumnCandidate[],
): { joinColumn: string; overlayJoinColumn: string; needsPrompt: boolean } | null {
  if (candidates.length === 0) {
    return null;
  }
  const top = candidates[0];
  const tiedTop = candidates.filter((c) => c.score === top.score);
  return {
    joinColumn: top.csvColumn,
    overlayJoinColumn: top.overlayAttribute,
    needsPrompt: tiedTop.length > 1,
  };
}
