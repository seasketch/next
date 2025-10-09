import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export type UnitCategory = "area" | "length";

// For backwards-compatibility with existing component settings, area units use
// "km" to mean km² and "mi" to mean mi²
export type AreaDisplayUnit = "km" | "mi" | "acres" | "ha";

export type LengthDisplayUnit = "km" | "mi" | "nm" | "m";

export function useUnits(
  options:
    | { category: "area"; unit?: AreaDisplayUnit }
    | { category: "length"; unit?: LengthDisplayUnit }
) {
  const { t } = useTranslation("reports");
  const isArea = options.category === "area";
  const providedAreaUnit = (isArea ? options.unit : undefined) as
    | AreaDisplayUnit
    | undefined;
  const providedLengthUnit = (!isArea ? options.unit : undefined) as
    | LengthDisplayUnit
    | undefined;

  // Resolve both paths so hooks aren't conditional
  const resolvedAreaUnit = useMemo<AreaDisplayUnit>(() => {
    return providedAreaUnit === "mi" ||
      providedAreaUnit === "acres" ||
      providedAreaUnit === "ha"
      ? providedAreaUnit
      : "km";
  }, [providedAreaUnit]);

  const resolvedLengthUnit = useMemo<LengthDisplayUnit>(() => {
    return providedLengthUnit &&
      ["km", "mi", "nm", "m"].includes(providedLengthUnit)
      ? providedLengthUnit
      : "km";
  }, [providedLengthUnit]);

  const unitLabel = useMemo(() => {
    if (isArea) {
      if (resolvedAreaUnit === "mi") return t("mi²");
      if (resolvedAreaUnit === "acres") return t("acres");
      if (resolvedAreaUnit === "ha") return t("hectares");
      return t("km²");
    }
    if (resolvedLengthUnit === "mi") return t("miles");
    if (resolvedLengthUnit === "nm") return t("nautical miles");
    if (resolvedLengthUnit === "m") return t("meters");
    return t("kilometers");
  }, [isArea, resolvedAreaUnit, resolvedLengthUnit, t]);

  const convertFromBase = useMemo(() => {
    if (isArea) {
      // Base unit is km²
      return (km2: number) => {
        if (resolvedAreaUnit === "mi") return km2 / 2.59; // square miles per km²
        if (resolvedAreaUnit === "acres") return km2 * 247.105381; // acres per km²
        if (resolvedAreaUnit === "ha") return km2 * 100; // hectares per km²
        return km2; // km²
      };
    }
    // Base unit is km
    return (km: number) => {
      if (resolvedLengthUnit === "mi") return km * 0.621371;
      if (resolvedLengthUnit === "nm") return km * 0.539957;
      if (resolvedLengthUnit === "m") return km * 1000;
      return km; // km
    };
  }, [isArea, resolvedAreaUnit, resolvedLengthUnit]);

  const unit = (isArea ? resolvedAreaUnit : resolvedLengthUnit) as
    | AreaDisplayUnit
    | LengthDisplayUnit;

  return { unit, unitLabel, convertFromBase } as const;
}
