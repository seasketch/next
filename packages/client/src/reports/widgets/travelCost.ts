/**
 * Client-only fuel cost for a distance the map already calculated.
 * Length factors match `convertKilometersToUnit` so a mile or nautical mile
 * here is the same mile the distance label uses.
 */

export type TravelCostVolume = "liter" | "gallon" | "imperial-gallon";
export type TravelCostEfficiencyMode =
  | "distance-per-volume"
  | "volume-per-distance";
export type TravelCostLength = "kilometer" | "nautical-mile" | "mile";

export type TravelCostSettings = {
  enabled: boolean;
  /** ISO 4217 code, or empty until the author sets one. */
  currency: string;
  volume: TravelCostVolume;
  efficiencyMode: TravelCostEfficiencyMode;
  efficiencyLength: TravelCostLength;
  /** Blank is null. */
  defaultEfficiency: number | null;
  defaultPrice: number | null;
};

export type TravelCostEstimate = {
  liters: number;
  oneWay: number;
  roundTrip: number;
};

const VOLUMES: readonly TravelCostVolume[] = [
  "liter",
  "gallon",
  "imperial-gallon",
];
const MODES: readonly TravelCostEfficiencyMode[] = [
  "distance-per-volume",
  "volume-per-distance",
];
const LENGTHS: readonly TravelCostLength[] = [
  "kilometer",
  "nautical-mile",
  "mile",
];

const MILES_PER_KM = 0.621371;
const NAUTICAL_MILES_PER_KM = 0.539957;
const LITERS_PER_US_GALLON = 3.785411784;
const LITERS_PER_IMPERIAL_GALLON = 4.54609;

const LENGTH_SYMBOL: Record<TravelCostLength, string> = {
  kilometer: "km",
  "nautical-mile": "nmi",
  mile: "mi",
};

const VOLUME_SYMBOL: Record<TravelCostVolume, string> = {
  liter: "L",
  gallon: "gal",
  "imperial-gallon": "imp gal",
};

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isBlankOrFinite(value: unknown): value is number | null {
  if (value === null) return true;
  return typeof value === "number" && Number.isFinite(value);
}

export function isTravelCostSettings(
  value: unknown
): value is TravelCostSettings {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (!("enabled" in value) || typeof value.enabled !== "boolean") return false;
  if (!("currency" in value) || typeof value.currency !== "string") return false;
  if (!("volume" in value) || !isOneOf(value.volume, VOLUMES)) return false;
  if (!("efficiencyMode" in value) || !isOneOf(value.efficiencyMode, MODES)) {
    return false;
  }
  if (!("efficiencyLength" in value) || !isOneOf(value.efficiencyLength, LENGTHS)) {
    return false;
  }
  if (!("defaultEfficiency" in value) || !isBlankOrFinite(value.defaultEfficiency)) {
    return false;
  }
  if (!("defaultPrice" in value) || !isBlankOrFinite(value.defaultPrice)) {
    return false;
  }
  return true;
}

export function readTravelCost(value: unknown): TravelCostSettings | null {
  return isTravelCostSettings(value) ? value : null;
}

/**
 * Liters, blank numbers, and an efficiency length that matches the map when it can.
 * Stays off until a currency, fuel use, and price are all set.
 */
export function defaultTravelCostSettings(
  mapUnit: string | undefined
): TravelCostSettings {
  const efficiencyLength =
    mapUnit === "kilometer" ||
    mapUnit === "mile" ||
    mapUnit === "nautical-mile"
      ? mapUnit
      : "kilometer";
  return {
    enabled: false,
    currency: "",
    volume: "liter",
    efficiencyMode: "distance-per-volume",
    efficiencyLength,
    defaultEfficiency: null,
    defaultPrice: null,
  };
}

export type CurrencyChoice = {
  code: string;
  /** Localized name from Intl.DisplayNames, or the code when a name is unavailable. */
  name: string;
};

export function listCurrencyChoices(locale?: string): CurrencyChoice[] {
  if (typeof Intl.supportedValuesOf !== "function") return [];
  let display: Intl.DisplayNames | null = null;
  if (typeof Intl.DisplayNames === "function") {
    try {
      display = new Intl.DisplayNames(locale ? [locale] : undefined, {
        type: "currency",
      });
    } catch {
      display = null;
    }
  }
  const choices = Intl.supportedValuesOf("currency").map((code) => {
    let name = code;
    if (display) {
      try {
        const resolved = display.of(code);
        if (resolved && resolved.toUpperCase() !== code) name = resolved;
      } catch {
        name = code;
      }
    }
    return { code, name };
  });
  choices.sort((a, b) => a.name.localeCompare(b.name, locale));
  return choices;
}

