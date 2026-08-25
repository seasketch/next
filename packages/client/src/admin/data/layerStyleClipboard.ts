import { useEffect, useState } from "react";
import { isGeostatsLayer } from "@seasketch/geostats-types";
import { normalizeMapboxGlStyles } from "./cartographyRevisionUtils";

export const LAYER_STYLE_CLIPBOARD_VERSION = 1;
const SESSION_STORAGE_KEY = "seasketch:copiedLayerStyle";

const VECTOR_LAYER_TYPES = new Set([
  "fill",
  "line",
  "circle",
  "symbol",
  "heatmap",
  "fill-extrusion",
  "hillshade",
]);
const RASTER_LAYER_TYPES = new Set(["raster"]);
const DISALLOWED_STYLE_KEYS = new Set(["id", "source", "source-layer"]);
const LEGACY_FILTER_OPS = new Set([
  "==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "in",
  "!in",
  "has",
  "!has",
]);

export type LayerStyleKind = "vector" | "raster";

export type LayerStyleClipboardPayload = {
  version: 1;
  copiedFromTitle: string;
  copiedFromTocItemId?: number;
  styleKind: LayerStyleKind;
  mapboxGlStyles: unknown[];
};

export type StyleGeometryFamily = "point" | "line" | "polygon";

export type StylePasteIssue =
  | {
      kind: "style-kind-mismatch";
      copiedKind: LayerStyleKind;
      targetKind: LayerStyleKind;
    }
  | { kind: "missing-properties"; properties: string[] }
  | {
      kind: "geometry-mismatch";
      targetGeometry: string;
      styleLayerTypes: string[];
    };

const hopperListeners = new Set<() => void>();
let hopperMemory: LayerStyleClipboardPayload | null = readHopperFromSession();

function getSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") {
      return null;
    }
    return sessionStorage;
  } catch {
    return null;
  }
}

function readHopperFromSession(): LayerStyleClipboardPayload | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }
  try {
    return parseLayerStyleClipboardText(storage.getItem(SESSION_STORAGE_KEY));
  } catch {
    return null;
  }
}

function notifyHopperListeners() {
  hopperListeners.forEach((listener) => listener());
}

export function isLayerStyleClipboardPayload(
  value: unknown
): value is LayerStyleClipboardPayload {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (!("version" in value) || value.version !== LAYER_STYLE_CLIPBOARD_VERSION) {
    return false;
  }
  if (!("styleKind" in value)) {
    return false;
  }
  if (value.styleKind !== "vector" && value.styleKind !== "raster") {
    return false;
  }
  if (!("mapboxGlStyles" in value) || !Array.isArray(value.mapboxGlStyles)) {
    return false;
  }
  if (value.mapboxGlStyles.length === 0) {
    return false;
  }
  return true;
}

export function sanitizeStyleLayers(layers: unknown[]): unknown[] {
  return layers.map((layer) => {
    if (layer == null || typeof layer !== "object" || Array.isArray(layer)) {
      return layer;
    }
    const copy: { [key: string]: unknown } = {};
    for (const key of Object.keys(layer)) {
      if (!DISALLOWED_STYLE_KEYS.has(key)) {
        copy[key] = (layer as { [k: string]: unknown })[key];
      }
    }
    return copy;
  });
}

function isStyleLayerObject(value: unknown): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (!("type" in value) || typeof value.type !== "string") {
    return false;
  }
  return (
    VECTOR_LAYER_TYPES.has(value.type) || RASTER_LAYER_TYPES.has(value.type)
  );
}

export function inferStyleKind(layers: unknown[]): LayerStyleKind | null {
  let sawVector = false;
  let sawRaster = false;
  for (const layer of layers) {
    if (layer == null || typeof layer !== "object" || Array.isArray(layer)) {
      continue;
    }
    if (!("type" in layer) || typeof layer.type !== "string") {
      continue;
    }
    if (VECTOR_LAYER_TYPES.has(layer.type)) {
      sawVector = true;
    } else if (RASTER_LAYER_TYPES.has(layer.type)) {
      sawRaster = true;
    }
  }
  if (sawVector && !sawRaster) {
    return "vector";
  }
  if (sawRaster && !sawVector) {
    return "raster";
  }
  if (sawVector && sawRaster) {
    return "vector";
  }
  return null;
}

function looksLikeStyleLayerArray(value: unknown): value is unknown[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((layer) => isStyleLayerObject(layer))
  );
}

