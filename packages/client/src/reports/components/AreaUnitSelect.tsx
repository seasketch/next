import { useTranslation } from "react-i18next";
import { AREA_UNITS, AreaDisplayUnit } from "../hooks/useUnits";

export default function AreaUnitSelect({
  value,
  onChange,
  className,
}: {
  value?: AreaDisplayUnit;
  onChange: (unit: AreaDisplayUnit) => void;
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
      onChange={(e) => onChange(e.target.value as AreaDisplayUnit)}
    >
      {AREA_UNITS.map((u) => (
        <option key={u} value={u}>
          {u === "km"
            ? t("km²")
            : u === "mi"
            ? t("mi²")
            : u === "acres"
            ? t("acres")
            : t("hectares")}
        </option>
      ))}
    </select>
  );
}


