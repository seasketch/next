import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LabeledDropdown } from "./LabeledDropdown";
import { TooltipInfoIcon } from "../../editor/TooltipMenu";

export type VrmValue = false | "auto" | number | undefined;

type VrmSelectorProps = {
  /**
   * The current vrm value from the MetricDependencyParameters. Use `undefined`
   * to represent the default ("auto" for fragment stats, disabled for
   * geography stats).
   */
  value?: VrmValue;
  /**
   * Called with the new vrm value. When the user selects the context-default
   * option (auto for fragments, disabled for geography) the callback is
   * invoked with `undefined` so the parameter can be omitted from the
   * dependency.
   */
  onChange: (value: VrmValue) => void;
  /**
   * If true, the selector is configured for a geography-scoped metric
   * dependency rather than a fragment-scoped one. The default vrm for
   * geography stats is "disabled" (false) rather than "auto".
   *
   * @default false
   */
  geography?: boolean;
  /**
   * Optional override for the label shown next to the dropdown. When not
   * provided, defaults to "VRM" or "Geography VRM" based on the `geography`
   * prop.
   */
  label?: string;
};

const NUMERIC_OPTIONS = [2, 4, 12, 32, 64, 100];

const AUTO_VALUE = "__vrm:auto__";
const DISABLED_VALUE = "__vrm:disabled__";

function toDropdownValue(value: VrmValue, geography: boolean): string {
  if (value === undefined) {
    return geography ? DISABLED_VALUE : AUTO_VALUE;
  }
  if (value === "auto") return AUTO_VALUE;
  if (value === false) return DISABLED_VALUE;
  return String(value);
}

/**
 * Reusable dropdown for configuring the `vrm` (virtual resampling factor)
 * parameter on raster-based metric dependencies. See
 * overlay-engine's MetricDependencyParameters#vrm for details.
 *
 * Options:
 *  - "auto" (default for fragments)
 *  - "Disabled" (default for geographies)
 *  - Numeric factors: 2, 4, 12, 32, 64, 100
 *
 * When the user selects the context-default option, the callback receives
 * `undefined` so the parameter can be removed from the dependency entirely.
 */
export function VrmSelector({
  value,
  onChange,
  geography = false,
  label,
}: VrmSelectorProps) {
  const { t } = useTranslation("admin:reports");

  const autoLabel = useMemo(
    () => (
      <div className="flex items-center justify-between w-full -ml-2 pl-2">
        <span className="flex-1">{t("auto")}</span>
      </div>
    ),
    [t]
  );

  const disabledLabel = useMemo(
    () => (
      <div className="flex items-center justify-between w-full -ml-2 pl-2">
        <span className="flex-1">{t("disabled")}</span>
      </div>
    ),
    [t]
  );

  const options = useMemo(
    () => [
      { value: AUTO_VALUE, label: autoLabel },
      { value: DISABLED_VALUE, label: disabledLabel },
      ...NUMERIC_OPTIONS.map((n) => ({
        value: String(n),
        // eslint-disable-next-line i18next/no-literal-string
        label: `${n}`,
      })),
    ],
    [autoLabel, disabledLabel]
  );

  const dropdownValue = toDropdownValue(value, geography);

  const resolvedLabel: string =
    label ?? (geography ? t("Geography VRM") : t("VRM"));

  const defaultDisplayLabel = geography ? t("disabled") : t("auto");

  return (
    <LabeledDropdown
      label={resolvedLabel}
      value={dropdownValue}
      title={
        <div className="flex items-center space-x-2">
          <span>{t("Virtual resampling")} </span>
          <TooltipInfoIcon
            side="right"
            content={
              <div className="space-y-1.5">
                <div>
                  <p>
                    {t(
                      "Most GIS software calculates raster statistics by counting any pixels a shape touches, even if it only overlaps a small fraction of it. This can result in skewed statistics for small polygons that only overlap a corner of a much larger pixel. SeaSketch can 'virtually resample' pixels, dividing them up to 100 times to produce more accurate statistics. The 'auto' method targets ~100 m virtual grid cells. You may also explicitly set the number of times to divide pixels, or disable this feature entirely to match typical desktop GIS outputs."
                    )}
                  </p>
                  {geography && (
                    <p>
                      {t(
                        "The default for geography statistics is to disable virtual resampling. Using virtual resampling over large areas can result in out of memory errors. Comparing VRM results from sketchies with geography-level stats that have different VRM settings may introduce inconsistencies, though the differences should be minimal for most cases."
                      )}
                    </p>
                  )}
                </div>
              </div>
            }
            className="-mr-1"
          />
        </div>
      }
      options={options}
      ariaLabel={t("Virtual resampling")}
      getDisplayLabel={(selected) => {
        if (!selected) return defaultDisplayLabel;
        if (selected.value === AUTO_VALUE) return t("auto");
        if (selected.value === DISABLED_VALUE) return t("disabled");
        return selected.label;
      }}
      onChange={(next) => {
        if (next === AUTO_VALUE) {
          onChange(geography ? "auto" : undefined);
        } else if (next === DISABLED_VALUE) {
          onChange(geography ? undefined : false);
        } else {
          const parsed = Number(next);
          onChange(Number.isNaN(parsed) ? undefined : parsed);
        }
      }}
    />
  );
}