export function parseLayerStyleClipboardText(
  text: string | null | undefined
): LayerStyleClipboardPayload | null {
  if (typeof text !== "string") {
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (isLayerStyleClipboardPayload(parsed)) {
    const styles = sanitizeStyleLayers(
      normalizeMapboxGlStyles(parsed.mapboxGlStyles)
    );
    if (!styles.length) {
      return null;
    }
    return {
      version: 1,
      copiedFromTitle:
        typeof parsed.copiedFromTitle === "string" ? parsed.copiedFromTitle : "",
      copiedFromTocItemId:
        typeof parsed.copiedFromTocItemId === "number"
          ? parsed.copiedFromTocItemId
          : undefined,
      styleKind: parsed.styleKind,
      mapboxGlStyles: styles,
    };
  }
  const styles = sanitizeStyleLayers(normalizeMapboxGlStyles(parsed));
  if (!looksLikeStyleLayerArray(styles)) {
    return null;
  }
  const styleKind = inferStyleKind(styles);
  if (!styleKind) {
    return null;
  }
  return {
    version: 1,
    copiedFromTitle: "",
    styleKind,
    mapboxGlStyles: styles,
  };
}

export function getCopiedLayerStyle(): LayerStyleClipboardPayload | null {
  return hopperMemory;
}

export function setCopiedLayerStyle(payload: LayerStyleClipboardPayload | null) {
  hopperMemory = payload;
  const storage = getSessionStorage();
  if (storage) {
    try {
      if (payload) {
        storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
      } else {
        storage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Private mode or quota — memory hopper still works for this tab.
    }
  }
  notifyHopperListeners();
}

export function subscribeCopiedLayerStyle(listener: () => void) {
  hopperListeners.add(listener);
  return () => {
    hopperListeners.delete(listener);
  };
}

export function useCopiedLayerStyle() {
  const [payload, setPayload] = useState<LayerStyleClipboardPayload | null>(
    () => getCopiedLayerStyle()
  );
  useEffect(() => {
    return subscribeCopiedLayerStyle(() => {
      setPayload(getCopiedLayerStyle());
    });
  }, []);
  return payload;
}

export function collectReferencedProperties(styles: unknown): string[] {
  const found = new Set<string>();
  if (!Array.isArray(styles)) {
    return [];
  }
  for (const layer of styles) {
    walkStyleValue(layer, found);
  }
  return Array.from(found).sort();
}

function walkStyleValue(value: unknown, found: Set<string>) {
  if (Array.isArray(value)) {
    if (typeof value[0] === "string") {
      collectExpressionProperties(value, found);
      for (const arg of value.slice(1)) {
        walkStyleValue(arg, found);
      }
      return;
    }
    for (const item of value) {
      walkStyleValue(item, found);
    }
    return;
  }
  if (value != null && typeof value === "object") {
    for (const child of Object.values(value)) {
      walkStyleValue(child, found);
    }
  }
}

function collectExpressionProperties(expression: unknown[], found: Set<string>) {
  const op = expression[0];
  if (op === "get" || op === "has") {
    if (typeof expression[1] === "string" && expression.length < 3) {
      found.add(expression[1]);
    }
    return;
  }
  if (
    typeof op === "string" &&
    LEGACY_FILTER_OPS.has(op) &&
    typeof expression[1] === "string" &&
    expression[1] !== "zoom" &&
    !/^\$/.test(expression[1])
  ) {
    found.add(expression[1]);
  }
}

export function collectStyleLayerTypes(styles: unknown): string[] {
  if (!Array.isArray(styles)) {
    return [];
  }
  const types: string[] = [];
  const seen = new Set<string>();
  for (const layer of styles) {
    if (layer == null || typeof layer !== "object" || Array.isArray(layer)) {
      continue;
    }
    if (!("type" in layer) || typeof layer.type !== "string") {
      continue;
    }
    if (!seen.has(layer.type)) {
      seen.add(layer.type);
      types.push(layer.type);
    }
  }
  return types;
}

export function geometryFamily(
  geometry: string | null | undefined
): StyleGeometryFamily | null {
  if (!geometry) {
    return null;
  }
  const normalized = geometry.toLowerCase();
  if (normalized === "point" || normalized === "multipoint") {
    return "point";
  }
  if (normalized === "linestring" || normalized === "multilinestring") {
    return "line";
  }
  if (normalized === "polygon" || normalized === "multipolygon") {
    return "polygon";
  }
  return null;
}

export function styleGeometryFamilies(
  layerTypes: string[]
): Set<StyleGeometryFamily> {
  const families = new Set<StyleGeometryFamily>();
  for (const type of layerTypes) {
    if (type === "fill" || type === "fill-extrusion") {
      families.add("polygon");
    } else if (type === "line") {
      families.add("line");
    } else if (type === "circle" || type === "heatmap") {
      families.add("point");
    }
  }
  return families;
}

function familiesCompatibleWithTarget(
  families: Set<StyleGeometryFamily>,
  target: StyleGeometryFamily
): boolean {
  for (const family of families) {
    if (family === "polygon" && target !== "polygon") {
      return false;
    }
    if (family === "point" && target !== "point") {
      return false;
    }
    if (family === "line" && target === "point") {
      return false;
    }
  }
  return true;
}

export function targetAttributeNames(geostats: unknown): string[] | null {
  if (!isGeostatsLayer(geostats)) {
    return null;
  }
  if (!Array.isArray(geostats.attributes)) {
    return [];
  }
  return geostats.attributes
    .map((attribute) =>
      attribute &&
      typeof attribute === "object" &&
      "attribute" in attribute &&
      typeof attribute.attribute === "string"
        ? attribute.attribute
        : null
    )
    .filter((name): name is string => Boolean(name));
}

export function assessStylePaste({
  styles,
  copiedKind,
  targetKind,
  geostats,
}: {
  styles: unknown[];
  copiedKind: LayerStyleKind;
  targetKind: LayerStyleKind;
  geostats: unknown;
}): StylePasteIssue[] {
  const issues: StylePasteIssue[] = [];
  if (copiedKind !== targetKind) {
    issues.push({
      kind: "style-kind-mismatch",
      copiedKind,
      targetKind,
    });
    return issues;
  }

  if (targetKind === "vector") {
    const referenced = collectReferencedProperties(styles);
    const available = targetAttributeNames(geostats);
    if (available && referenced.length) {
      const availableSet = new Set(available);
      const missing = referenced.filter((name) => !availableSet.has(name));
      if (missing.length) {
        issues.push({ kind: "missing-properties", properties: missing });
      }
    }

    const targetGeometry = isGeostatsLayer(geostats) ? geostats.geometry : null;
    const targetFamily = geometryFamily(targetGeometry);
    const layerTypes = collectStyleLayerTypes(styles);
    const families = styleGeometryFamilies(layerTypes);
    if (
      targetFamily &&
      families.size > 0 &&
      !familiesCompatibleWithTarget(families, targetFamily)
    ) {
      issues.push({
        kind: "geometry-mismatch",
        targetGeometry: targetGeometry || targetFamily,
        styleLayerTypes: layerTypes,
      });
    }
  }

  return issues;
}

export async function writeLayerStyleToClipboard(
  payload: LayerStyleClipboardPayload
): Promise<void> {
  setCopiedLayerStyle(payload);
  const text = JSON.stringify(payload.mapboxGlStyles, null, 2);
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Permission or unfocused document — hopper still holds the style.
  }
  fallbackWriteText(text);
}

export function mergeClipboardWithHopper(
  parsed: LayerStyleClipboardPayload | null,
  hopper: LayerStyleClipboardPayload | null
): LayerStyleClipboardPayload | null {
  if (!parsed) {
    return hopper;
  }
  if (!hopper) {
    return parsed;
  }
  if (
    !parsed.copiedFromTitle &&
    JSON.stringify(parsed.mapboxGlStyles) === JSON.stringify(hopper.mapboxGlStyles)
  ) {
    return {
      ...parsed,
      copiedFromTitle: hopper.copiedFromTitle,
      copiedFromTocItemId: hopper.copiedFromTocItemId,
      styleKind: hopper.styleKind,
    };
  }
  return parsed;
}

export async function readLayerStyleFromClipboard(): Promise<LayerStyleClipboardPayload | null> {
  const hopper = getCopiedLayerStyle();
  if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
    return hopper;
  }
  try {
    const text = await navigator.clipboard.readText();
    return mergeClipboardWithHopper(
      parseLayerStyleClipboardText(text),
      hopper
    );
  } catch {
    // Permission denied or insecure context — fall back to the session hopper.
  }
  return hopper;
}

function fallbackWriteText(text: string) {
  if (typeof document === "undefined") {
    return;
  }
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand("copy");
  } catch {
    // Last-resort fallback failed; hopper still holds the style.
  }
  document.body.removeChild(textArea);
}
