import { useCallback, useContext, useMemo } from "react";
import { FormLanguageContext } from "../../formElements/FormElement";

export function useNumberFormatters() {
  const langContext = useContext(FormLanguageContext);

  const formatters = useMemo(() => {
    const smallAreaFormatter = new Intl.NumberFormat(langContext?.lang?.code, {
      style: "decimal",
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    });
    const largeAreaFormatter = new Intl.NumberFormat(langContext?.lang?.code, {
      style: "decimal",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    });
    const smallPercentFormatter = new Intl.NumberFormat(
      langContext?.lang?.code,
      {
        style: "percent",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
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
    return {
      smallAreaFormatter,
      largeAreaFormatter,
      smallPercentFormatter,
      largePercentFormatter,
    };
  }, [langContext?.lang?.code]);

  const area = useCallback(
    (value: number) => {
      if (value < 100) {
        return formatters.smallAreaFormatter.format(value);
      } else {
        return formatters.largeAreaFormatter.format(value);
      }
    },
    [formatters]
  );

  const percent = useCallback(
    (value: number) => {
      if (value < 5 && value > 0) {
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
