import { CkanSchema } from "./types";

function isMachineTranslationKey(key: string): boolean {
  return key.includes("-t-");
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function baseLanguage(code: string): string {
  const normalized = normalizeKey(code);
  const dash = normalized.indexOf("-");
  return dash === -1 ? normalized : normalized.slice(0, dash);
}

export function negotiateCkanLocale(
  requested: string | undefined | null,
  availableKeys: string[],
  schema?: CkanSchema | null
): string | undefined {
  if (!availableKeys.length) {
    return undefined;
  }

  const available = availableKeys.filter((key) => typeof key === "string");
  if (!available.length) {
    return undefined;
  }

  if (requested && requested.trim().length > 0) {
    const wanted = normalizeKey(requested);
    const exact = available.find((key) => normalizeKey(key) === wanted);
    if (exact) {
      return exact;
    }

    const wantedBase = baseLanguage(requested);
    const humanBase = available.find(
      (key) =>
        !isMachineTranslationKey(key) &&
        (normalizeKey(key) === wantedBase || baseLanguage(key) === wantedBase)
    );
    if (humanBase) {
      return humanBase;
    }

    const machine = available.find(
      (key) =>
        isMachineTranslationKey(key) &&
        (normalizeKey(key).startsWith(`${wantedBase}-`) ||
          baseLanguage(key) === wantedBase)
    );
    if (machine) {
      return machine;
    }
  }

  const formLanguages = schema?.form_languages ?? [];
  for (const formLang of formLanguages) {
    const match = available.find(
      (key) => normalizeKey(key) === normalizeKey(formLang)
    );
    if (match) {
      return match;
    }
  }

  const english = available.find((key) => normalizeKey(key) === "en");
  if (english) {
    return english;
  }

  return available[0];
}

export function resolveFluent(
  value: unknown,
  requested: string | undefined | null,
  schema?: CkanSchema | null
): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) {
    return undefined;
  }
  const looksFluent = keys.every(
    (key) => typeof key === "string" && /^[a-z]{2}(?:[-_][a-z0-9-]+)?$/i.test(key)
  );
  if (!looksFluent) {
    return value;
  }
  const locale = negotiateCkanLocale(requested, keys, schema);
  if (locale && locale in record) {
    return record[locale];
  }
  return record[keys[0]];
}

export function resolveFluentLabel(
  label: unknown,
  requested: string | undefined | null,
  schema?: CkanSchema | null
): string | undefined {
  if (typeof label === "string" && label.trim().length > 0) {
    return label;
  }
  const resolved = resolveFluent(label, requested, schema);
  return typeof resolved === "string" && resolved.trim().length > 0
    ? resolved
    : undefined;
}
