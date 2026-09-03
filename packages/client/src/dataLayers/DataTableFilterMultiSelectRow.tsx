import { useTranslation } from "react-i18next";
import { visibleSelectionStatus } from "./dataTableFilterSelection";

/**
 * Footer row for data-table value filters: the multi-select checkbox plus
 * All / None actions that apply to the currently visible option list.
 */
export default function DataTableFilterMultiSelectRow({
  multi,
  selected,
  visibleValues,
  onMultiToggle,
  onSelectAll,
  onSelectNone,
}: {
  multi: boolean;
  selected: string[];
  visibleValues: string[];
  onMultiToggle: (enabled: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
  const { t } = useTranslation("homepage");
  const { allSelected, noneSelected } = visibleSelectionStatus(
    selected,
    visibleValues
  );
  const noVisible = visibleValues.length === 0;

  return (
    <div className="flex items-center justify-between gap-2">
      <label className="flex min-w-0 items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          className="rounded border-gray-300 text-primary-600 focus:ring-0 focus-visible:ring-1 focus-visible:ring-primary-500"
          checked={multi}
          onChange={(e) => onMultiToggle(e.target.checked)}
        />
        <span>{t("Select multiple")}</span>
      </label>
      {multi && (
        <div className="flex flex-none items-center">
          <button
            type="button"
            disabled={noVisible || allSelected}
            aria-label={t("Select all")}
            onClick={onSelectAll}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:cursor-default disabled:text-gray-300"
          >
            {t("All")}
          </button>
          <span className="mx-1.5 h-3 w-px bg-gray-300" aria-hidden />
          <button
            type="button"
            disabled={noVisible || noneSelected}
            aria-label={t("Select none")}
            onClick={onSelectNone}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 disabled:cursor-default disabled:text-gray-300"
          >
            {t("None")}
          </button>
        </div>
      )}
    </div>
  );
}
