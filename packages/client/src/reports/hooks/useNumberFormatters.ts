import { useCallback, useContext, useMemo } from "react";
import { FormLanguageContext } from "../../formElements/FormElement";
import {
  convertSquareKilometersToUnit,
  convertKilometersToUnit,
  AreaUnit,
  LengthUnit,
  isAreaUnit,
  isLengthUnit,
} from "../utils/units";

export function useNumberFormatters({
  minimumFractionDigits,
  unit,
  unitDisplay,
}: {
  minimumFractionDigits?: number;
  unit?: AreaUnit | LengthUnit;
  unitDisplay?: "long" | "short";
} = {}) {
  unit = unit || "kilometer";
  const langContext = useContext(FormLanguageContext);

  const formatters = useMemo(() => {
    const smallAreaFormatter = new Intl.NumberFormat(langContext?.lang?.code, {
      style: "unit",
      unit: unit,
      unitDisplay: unitDisplay,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    const largeAreaFormatter = new Intl.NumberFormat(langContext?.lang?.code, {
      style: "unit",
      unit: unit,
      unitDisplay: unitDisplay,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    const smallDistanceFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "unit",
        unit: unit,
        unitDisplay: unitDisplay,
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }
    );
    const largeDistanceFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "unit",
        unit: unit,
        unitDisplay: unitDisplay,
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }
    );
    const smallPercentFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "percent",
        unitDisplay: unitDisplay,
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      }
    );
    const largePercentFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "percent",
        unitDisplay: unitDisplay,
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }
    );
    const specifiedAreaFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "unit",
        unit: unit,
        unitDisplay: unitDisplay,
        minimumFractionDigits: minimumFractionDigits,
        maximumFractionDigits: minimumFractionDigits,
      }
    );
    const specifiedDistanceFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "unit",
        unit: unit,
        unitDisplay: unitDisplay,
        minimumFractionDigits: minimumFractionDigits,
        maximumFractionDigits: minimumFractionDigits,
      }
    );

    const specifiedPercentFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "percent",
        unitDisplay: unitDisplay,
        minimumFractionDigits: minimumFractionDigits,
        maximumFractionDigits: minimumFractionDigits,
      }
    );

    const smallDecimalFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "decimal",
        unitDisplay: unitDisplay,
        minimumFractionDigits: minimumFractionDigits,
        maximumFractionDigits: minimumFractionDigits,
      }
    );

    const largeDecimalFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "decimal",
        unitDisplay: unitDisplay,
        minimumFractionDigits: minimumFractionDigits,
        maximumFractionDigits: minimumFractionDigits,
      }
    );

    const specifiedDecimalFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "decimal",
        unitDisplay: unitDisplay,
        minimumFractionDigits: minimumFractionDigits,
        maximumFractionDigits: minimumFractionDigits,
      }
    );

    const countFormatter = new Intl.NumberFormat(langContext?.lang?.code);
    return {
      smallAreaFormatter,
      largeAreaFormatter,
      smallPercentFormatter,
      largePercentFormatter,
      specifiedAreaFormatter,
      specifiedPercentFormatter,
      specifiedDistanceFormatter,
      smallDistanceFormatter,
      largeDistanceFormatter,
      countFormatter,
      smallDecimalFormatter,
      largeDecimalFormatter,
      specifiedDecimalFormatter,
    };
  }, [langContext?.lang?.code, unit, minimumFractionDigits, unitDisplay]);

  const area = useCallback(
    (value: number) => {
      if (!isAreaUnit(unit)) {
        throw new Error(`Invalid area unit: ${unit}`);
      }
      value = convertSquareKilometersToUnit(value, unit);
      let formattedValue: string;
      if (minimumFractionDigits !== undefined) {
        formattedValue = formatters.specifiedAreaFormatter.format(value);
      } else if (value < 100) {
        formattedValue = formatters.smallAreaFormatter.format(value);
      } else {
        formattedValue = formatters.largeAreaFormatter.format(value);
      }
      if (unit === "kilometer" || unit === "mile") {
        formattedValue += "²";
      }
      return formattedValue;
    },
    [formatters, minimumFractionDigits, unit]
  );

  const distance = useCallback(
    (value: number) => {
      if (!isLengthUnit(unit)) {
        throw new Error(`Invalid length unit: ${unit}`);
      }
      value = convertKilometersToUnit(value, unit);
      let formattedValue: string;
      if (minimumFractionDigits !== undefined) {
        formattedValue = formatters.specifiedDistanceFormatter.format(value);
      } else if (value < 10) {
        formattedValue = formatters.smallDistanceFormatter.format(value);
      } else {
        formattedValue = formatters.largeDistanceFormatter.format(value);
      }
      return formattedValue;
    },
    [formatters, minimumFractionDigits, unit]
  );

  const percent = useCallback(
    (value: number) => {
      if (value > 1.02) {
        console.error(
          Error(`Percent value is greater than 100%. Value: ${value * 100}%`)
        );
        return "100%";
      } else if (value > 0.9999) {
        // Very small rounding issues are fine
        value = 1;
      }
      if (minimumFractionDigits !== undefined) {
        return formatters.specifiedPercentFormatter.format(value);
      }
      if (value === 0) {
        return formatters.smallPercentFormatter.format(value);
      } else if (value < 0.001) {
        return (
          "< " +
          Intl.NumberFormat(langContext?.lang?.code, {
            style: "percent",
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(0.001)
        );
      } else if (value < 0.05 && value > 0) {
        return formatters.smallPercentFormatter.format(value);
      } else {
        return formatters.largePercentFormatter.format(value);
      }
    },
    [formatters, minimumFractionDigits, langContext?.lang?.code]
  );

  const decimal = useCallback(
    (value: number) => {
      if (minimumFractionDigits !== undefined) {
        return formatters.specifiedDecimalFormatter.format(value);
      }
      if (value < 10) {
        return formatters.smallDecimalFormatter.format(value);
      } else {
        return formatters.largeDecimalFormatter.format(value);
      }
    },
    [formatters, minimumFractionDigits]
  );

  return {
    area,
    percent,
    distance,
    count: formatters.countFormatter.format.bind(formatters.countFormatter),
    decimal,
  };
}
