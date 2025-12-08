import { useCallback, useContext, useMemo } from "react";
import { FormLanguageContext } from "../../formElements/FormElement";
import { convertSquareKilometersToUnit } from "../utils/units";

export function useNumberFormatters({
  minimumFractionDigits,
  unit,
}: {
  minimumFractionDigits?: number;
  unit?: "hectare" | "acre" | "mile" | "kilometer";
} = {}) {
  unit = unit || "kilometer";
  const langContext = useContext(FormLanguageContext);

  const formatters = useMemo(() => {
    const smallAreaFormatter = new Intl.NumberFormat(langContext?.lang?.code, {
      style: "unit",
      unit: unit,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    const largeAreaFormatter = new Intl.NumberFormat(langContext?.lang?.code, {
      style: "unit",
      unit: unit,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    const smallPercentFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "percent",
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      }
    );
    const largePercentFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "percent",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }
    );
    const specifiedAreaFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "decimal",
        minimumFractionDigits: minimumFractionDigits || undefined,
      }
    );
    const specifiedPercentFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "percent",
        minimumFractionDigits: minimumFractionDigits || undefined,
      }
    );
    return {
      smallAreaFormatter,
      largeAreaFormatter,
      smallPercentFormatter,
      largePercentFormatter,
      specifiedAreaFormatter,
      specifiedPercentFormatter,
    };
  }, [langContext?.lang?.code, unit, minimumFractionDigits]);

  const area = useCallback(
    (value: number) => {
      if (unit !== "kilometer") {
        value = convertSquareKilometersToUnit(value, unit);
      }
      let formattedValue: string;
      if (minimumFractionDigits) {
        formattedValue = formatters.specifiedAreaFormatter.format(value);
      }
      if (value < 100) {
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
      if (minimumFractionDigits) {
        return formatters.specifiedPercentFormatter.format(value);
      }
      if (value === 0) {
        return formatters.smallPercentFormatter.format(value);
      } else if (value < 0.001) {
        return "< 0.1%";
      } else if (value < 0.05 && value > 0) {
        return formatters.smallPercentFormatter.format(value);
      } else {
        return formatters.largePercentFormatter.format(value);
      }
    },
    [formatters]
  );

  return {
    area,
    percent,
  };
}
