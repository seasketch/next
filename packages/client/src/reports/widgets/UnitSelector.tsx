import { useTranslation } from "react-i18next";
import { LabeledDropdown } from "./LabeledDropdown";

type UnitSelectorProps = {
  value: "hectare" | "acre" | "mile" | "kilometer";
  onChange: (value: "hectare" | "acre" | "mile" | "kilometer") => void;
};

/**
 * Reusable unit selector dropdown for area units.
 */
export function UnitSelector({ value, onChange }: UnitSelectorProps) {
  const { t } = useTranslation("admin:reports");

  return (
    <LabeledDropdown
      label={t("Unit")}
      value={value}
      ariaLabel={t("Unit")}
      title={t("Area unit")}
      options={[
        { value: "kilometer", label: t("km²") },
        { value: "hectare", label: t("ha") },
        { value: "acre", label: t("acre") },
        { value: "mile", label: t("mi²") },
      ]}
      onChange={(value) =>
        onChange(value as "hectare" | "acre" | "mile" | "kilometer")
      }
    />
  );
}
