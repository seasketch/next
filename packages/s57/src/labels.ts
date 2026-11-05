/**
 * Chart text built when the tiles are made, so the style does not have to
 * parse S-57 attribute lists. Abbreviations follow INT 1 and the S-52 light
 * description (LITDSN) and seabed (SBDARE) conventions.
 */

/** S-57 attribute lists arrive as "1,3" once flattened for a tile. */
export function codes(value: unknown): number[] {
  if (typeof value === "number" && Number.isFinite(value)) return [value];
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((code) => Number.isFinite(code) && code > 0);
}

const CHARACTER: Record<number, string> = {
  1: "F",
  2: "Fl",
  3: "LFl",
  4: "Q",
  5: "VQ",
  6: "UQ",
  7: "Iso",
  8: "Oc",
  9: "IQ",
  10: "IVQ",
  11: "IUQ",
  12: "Mo",
  13: "FFl",
  14: "Fl+LFl",
  15: "Oc+Fl",
  16: "FLFl",
  17: "Al.Oc",
  18: "Al.LFl",
  19: "Al.Fl",
  20: "Al.Gr",
  25: "Q+LFl",
  26: "VQ+LFl",
  27: "UQ+LFl",
  28: "Al",
  29: "Al.FFl",
};

const LIGHT_COLOUR: Record<number, string> = {
  1: "W",
  3: "R",
  4: "G",
  5: "Bu",
  6: "Y",
  9: "Am",
  10: "Vi",
  11: "Or",
};

function figure(value: unknown): string | null {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number) || number <= 0) return null;
  return String(Math.round(number * 10) / 10);
}

/**
 * Light description in chart order: character, group, colour, period,
 * height, range. "Fl(2) WR 10s 15m 20M". Height is in metres.
 */
export function lightDescription(properties: Record<string, unknown>): string | null {
  const character = CHARACTER[Number(properties.LITCHR)];
  if (!character) return null;
  let group = typeof properties.SIGGRP === "string" ? properties.SIGGRP.trim() : "";
  // "(1)" and "()" are the default single flash, which charts leave out.
  if (group === "(1)" || group === "()") group = "";
  const colours = codes(properties.COLOUR)
    .map((code) => LIGHT_COLOUR[code])
    .filter(Boolean)
    .join("");
  const period = figure(properties.SIGPER);
  const height = figure(properties.HEIGHT);
  const range = figure(properties.VALNMR);
  return [
    `${character}${group}`,
    colours,
    period && `${period}s`,
    height && `${Math.round(Number(height))}m`,
    range && `${range}M`,
  ]
    .filter(Boolean)
    .join(" ");
}

const STRUCTURE = /\b(Buoy|Beacon|Daybeacon|Lighted|Platform)\b/i;
const DESIGNATION = /\b(?:Buoy|Beacon|Daybeacon|Light)\s+"?([A-Z0-9]{1,4})"?$/i;

/**
 * What a chart prints beside a mark. A numbered buoy, beacon or light shows
 * its number in quotes, as US charts do. A named lighthouse shows its name.
 * The long NOAA names ("Santa Barbara Harbor Lighted Bell Buoy SB") are
 * otherwise left off, or the harbour fills with text.
 */
export function markLabel(objectClass: string, name: unknown): string | null {
  if (typeof name !== "string" || !name.trim()) return null;
  const trimmed = name.trim();
  const designation = trimmed.match(DESIGNATION);
  if (designation) return `"${designation[1]}"`;
  if (objectClass === "LIGHTS" && !STRUCTURE.test(trimmed)) return trimmed;
  return null;
}

const SURFACE: Record<number, string> = {
  1: "M",
  2: "Cy",
  3: "Si",
  4: "S",
  5: "St",
  6: "G",
  7: "P",
  8: "Cb",
  9: "R",
  11: "Lv",
  14: "Co",
  17: "Sh",
  18: "Bo",
};

const QUALITY: Record<number, string> = {
  1: "f",
  2: "m",
  3: "c",
  4: "bk",
  5: "sy",
  6: "so",
  7: "sf",
  8: "v",
  9: "ca",
  10: "h",
};

/** Seabed in chart shorthand: "fS", "S.M", "R". */
export function seabedLabel(properties: Record<string, unknown>): string | null {
  const surface = codes(properties.NATSUR);
  if (surface.length === 0) return null;
  const quality = codes(properties.NATQUA);
  const parts = surface
    .map((code, index) => {
      const letters = SURFACE[code];
      if (!letters) return null;
      const prefix = quality[index] ? QUALITY[quality[index]] || "" : "";
      return `${prefix}${letters}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(".") : null;
}

type PointFeature = {
  properties: Record<string, unknown>;
  geometry?: { type?: string; coordinates?: unknown };
};

const LIGHT_STRUCTURE = /^(BCN|BOY|LNDMRK|BUISGL|SILTNK|OFSPLF|LITFLT|LITVES|PILPNT|MORFAC)/;

function positionKey(feature: PointFeature): string | null {
  const geometry = feature.geometry;
  if (geometry?.type !== "Point" || !Array.isArray(geometry.coordinates)) return null;
  const [lng, lat] = geometry.coordinates as number[];
  if (typeof lng !== "number" || typeof lat !== "number") return null;
  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

/**
 * A light is a slave of the structure it stands on, and the name ("Santa
 * Barbara Light") is usually charted on that beacon or tower. Give an
 * unnamed light the label its structure's name implies. Features from one
 * cell only: positions are shared exactly within a cell.
 */
export function labelLightsFromStructures(features: PointFeature[]): void {
  const names = new Map<string, string>();
  for (const feature of features) {
    const objectClass = feature.properties.obj;
    const name = feature.properties.OBJNAM;
    if (typeof objectClass !== "string" || !LIGHT_STRUCTURE.test(objectClass)) continue;
    if (typeof name !== "string" || !name) continue;
    const key = positionKey(feature);
    if (key) names.set(key, name);
  }
  for (const feature of features) {
    if (feature.properties.obj !== "LIGHTS" || feature.properties.label) continue;
    const key = positionKey(feature);
    const name = key && names.get(key);
    if (!name) continue;
    const label = markLabel("LIGHTS", name);
    if (label) feature.properties.label = label;
  }
}

/** Marks whose sprite already carries the IALA topmark. */
const DRAWN_TOPMARK = new Set(["cardinal", "isolated"]);

/**
 * A topmark is a slave of the buoy or beacon at its position, and is drawn
 * on top of that mark's symbol. One on a cardinal or isolated-danger mark is
 * dropped: those symbols already show it. One with no structure under it is
 * drawn on its position. Features from one cell only.
 */
export function placeTopmarks<T extends PointFeature>(features: T[]): T[] {
  const hosts = new Map<string, unknown>();
  for (const feature of features) {
    const objectClass = feature.properties.obj;
    if (typeof objectClass !== "string" || !/^(BOY|BCN)/.test(objectClass)) continue;
    const key = positionKey(feature);
    if (key) hosts.set(key, feature.properties.mark);
  }
  return features.filter((feature) => {
    if (feature.properties.obj !== "TOPMAR") return true;
    const key = positionKey(feature);
    if (!key) return false;
    if (!hosts.has(key)) return true;
    const mark = hosts.get(key);
    if (typeof mark === "string" && DRAWN_TOPMARK.has(mark)) return false;
    feature.properties.hosted = true;
    return true;
  });
}
