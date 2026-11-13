import { SketchGeometryType } from "../../generated/graphql";
import fromMarkdown, { questionBodyFromMarkdown } from "../fromMarkdown";

/**
 * Stock respondent copy for Spatial Access Priority.
 *
 * Polygon strings are the historical defaults. A survey that still has those
 * words keeps them while the question draws polygons. Switching the sketch
 * class to points substitutes the point copy, and a customized document is
 * left alone.
 */

// eslint-disable-next-line i18next/no-literal-string
export const polygonQuestionMarkdown = `# What sectors do you represent?

For each selection, you will be asked to draw and prioritize valued areas.`;

// eslint-disable-next-line i18next/no-literal-string
export const pointQuestionMarkdown = `# What sectors do you represent?

For each sector you select, place a point on the map for each valued place and set its priority.`;

// eslint-disable-next-line i18next/no-literal-string
export const polygonBeginMarkdown = `Use the map to indicate the most valued places for this activity. You can draw multiple areas and prioritize them individually.`;

// eslint-disable-next-line i18next/no-literal-string
export const pointBeginMarkdown = `Click the map to place a point on a valued place for this activity. You can place more than one point and set a priority for each.`;

// eslint-disable-next-line i18next/no-literal-string
export const polygonListMarkdown = `Add as many shapes as necessary to represent valued areas for this activity, then adjust their relative priority below. 

These scores will be summed among all survey responses to create a heatmap of valued areas.`;

// eslint-disable-next-line i18next/no-literal-string
export const pointListMarkdown = `Add as many points as you need for this activity, then set how important each location is.`;

// eslint-disable-next-line i18next/no-literal-string
export const polygonNavMarkdown = `# Your sectors
Please prioritize areas for each sector you represent.`;

// eslint-disable-next-line i18next/no-literal-string
export const pointNavMarkdown = `# Your sectors
Place and prioritize points for each sector you represent.`;

// eslint-disable-next-line i18next/no-literal-string
export const AREA_NAME_PREFIX = "Area";
// eslint-disable-next-line i18next/no-literal-string
export const POINT_NAME_PREFIX = "Point";

const polygonQuestionDoc = questionBodyFromMarkdown(polygonQuestionMarkdown);
const pointQuestionDoc = questionBodyFromMarkdown(pointQuestionMarkdown);
const polygonBeginDoc = fromMarkdown(polygonBeginMarkdown);
const pointBeginDoc = fromMarkdown(pointBeginMarkdown);
const polygonListDoc = fromMarkdown(polygonListMarkdown);
const pointListDoc = fromMarkdown(pointListMarkdown);
const polygonNavDoc = fromMarkdown(polygonNavMarkdown);
const pointNavDoc = fromMarkdown(pointNavMarkdown);
// eslint-disable-next-line i18next/no-literal-string
const areaNameDoc = questionBodyFromMarkdown(`# Area Name`);
// eslint-disable-next-line i18next/no-literal-string
const pointNameDoc = questionBodyFromMarkdown(`# Point Name`);
// eslint-disable-next-line i18next/no-literal-string
const areaImportanceDoc = questionBodyFromMarkdown(
  `# How important is this area?`
);
// eslint-disable-next-line i18next/no-literal-string
const pointImportanceDoc = questionBodyFromMarkdown(
  `# How important is this location?`
);

export type SapInstructionKind = "question" | "begin" | "list" | "nav";

const polygonDocs: Record<SapInstructionKind, unknown> = {
  question: polygonQuestionDoc,
  begin: polygonBeginDoc,
  list: polygonListDoc,
  nav: polygonNavDoc,
};

const pointDocs: Record<SapInstructionKind, unknown> = {
  question: pointQuestionDoc,
  begin: pointBeginDoc,
  list: pointListDoc,
  nav: pointNavDoc,
};

export function isPointGeometry(
  geometryType: SketchGeometryType | null | undefined
): boolean {
  return geometryType === SketchGeometryType.Point;
}

/** Visible text of a ProseMirror document. Empty for null and non-documents. */
export function proseText(doc: unknown): string {
  if (doc === null || doc === undefined || typeof doc !== "object") {
    return "";
  }
  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (node === null || node === undefined || typeof node !== "object") {
      return;
    }
    if ("text" in node && typeof node.text === "string") {
      parts.push(node.text);
    }
    if ("content" in node && Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
    }
  };
  walk(doc);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function polygonInstruction(kind: SapInstructionKind): unknown {
  return polygonDocs[kind];
}