export function isRecognizedCurrency(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return false;
  // A 3-letter code is "well-formed" even when it is not a real currency, so
  // NumberFormat will not throw. The supported list is the actual check.
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("currency").includes(normalized);
  }
  try {
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: normalized,
    });
    return true;
  } catch {
    return false;
  }
}

export function formatTravelCost(
  amount: number,
  currency: string,
  locale?: string
): string | null {
  if (!Number.isFinite(amount)) return null;
  const code = currency.trim().toUpperCase();
  if (!isRecognizedCurrency(code)) return null;
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: "currency",
      currency: code,
      currencyDisplay: "code",
    }).format(amount);
  } catch {
    return null;
  }
}

function kmPerLength(length: TravelCostLength): number {
  if (length === "mile") return 1 / MILES_PER_KM;
  if (length === "nautical-mile") return 1 / NAUTICAL_MILES_PER_KM;
  return 1;
}

function litersPerVolume(volume: TravelCostVolume): number {
  if (volume === "gallon") return LITERS_PER_US_GALLON;
  if (volume === "imperial-gallon") return LITERS_PER_IMPERIAL_GALLON;
  return 1;
}

export function kmPerLiter(
  efficiency: number,
  units: Pick<
    TravelCostSettings,
    "volume" | "efficiencyMode" | "efficiencyLength"
  >
): number | null {
  if (!(efficiency > 0) || !Number.isFinite(efficiency)) return null;
  const km = kmPerLength(units.efficiencyLength);
  const liters = litersPerVolume(units.volume);
  const rate =
    units.efficiencyMode === "distance-per-volume"
      ? (efficiency * km) / liters
      : km / (efficiency * liters);
  return rate > 0 && Number.isFinite(rate) ? rate : null;
}

function roundForStorage(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function travelCostForMeters(
  meters: number,
  units: Pick<
    TravelCostSettings,
    "volume" | "efficiencyMode" | "efficiencyLength"
  >,
  efficiency: number,
  price: number
): TravelCostEstimate | null {
  if (!(meters >= 0) || !Number.isFinite(meters)) return null;
  const rate = kmPerLiter(efficiency, units);
  const perLiter = price / litersPerVolume(units.volume);
  if (rate == null || !(perLiter > 0) || !Number.isFinite(perLiter)) return null;
  const liters = meters / 1000 / rate;
  if (!Number.isFinite(liters)) return null;
  const oneWay = liters * perLiter;
  if (!Number.isFinite(oneWay)) return null;
  return { liters, oneWay, roundTrip: oneWay * 2 };
}

export function travelCostFromDefaults(
  meters: number,
  settings: TravelCostSettings
): TravelCostEstimate | null {
  if (settings.defaultEfficiency == null || settings.defaultPrice == null) {
    return null;
  }
  return travelCostForMeters(
    meters,
    settings,
    settings.defaultEfficiency,
    settings.defaultPrice
  );
}

/** Positive finite text, or null when the field is blank or not a usable rate. */
export function parseTravelCostNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || !(value > 0)) return null;
  return value;
}

export function travelCostNumberText(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return String(value);
}

export function efficiencyUnitLabel(
  settings: Pick<
    TravelCostSettings,
    "volume" | "efficiencyMode" | "efficiencyLength"
  >
): string {
  const length = LENGTH_SYMBOL[settings.efficiencyLength];
  const volume = VOLUME_SYMBOL[settings.volume];
  return settings.efficiencyMode === "distance-per-volume"
    ? `${length}/${volume}`
    : `${volume}/${length}`;
}

export function priceUnitLabel(
  settings: Pick<TravelCostSettings, "volume" | "currency">
): string {
  const volume = VOLUME_SYMBOL[settings.volume];
  const code = settings.currency.trim().toUpperCase();
  return code ? `${code}/${volume}` : `/${volume}`;
}

/**
 * Express the same fuel use and price in another volume, length, or mode.
 * Blank stays blank. A non-positive efficiency is left as stored.
 */
export function convertTravelCostNumbers(
  current: TravelCostSettings,
  next: Pick<
    TravelCostSettings,
    "volume" | "efficiencyMode" | "efficiencyLength"
  >
): { defaultEfficiency: number | null; defaultPrice: number | null } {
  return {
    defaultEfficiency: convertEfficiency(current, next),
    defaultPrice: convertPrice(current.defaultPrice, current.volume, next.volume),
  };
}

