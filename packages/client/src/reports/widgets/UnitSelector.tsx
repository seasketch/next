import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FormLanguageContext } from "../../formElements/FormElement";
import { LabeledDropdown } from "./LabeledDropdown";
import { AreaUnit, LengthUnit, getLocalizedUnitLabel } from "../utils/units";

type UnitSelectorAreaProps = {
  unitType: "area";
  value: AreaUnit;
  onChange: (value: AreaUnit) => void;
  unitDisplay?: "short" | "long";
  onUnitDisplayChange?: (display: "short" | "long") => void;
  allowNone?: false;
};

type UnitSelectorAreaOptionalProps = {
  unitType: "area";
  value?: AreaUnit;
  onChange: (value?: AreaUnit) => void;
  unitDisplay?: "short" | "long";
  onUnitDisplayChange?: (display: "short" | "long") => void;
  allowNone: true;
};

type UnitSelectorDistanceProps = {
  unitType: "distance";
  value: LengthUnit;
  onChange: (value: LengthUnit) => void;
  unitDisplay?: "short" | "long";
  onUnitDisplayChange?: (display: "short" | "long") => void;
  allowNone?: false;
};

type UnitSelectorDistanceOptionalProps = {
  unitType: "distance";
  value?: LengthUnit;
  onChange: (value?: LengthUnit) => void;
  unitDisplay?: "short" | "long";
  onUnitDisplayChange?: (display: "short" | "long") => void;
  allowNone: true;
};

export type UnitSelectorProps =
  | UnitSelectorAreaProps
  | UnitSelectorAreaOptionalProps
  | UnitSelectorDistanceProps
  | UnitSelectorDistanceOptionalProps;

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

function UnitSelectorArea({
  value,
  onChange,
  unitDisplay = "short",
  onUnitDisplayChange,
  allowNone,
}: {
  value?: AreaUnit;
  onChange: (value?: AreaUnit) => void;
  unitDisplay?: "short" | "long";
  onUnitDisplayChange?: (display: "short" | "long") => void;
  allowNone?: boolean;
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
    const noneOption = allowNone
      ? [{ value: "__unit:none__", label: t("None") }]
      : [];

    if (onUnitDisplayChange) {
      return [
        ...noneOption,
        ...unitOptions,
        unitDisplayToggleOption(
          unitDisplay,
          onUnitDisplayChange,
          t("short labels")
        ),
      ];
    }

    return [...noneOption, ...unitOptions];
  }, [langContext?.lang?.code, unitDisplay, onUnitDisplayChange, t, allowNone]);

  const handleChange = (selectedValue: string) => {
    if (selectedValue === "__unitDisplay:toggle__") {
      const nextDisplay = unitDisplay === "short" ? "long" : "short";
      onUnitDisplayChange?.(nextDisplay);
    } else if (selectedValue === "__unit:none__") {
      onChange(undefined);
    } else {
      onChange(selectedValue as AreaUnit);
    }
  };

  return (
    <LabeledDropdown
      label={t("Unit")}
      value={value || "__unit:none__"}
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
  allowNone,
}: {
  value?: LengthUnit;
  onChange: (value?: LengthUnit) => void;
  unitDisplay?: "short" | "long";
  onUnitDisplayChange?: (display: "short" | "long") => void;
  allowNone?: boolean;
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
    const noneOption = allowNone
      ? [{ value: "__unit:none__", label: t("None") }]
      : [];

    if (onUnitDisplayChange) {
      return [
        ...noneOption,
        ...unitOptions,
        unitDisplayToggleOption(
          unitDisplay,
          onUnitDisplayChange,
          t("short labels")
        ),
      ];
    }

    return [...noneOption, ...unitOptions];
  }, [langContext?.lang?.code, unitDisplay, onUnitDisplayChange, t, allowNone]);

  const handleChange = (selectedValue: string) => {
    if (selectedValue === "__unitDisplay:toggle__") {
      const nextDisplay = unitDisplay === "short" ? "long" : "short";
      onUnitDisplayChange?.(nextDisplay);
    } else if (selectedValue === "__unit:none__") {
      onChange(undefined);
    } else {
      onChange(selectedValue as LengthUnit);
    }
  };

  return (
    <LabeledDropdown
      label={t("Unit")}
      value={value || "__unit:none__"}
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
    const handleChange = props.allowNone
      ? props.onChange
      : (value?: AreaUnit) => {
          if (value === undefined) return;
          props.onChange(value);
        };
    return (
      <UnitSelectorArea
        value={props.value}
        onChange={handleChange}
        unitDisplay={props.unitDisplay}
        onUnitDisplayChange={props.onUnitDisplayChange}
        allowNone={props.allowNone}
      />
    );
  } else {
    const handleChange = props.allowNone
      ? props.onChange
      : (value?: LengthUnit) => {
          if (value === undefined) return;
          props.onChange(value);
        };
    return (
      <UnitSelectorDistance
        value={props.value}
        onChange={handleChange}
        unitDisplay={props.unitDisplay}
        onUnitDisplayChange={props.onUnitDisplayChange}
        allowNone={props.allowNone}
      />
    );
  }
}
