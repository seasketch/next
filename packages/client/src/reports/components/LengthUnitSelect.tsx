import { useTranslation } from "react-i18next";
import { LengthDisplayUnit } from "../hooks/useUnits";

// Only km and mi are supported for linear overlap measurements
const SUPPORTED_LENGTH_UNITS: LengthDisplayUnit[] = ["km", "mi"];

export default function LengthUnitSelect({
  value,
  onChange,
  className,
}: {
  value?: LengthDisplayUnit;
  onChange: (unit: LengthDisplayUnit) => void;
  className?: string;
}) {
  const { t } = useTranslation("admin:sketching");
  const resolved = value ?? "km";
  return (
    <select
      className={
        className ||
        "w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
      }
      value={resolved}
      onChange={(e) => onChange(e.target.value as LengthDisplayUnit)}
    >
      {SUPPORTED_LENGTH_UNITS.map((u) => (
        <option key={u} value={u}>
          {u === "km" ? t("kilometers") : t("miles")}
        </option>
      ))}
    </select>
  );
}