function convertEfficiency(
  current: TravelCostSettings,
  next: Pick<
    TravelCostSettings,
    "volume" | "efficiencyMode" | "efficiencyLength"
  >
): number | null {
  if (current.defaultEfficiency == null) return null;
  if (!(current.defaultEfficiency > 0)) return current.defaultEfficiency;
  const rate = kmPerLiter(current.defaultEfficiency, current);
  if (rate == null) return current.defaultEfficiency;
  const km = kmPerLength(next.efficiencyLength);
  const liters = litersPerVolume(next.volume);
  const expressed =
    next.efficiencyMode === "distance-per-volume"
      ? (rate * liters) / km
      : km / (rate * liters);
  if (!Number.isFinite(expressed)) return current.defaultEfficiency;
  return roundForStorage(expressed);
}

function convertPrice(
  price: number | null,
  from: TravelCostVolume,
  to: TravelCostVolume
): number | null {
  if (price == null || !Number.isFinite(price)) return null;
  if (from === to) return price;
  return roundForStorage((price / litersPerVolume(from)) * litersPerVolume(to));
}

export function withTravelCostPatch(
  current: TravelCostSettings,
  patch: Partial<TravelCostSettings>
): TravelCostSettings {
  const nextUnits = {
    volume: patch.volume ?? current.volume,
    efficiencyMode: patch.efficiencyMode ?? current.efficiencyMode,
    efficiencyLength: patch.efficiencyLength ?? current.efficiencyLength,
  };
  const unitsChanged =
    nextUnits.volume !== current.volume ||
    nextUnits.efficiencyMode !== current.efficiencyMode ||
    nextUnits.efficiencyLength !== current.efficiencyLength;
  if (!unitsChanged) return { ...current, ...patch };
  return {
    ...current,
    ...patch,
    ...nextUnits,
    ...convertTravelCostNumbers(current, nextUnits),
  };
}

export function travelCostsUsable(settings: TravelCostSettings): boolean {
  return (
    isRecognizedCurrency(settings.currency) &&
    travelCostFromDefaults(1000, settings) != null
  );
}

/** Viewer edits for one report card, kept in this browser only. */
export type FuelCostClientOverrides = {
  efficiency: string;
  price: string;
  volume: TravelCostVolume;
  efficiencyMode: TravelCostEfficiencyMode;
  efficiencyLength: TravelCostLength;
  currency: string;
};

export function fuelCostStorageKey(reportCardId: number): string {
  // Storage key, not copy.
  // eslint-disable-next-line i18next/no-literal-string
  return `${reportCardId}-fuel-costs`;
}

export function isFuelCostClientOverrides(
  value: unknown
): value is FuelCostClientOverrides {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  if (!("efficiency" in value) || typeof value.efficiency !== "string") {
    return false;
  }
  if (!("price" in value) || typeof value.price !== "string") return false;
  if (!("volume" in value) || !isOneOf(value.volume, VOLUMES)) return false;
  if (!("efficiencyMode" in value) || !isOneOf(value.efficiencyMode, MODES)) {
    return false;
  }
  if (
    !("efficiencyLength" in value) ||
    !isOneOf(value.efficiencyLength, LENGTHS)
  ) {
    return false;
  }
  if (!("currency" in value) || typeof value.currency !== "string") return false;
  return true;
}

export function fuelCostOverridesMatchSettings(
  overrides: FuelCostClientOverrides,
  settings: TravelCostSettings
): boolean {
  return (
    overrides.volume === settings.volume &&
    overrides.efficiencyMode === settings.efficiencyMode &&
    overrides.efficiencyLength === settings.efficiencyLength &&
    overrides.currency.trim().toUpperCase() ===
      settings.currency.trim().toUpperCase()
  );
}

export function readFuelCostClientOverrides(
  reportCardId: number
): FuelCostClientOverrides | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(fuelCostStorageKey(reportCardId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isFuelCostClientOverrides(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeFuelCostClientOverrides(
  reportCardId: number,
  value: FuelCostClientOverrides
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      fuelCostStorageKey(reportCardId),
      JSON.stringify(value)
    );
  } catch {
    // A full quota or private-mode storage should not break the tab.
  }
}

export function clearFuelCostClientOverrides(reportCardId: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(fuelCostStorageKey(reportCardId));
  } catch {
    // Ignore storage failures.
  }
}
