export type AreaUnit = "hectare" | "acre" | "mile" | "kilometer";
export type LengthUnit =
  | "mile"
  | "foot"
  | "meter"
  | "nautical-mile"
  | "kilometer";

export function isAreaUnit(unit: string): unit is AreaUnit {
  return (
    unit === "hectare" ||
    unit === "acre" ||
    unit === "mile" ||
    unit === "kilometer"
  );
}

export function isLengthUnit(unit: string): unit is LengthUnit {
  return (
    unit === "mile" ||
    unit === "foot" ||
    unit === "meter" ||
    unit === "nautical-mile" ||
    unit === "kilometer"
  );
}

/**
 * Gets a localized unit label using Intl.NumberFormat
 */
export function getLocalizedUnitLabel(
  unit: AreaUnit | LengthUnit,
  locale: string | undefined,
  isArea: boolean,
  unitDisplay: "short" | "long" = "long"
): string {
  const localeCode = locale || "en";

  try {
    const formatter = new Intl.NumberFormat(localeCode, {
      style: "unit",
      unit: unit,
      unitDisplay,
    });

    // Use formatToParts to extract just the unit part
    const parts = formatter.formatToParts(10);
    const unitPart = parts.find((part) => part.type === "unit");

    if (unitPart) {
      return unitPart.value;
    }
  } catch (error) {
    // Fallback to English if Intl API fails
    console.warn(`Failed to get localized unit label for ${unit}:`, error);
  }
  const fallbackMap: Record<string, string> = {
    kilometer: isArea ? "square kilometers" : "kilometers",
    hectare: "hectares",
    acre: "acres",
    mile: isArea ? "square miles" : "miles",
    meter: "meters",
    foot: "feet",
    "nautical-mile": "nautical miles",
  };
  return fallbackMap[unit] || unit;
}

export function convertSquareKilometersToUnit(sqKm: number, unit: AreaUnit) {
  if (unit === "hectare") {
    return sqKm * 100;
  } else if (unit === "acre") {
    return sqKm * 247.105381;
  } else if (unit === "mile") {
    return sqKm * 0.386102;
  }
  return sqKm;
}

export function convertKilometersToUnit(km: number, unit: LengthUnit) {
  if (unit === "mile") {
    return km * 0.621371;
  } else if (unit === "foot") {
    return km * 3280.84;
  } else if (unit === "meter") {
    return km * 1000;
  } else if (unit === "nautical-mile") {
    return km * 0.539957;
  }
  return km;
}