export function resolveSapInstruction(
  kind: SapInstructionKind,
  stored: unknown,
  geometryType: SketchGeometryType | null | undefined
): unknown {
  const polygonDoc = polygonDocs[kind];
  const pointDoc = pointDocs[kind];
  const text = proseText(stored);
  if (isPointGeometry(geometryType)) {
    if (stored == null || text === proseText(polygonDoc)) {
      return pointDoc;
    }
    return stored;
  }
  if (stored == null) {
    return polygonDoc;
  }
  if (text === proseText(pointDoc)) {
    return polygonDoc;
  }
  return stored;
}

const instructionSettingKey: Record<SapInstructionKind, string> = {
  question: "body",
  begin: "beginBody",
  list: "listShapesBody",
  nav: "navBody",
};

function withoutInstructionTranslation(
  alternateLanguageSettings: { [key: string]: any } | null | undefined,
  kind: SapInstructionKind
): { [key: string]: any } {
  if (
    alternateLanguageSettings === null ||
    alternateLanguageSettings === undefined
  ) {
    return {};
  }
  const key = instructionSettingKey[kind];
  const next: { [lang: string]: any } = {};
  for (const [lang, value] of Object.entries(alternateLanguageSettings)) {
    if (value !== null && typeof value === "object" && key in value) {
      const copy = { ...value };
      delete copy[key];
      next[lang] = copy;
    } else {
      next[lang] = value;
    }
  }
  return next;
}

export function instructionPresentation(
  kind: SapInstructionKind,
  stored: unknown,
  geometryType: SketchGeometryType | null | undefined,
  alternateLanguageSettings: { [key: string]: any } | null | undefined,
  editable: boolean | undefined
): { body: any; alternateLanguageSettings: { [key: string]: any } } {
  const body = resolveSapInstruction(kind, stored, geometryType);
  if (!editable && instructionReplacedStock(kind, stored, geometryType)) {
    return {
      body,
      alternateLanguageSettings: withoutInstructionTranslation(
        alternateLanguageSettings,
        kind
      ),
    };
  }
  return { body, alternateLanguageSettings: alternateLanguageSettings || {} };
}

/**
 * True when the document shown to a respondent is stock copy for the other
 * geometry, so a translation written for the stored text would describe the
 * wrong kind of feature.
 */
export function instructionReplacedStock(
  kind: SapInstructionKind,
  stored: unknown,
  geometryType: SketchGeometryType | null | undefined
): boolean {
  const text = proseText(stored);
  if (isPointGeometry(geometryType)) {
    return stored == null || text === proseText(polygonDocs[kind]);
  }
  return text === proseText(pointDocs[kind]);
}

type InstructionSettings = {
  beginBody?: unknown;
  listShapesBody?: unknown;
  navBody?: unknown;
};

export function componentSettingsForGeometry<T extends InstructionSettings>(
  settings: T,
  geometryType: SketchGeometryType | null | undefined
): { settings: T; changed: boolean } {
  const next = { ...settings };
  let changed = false;
  const pairs: Array<[keyof InstructionSettings, SapInstructionKind]> = [
    ["beginBody", "begin"],
    ["listShapesBody", "list"],
    ["navBody", "nav"],
  ];
  for (const [key, kind] of pairs) {
    const resolved = resolveSapInstruction(kind, settings?.[key], geometryType);
    if (resolved !== settings?.[key]) {
      next[key] = resolved;
      changed = true;
    }
  }
  return { settings: next, changed };
}

export function alternateLanguageSettingsForGeometry(
  alternateLanguageSettings: { [key: string]: any } | null | undefined,
  settings: InstructionSettings,
  question: unknown,
  geometryType: SketchGeometryType | null | undefined
): { value: { [key: string]: any }; changed: boolean } {
  if (
    alternateLanguageSettings === null ||
    alternateLanguageSettings === undefined
  ) {
    return { value: {}, changed: false };
  }
  const drop: string[] = [];
  if (instructionReplacedStock("begin", settings.beginBody, geometryType)) {
    drop.push("beginBody");
  }
  if (instructionReplacedStock("list", settings.listShapesBody, geometryType)) {
    drop.push("listShapesBody");
  }
  if (instructionReplacedStock("nav", settings.navBody, geometryType)) {
    drop.push("navBody");
  }
  if (instructionReplacedStock("question", question, geometryType)) {
    drop.push("body");
  }
  if (drop.length === 0) {
    return { value: alternateLanguageSettings, changed: false };
  }
  let changed = false;
  const next: { [lang: string]: any } = {};
  for (const [lang, value] of Object.entries(alternateLanguageSettings)) {
    if (value !== null && typeof value === "object") {
      const copy: { [key: string]: any } = { ...value };
      for (const key of drop) {
        if (key in copy) {
          delete copy[key];
          changed = true;
        }
      }
      next[lang] = copy;
    } else {
      next[lang] = value;
    }
  }
  return {
    value: changed ? next : alternateLanguageSettings,
    changed,
  };
}

