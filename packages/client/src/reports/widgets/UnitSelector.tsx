import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FormLanguageContext } from "../../formElements/FormElement";
import { LabeledDropdown } from "./LabeledDropdown";
import { AreaUnit, LengthUnit } from "../utils/units";

type UnitSelectorAreaProps = {
  unitType: "area";
  value: AreaUnit;
  onChange: (value: AreaUnit) => void;
  unitDisplay?: "short" | "long";
  onUnitDisplayChange?: (display: "short" | "long") => void;
};

type UnitSelectorDistanceProps = {
  unitType: "distance";
  value: LengthUnit;
  onChange: (value: LengthUnit) => void;
  unitDisplay?: "short" | "long";
  onUnitDisplayChange?: (display: "short" | "long") => void;
};

export type UnitSelectorProps =
  | UnitSelectorAreaProps
  | UnitSelectorDistanceProps;

function unitDisplayToggleOption(
  unitDisplay: "short" | "long",
  onUnitDisplayChange: ((display: "short" | "long") => void) | undefined,
  label: string
) {
  return {
    value: "__unitDisplay:toggle__",
    label: (
      <div className="flex items-center gap-2 space-x-2 text-gray-600 text-xs font-semibold border-t border-black/10 pt-1.5">
        <span>{label}</span>
        <input
          type="checkbox"
          checked={unitDisplay === "short"}
          readOnly
          className="h-3 w-3 rounded border-gray-300 text-gray-600 focus:ring-gray-500"
        />
      </div>
    ),
    preventCloseOnSelect: true,
    className:
      "px-2 py-1 text-sm flex items-center gap-2 rounded cursor-pointer hover:bg-transparent focus:bg-transparent",
    onSelect: () => {
      const nextDisplay = unitDisplay === "short" ? "long" : "short";
      onUnitDisplayChange?.(nextDisplay);
    },
  };
}

/**
 * Gets a localized unit label using Intl.NumberFormat
 */
function getLocalizedUnitLabel(
  unit: AreaUnit | LengthUnit,
  locale: string | undefined,
  isArea: boolean
): string {
  const localeCode = locale || "en";

  try {
    const formatter = new Intl.NumberFormat(localeCode, {
      style: "unit",
      unit: unit,
      unitDisplay: "long",
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

function UnitSelectorArea({
  value,
  onChange,
  unitDisplay = "short",
  onUnitDisplayChange,
}: {
  value: AreaUnit;
  onChange: (value: AreaUnit) => void;
  unitDisplay?: "short" | "long";
  onUnitDisplayChange?: (display: "short" | "long") => void;
}) {
  const { t } = useTranslation("admin:reports");
  const langContext = useContext(FormLanguageContext);

  const options = useMemo(() => {
    const locale = langContext?.lang?.code?.toLowerCase() || "en";
    const unitOptions = [
      {
        value: "kilometer" as AreaUnit,
        label: getLocalizedUnitLabel("kilometer", locale, true),
      },
      {
        value: "hectare" as AreaUnit,
        label: getLocalizedUnitLabel("hectare", locale, true),
      },
      {
        value: "acre" as AreaUnit,
        label: getLocalizedUnitLabel("acre", locale, true),
      },
      {
        value: "mile" as AreaUnit,
        label: getLocalizedUnitLabel("mile", locale, true),
      },
    ];

    if (onUnitDisplayChange) {
      return [
        ...unitOptions,
        unitDisplayToggleOption(
          unitDisplay,
          onUnitDisplayChange,
          t("short labels")
        ),
      ];
    }

    return unitOptions;
  }, [langContext?.lang?.code, unitDisplay, onUnitDisplayChange, t]);

  const handleChange = (selectedValue: string) => {
    if (selectedValue === "__unitDisplay:toggle__") {
      const nextDisplay = unitDisplay === "short" ? "long" : "short";
      onUnitDisplayChange?.(nextDisplay);
    } else {
      onChange(selectedValue as AreaUnit);
    }
  };

  return (
    <LabeledDropdown
      label={t("Unit")}
      value={value}
      ariaLabel={t("Unit")}
      title={t("Area unit")}
      options={options}
      onChange={(val) => handleChange(val)}
    />
  );
}

function UnitSelectorDistance({
  value,
  onChange,
  unitDisplay = "short",
  onUnitDisplayChange,
}: {
  value: LengthUnit;
  onChange: (value: LengthUnit) => void;
  unitDisplay?: "short" | "long";
  onUnitDisplayChange?: (display: "short" | "long") => void;
}) {
  const { t } = useTranslation("admin:reports");
  const langContext = useContext(FormLanguageContext);

  const options = useMemo(() => {
    const locale = langContext?.lang?.code?.toLowerCase() || "en";
    const unitOptions = [
      {
        value: "kilometer" as LengthUnit,
        label: getLocalizedUnitLabel("kilometer", locale, false),
      },
      {
        value: "meter" as LengthUnit,
        label: getLocalizedUnitLabel("meter", locale, false),
      },
      {
        value: "mile" as LengthUnit,
        label: getLocalizedUnitLabel("mile", locale, false),
      },
      {
        value: "foot" as LengthUnit,
        label: getLocalizedUnitLabel("foot", locale, false),
      },
      // { value: "nautical-mile" as LengthUnit, label: getLocalizedUnitLabel("nautical-mile", locale, false, unitDisplay) },
    ];

    if (onUnitDisplayChange) {
      return [
        ...unitOptions,
        unitDisplayToggleOption(
          unitDisplay,
          onUnitDisplayChange,
          t("short labels")
        ),
      ];
    }

    return unitOptions;
  }, [langContext?.lang?.code, unitDisplay, onUnitDisplayChange, t]);

  const handleChange = (selectedValue: string) => {
    if (selectedValue === "__unitDisplay:toggle__") {
      const nextDisplay = unitDisplay === "short" ? "long" : "short";
      onUnitDisplayChange?.(nextDisplay);
    } else {
      onChange(selectedValue as LengthUnit);
    }
  };

  return (
    <LabeledDropdown
      label={t("Unit")}
      value={value}
      ariaLabel={t("Unit")}
      title={t("Distance unit")}
      options={options}
      onChange={(val) => handleChange(val)}
    />
  );
}

/**
 * Reusable unit selector dropdown for area or distance units.
 */
export function UnitSelector(props: UnitSelectorProps): JSX.Element {
  if (props.unitType === "area") {
    return (
      <UnitSelectorArea
        value={props.value}
        onChange={props.onChange}
        unitDisplay={props.unitDisplay}
        onUnitDisplayChange={props.onUnitDisplayChange}
      />
    );
  } else {
    return (
      <UnitSelectorDistance
        value={props.value}
        onChange={props.onChange}
        unitDisplay={props.unitDisplay}
        onUnitDisplayChange={props.onUnitDisplayChange}
      />
    );
  }
}
