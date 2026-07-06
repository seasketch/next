import {
  GeostatsAttribute,
  GeostatsAttributeType,
  GeostatsLayer,
} from "@seasketch/geostats-types";

export type JoinColumnCandidate = {
  csvColumn: string;
  overlayAttribute: string;
  /** Number of distinct CSV values that match the overlay ID column */
  score: number;
};

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

function getColumnDistinctValues(
  headers: string[],
  rows: string[][],
  columnName: string,
): Set<string> {
  const colIndex = headers.indexOf(columnName);
  if (colIndex < 0) {
    return new Set();
  }
  const values = new Set<string>();
  for (const row of rows) {
    const raw = (row[colIndex] ?? "").trim();
    if (raw) {
      values.add(raw);
    }
  }
  return values;
}

function typesCompatible(
  csvValues: Set<string>,
  overlayAttr: GeostatsAttribute,
): boolean {
  if (overlayAttr.type === "number") {
    for (const v of csvValues) {
      if (Number.isNaN(Number(v))) {
        return false;
      }
    }
  }
  return true;
}

function csvValuesSubsetOfOverlay(
  csvValues: Set<string>,
  overlayAttr: GeostatsAttribute,
): boolean {
  const overlayKeys = new Set(Object.keys(overlayAttr.values || {}));
  if (overlayKeys.size === 0) {
    return false;
  }
  for (const csvValue of csvValues) {
    const normalized = normalizeValue(csvValue, overlayAttr.type);
    if (!overlayKeys.has(normalized)) {
      return false;
    }
  }
  return true;
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

  const candidates: JoinColumnCandidate[] = [];

  for (const header of headers) {
    const csvValues = getColumnDistinctValues(headers, rows, header);
    if (csvValues.size === 0) {
      continue;
    }
    if (!typesCompatible(csvValues, overlayAttr)) {
      continue;
    }
    if (!csvValuesSubsetOfOverlay(csvValues, overlayAttr)) {
      continue;
    }
    candidates.push({
      csvColumn: header,
      overlayAttribute: overlayJoinColumn,
      score: csvValues.size,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
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