export function questionBodyForGeometry(
  body: unknown,
  geometryType: SketchGeometryType | null | undefined
): unknown | null {
  const resolved = resolveSapInstruction("question", body, geometryType);
  if (resolved === body) {
    return null;
  }
  return resolved;
}

type FeatureNameElement = {
  typeId: string;
  body: unknown;
  componentSettings: { generatedNamePrefix?: unknown } | null | undefined;
};

export function adaptFeatureNameElement<T extends FeatureNameElement>(
  element: T,
  geometryType: SketchGeometryType | null | undefined
): T {
  if (element.typeId !== "FeatureName") {
    return element;
  }
  const prefix = element.componentSettings?.generatedNamePrefix;
  const target = isPointGeometry(geometryType)
    ? { prefix: POINT_NAME_PREFIX, body: pointNameDoc }
    : { prefix: AREA_NAME_PREFIX, body: areaNameDoc };
  const source = isPointGeometry(geometryType)
    ? { prefix: AREA_NAME_PREFIX, body: areaNameDoc }
    : { prefix: POINT_NAME_PREFIX, body: pointNameDoc };
  if (
    prefix === source.prefix &&
    proseText(element.body) === proseText(source.body)
  ) {
    return {
      ...element,
      body: target.body,
      componentSettings: {
        ...element.componentSettings,
        generatedNamePrefix: target.prefix,
      },
    };
  }
  return element;
}

type PriorityElement = {
  typeId: string;
  body: unknown;
};

function adaptPriorityElement<T extends PriorityElement>(
  element: T,
  geometryType: SketchGeometryType | null | undefined
): T {
  if (element.typeId !== "SAPRange") {
    return element;
  }
  const target = isPointGeometry(geometryType)
    ? pointImportanceDoc
    : areaImportanceDoc;
  const source = isPointGeometry(geometryType)
    ? areaImportanceDoc
    : pointImportanceDoc;
  if (proseText(element.body) !== proseText(source)) {
    return element;
  }
  return {
    ...element,
    body: target,
  };
}

type SketchFormElement = FeatureNameElement & {
  alternateLanguageSettings?: { [key: string]: any } | null;
};

function withoutBodyTranslation(
  alternateLanguageSettings: { [key: string]: any } | null | undefined
): { [key: string]: any } | null | undefined {
  if (
    alternateLanguageSettings === null ||
    alternateLanguageSettings === undefined ||
    typeof alternateLanguageSettings !== "object"
  ) {
    return alternateLanguageSettings;
  }
  let changed = false;
  const next: { [lang: string]: any } = {};
  for (const [lang, value] of Object.entries(alternateLanguageSettings)) {
    if (value !== null && typeof value === "object" && "body" in value) {
      const copy = { ...value };
      delete copy.body;
      next[lang] = copy;
      changed = true;
    } else {
      next[lang] = value;
    }
  }
  return changed ? next : alternateLanguageSettings;
}

/**
 * Rewrites stock Feature Name and priority prompts when the geometry changes.
 * Custom wording is left in place. A replaced prompt drops translated copies
 * of the old wording.
 */
export function adaptSketchFormElement<T extends SketchFormElement>(
  element: T,
  geometryType: SketchGeometryType | null | undefined
): T {
  const adapted = adaptPriorityElement(
    adaptFeatureNameElement(element, geometryType),
    geometryType
  );
  if (adapted === element) {
    return element;
  }
  return {
    ...adapted,
    alternateLanguageSettings: withoutBodyTranslation(
      adapted.alternateLanguageSettings
    ),
  };
}

/** Positive sketch counts lock the geometry type. Missing counts stay unlocked. */
export function geometryTypeLocked(sketchCount: unknown): boolean {
  if (typeof sketchCount === "number") {
    return Number.isFinite(sketchCount) && sketchCount > 0;
  }
  if (typeof sketchCount === "string" && sketchCount.trim() !== "") {
    const count = Number(sketchCount);
    return Number.isFinite(count) && count > 0;
  }
  return false;
}
