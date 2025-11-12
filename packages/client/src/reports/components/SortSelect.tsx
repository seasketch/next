import { useTranslation } from "react-i18next";

export type SortOption<T extends string> = {
  value: T;
  labelKey: string;
};

export default function SortSelect<T extends string>({
  value,
  onChange,
  options,
  descriptionKey,
  labelKey = "Sort items",
}: {
  value: T;
  onChange: (value: T) => void;
  options: SortOption<T>[];
  descriptionKey?: string;
  labelKey?: string;
}) {
  const { t } = useTranslation("admin:sketching");

  return (
    <div>
      <label className="text-sm font-medium text-gray-900">{t(labelKey)}</label>
      {descriptionKey && (
        <p className="text-xs text-gray-500 mt-1">{t(descriptionKey)}</p>
      )}
      <div className="mt-2">
        <select
          className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
