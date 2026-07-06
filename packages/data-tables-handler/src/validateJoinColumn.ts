import {
  GeostatsAttribute,
  GeostatsAttributeType,
  GeostatsLayer,
} from "@seasketch/geostats-types";

export function getGeostatsLayer(overlayGeostats: unknown): GeostatsLayer {
  const data = overlayGeostats as { layers?: GeostatsLayer[] };
  const layer = data?.layers?.[0];
  if (!layer?.attributes) {
    throw new Error("Overlay geostats missing layer attributes");
  }
  return layer;
}

export function findOverlayAttribute(
  layer: GeostatsLayer,
  attributeName: string,
) {
  const attr = layer.attributes.find((a) => a.attribute === attributeName);
  if (!attr) {
    throw new Error(
      `Overlay attribute "${attributeName}" not found in geostats`,
    );
  }
  return attr;
}

export function validateJoinColumnChoice(
  headers: string[],
  joinColumn: string,
  overlayJoinColumn: string,
  layer: GeostatsLayer,
  joinValues: Set<string>,
): { overlayAttr: GeostatsAttribute; matchRate: number; matchedRows: number; unmatchedRows: number; unmatchedOverlayValues: number } {
  if (!headers.includes(joinColumn)) {
    throw new Error(`Join column "${joinColumn}" not found in CSV headers`);
  }
  const overlayAttr = findOverlayAttribute(layer, overlayJoinColumn);
  const overlayKeys = new Set(Object.keys(overlayAttr.values || {}));
  let matchedRows = 0;
  for (const v of joinValues) {
    if (overlayKeys.has(v)) {
      matchedRows++;
    }
  }
  const unmatchedRows = joinValues.size - matchedRows;
  if (matchedRows === 0) {
    throw new Error(
      "No values in the join column match overlay feature identifiers",
    );
  }
  if (unmatchedRows > 0) {
    throw new Error(
      `${unmatchedRows} value(s) in the join column are not present in the overlay layer`,
    );
  }
  let unmatchedOverlayValues = 0;
  for (const k of overlayKeys) {
    if (!joinValues.has(k)) {
      unmatchedOverlayValues++;
    }
  }
  const matchRate =
    joinValues.size > 0 ? matchedRows / joinValues.size : 0;
  return {
    overlayAttr,
    matchRate,
    matchedRows,
    unmatchedRows,
    unmatchedOverlayValues,
  };
}

export function inferGeostatsType(duckDbType: string): GeostatsAttributeType {
  const t = duckDbType.toUpperCase();
  if (/INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL|HUGEINT/.test(t)) {
    return "number";
  }
  if (/BOOL/.test(t)) {
    return "boolean";
  }
  return "string";
}

export function sqlStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
