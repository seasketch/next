import { useTranslation } from "react-i18next";
import {
  ACROSS_REPLICATE_OPS,
  DataTableAggregation,
  REPLICATE_LABEL_PRESETS,
  ReplicateLabelPreset,
  WITHIN_REPLICATE_OPS,
  WithinReplicateOp,
} from "../../../dataLayers/dataTableQueryApi";

export type CalculationModeChoice = "simple" | "replicates";

function presetLabel(
  t: (key: string) => string,
  preset: string
): string {
  switch (preset) {
    case "transect":
      return t("transect");
    case "quadrat":
      return t("quadrat");
    case "station":
      return t("station");
    case "camera":
      return t("camera");
    case "sample":
      return t("sample");
    default:
      return t("replicate");
  }
}

export function replicateLegendUnit(
  t: (key: string) => string,
  label: string,
  custom: string
): string {
  if (label === "custom" && custom.trim()) return custom.trim();
  return presetLabel(t, label);
}

export default function DataTableCalculationMode({
  mode,
  onModeChange,
  joinColumn,
  identifierChoices,
  identifiers,
  onIdentifiersChange,
  label,
  customLabel,
  onLabelChange,
  onCustomLabelChange,
  dataColumns,
  withinByColumn,
  acrossByColumn,
  onWithinChange,
  onAcrossChange,
}: {
  mode: CalculationModeChoice;
  onModeChange: (mode: CalculationModeChoice) => void;
  joinColumn: string;
  identifierChoices: string[];
  identifiers: string[];
  onIdentifiersChange: (columns: string[]) => void;
  label: string;
  customLabel: string;
  onLabelChange: (label: string) => void;
  onCustomLabelChange: (label: string) => void;
  dataColumns: string[];
  withinByColumn: { [column: string]: WithinReplicateOp };
  acrossByColumn: { [column: string]: DataTableAggregation[] };
  onWithinChange: (column: string, op: WithinReplicateOp) => void;
  onAcrossChange: (column: string, ops: DataTableAggregation[]) => void;
}) {
  const { t } = useTranslation("admin:data");
  const unit = replicateLegendUnit(t, label, customLabel);
  const collapsed = identifierChoices.filter(
    (column) => !identifiers.includes(column)
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-900">
          {t("How to turn rows into a map value")}
        </p>
        <p className="text-xs text-gray-500">
          {t("Pick the one that matches how your table is laid out.")}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <ModeCard
          selected={mode === "simple"}
          title={t("Each row is already a summary.")}
          body={t(
            "Every row that matches the filters counts as one sample. The map calculation runs straight across those rows: a mean is the mean of the rows for that site in the time shown. Choose this when each row is already a per-site value, such as a density per site per survey. If your rows are individual observations inside a transect or quadrat, choose the other option, or they will be averaged as if each were its own survey."
          )}
          onClick={() => onModeChange("simple")}
        />
        <ModeCard
          selected={mode === "replicates"}
          title={t("Rows are observations inside replicates.")}
          body={t(
            "Rows record individual observations, such as one fish of a given size, inside a transect, quadrat, camera drop, or similar unit. SeaSketch first combines the rows in each replicate, then calculates across replicates."
          )}
          onClick={() => onModeChange("replicates")}
        />
      </div>
      {mode === "replicates" ? (
        <div className="space-y-5 rounded-md border border-gray-200 p-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">
              {t("What makes a replicate")}
            </p>
            <p className="text-xs text-gray-500">
              {t(
                "A replicate is one survey of one site: for example one transect swim, one quadrat, one camera drop. Rows that share the survey date, the site, and the columns you check here belong to the same replicate."
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <LockedChip label={t("Survey date")} />
              <LockedChip label={joinColumn} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {identifierChoices.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-800"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={identifiers.includes(column)}
                    onChange={() => {
                      onIdentifiersChange(
                        identifiers.includes(column)
                          ? identifiers.filter((item) => item !== column)
                          : [...identifiers, column]
                      );
                    }}
                  />
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  <span className="truncate font-mono text-xs">{column}</span>
                </label>
              ))}
            </div>
            {identifiers.includes("level") ? (
              <p className="text-xs text-amber-800">
                {t(
                  "Level is part of the replicate, so each diver pass (bottom, midwater, canopy) is its own unit and those passes are averaged."
                )}
              </p>
            ) : null}
            {identifiers.includes("classcode") ? (
              <p className="text-xs text-amber-800">
                {t(
                  "Class code is part of the replicate, so each species is averaged as its own unit. For a one-species map, require class code as a filter instead."
                )}
              </p>
            ) : null}
            <p className="text-xs text-gray-600">
              {identifiers.length === 0
                ? t(
                    "A replicate is one survey date at one {{join}}.",
                    { join: joinColumn }
                  )
                : t(
                    "A replicate is one survey date, one {{join}}, and one combination of {{ids}}. Rows that differ only in {{collapsed}} are part of the same replicate.",
                    {
                      join: joinColumn,
                      ids: identifiers.join(", "),
                      collapsed: collapsed.length
                        ? collapsed.join(", ")
                        : t("nothing else"),
                    }
                  )}
            </p>
            <p className="text-xs text-gray-500">
              {t(
                "If a site is surveyed more than once in the period shown on the timeslider, each survey is its own replicate."
              )}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">
              {t("Call a replicate a…")}
            </p>
            <p className="text-xs text-gray-500">
              {t(
                "This word appears in the map legend, as in “mean of count per transect”."
              )}
            </p>
            <select
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              value={label}
              onChange={(event) => onLabelChange(event.target.value)}
            >
              {REPLICATE_LABEL_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {presetLabel(t, preset)}
                </option>
              ))}
              <option value="custom">{t("Custom")}</option>
            </select>
            {label === "custom" ? (
              <input
                type="text"
                maxLength={40}
                value={customLabel}
                placeholder={t("replicate")}
                onChange={(event) => onCustomLabelChange(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            ) : null}
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">
                {t("How each value column is calculated")}
              </p>
              <p className="text-xs text-gray-500">
                {t(
                  "First inside a replicate, then across replicates."
                )}
              </p>
            </div>
            {dataColumns.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                {t("No numeric columns found.")}
              </p>
            ) : (
              dataColumns.map((column) => {
                const within = withinByColumn[column] || "sum";
                const across = acrossByColumn[column] || ["mean"];
                return (
                  <div
                    key={column}
                    className="space-y-2 rounded-md border border-gray-100 bg-gray-50 p-3"
                  >
                    {/* eslint-disable-next-line i18next/no-literal-string */}
                    <p className="font-mono text-xs text-gray-900">{column}</p>
                    <fieldset className="space-y-1">
                      <legend className="text-xs font-medium text-gray-700">
                        {t("Inside each replicate")}
                      </legend>
                      <div className="flex flex-wrap gap-2">
                        {WITHIN_REPLICATE_OPS.map((op) => (
                          <label
                            key={op}
                            className="flex items-center gap-1 text-xs text-gray-800"
                          >
                            <input
                              type="radio"
                              name={`within-${column}`}
                              checked={within === op}
                              onChange={() => onWithinChange(column, op)}
                            />
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            {op}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="space-y-1">
                      <legend className="text-xs font-medium text-gray-700">
                        {t("Across replicates, map users may choose")}
                      </legend>
                      <p className="text-[11px] text-gray-500">
                        {t(
                          "These are the calculations a map user can switch among. A single choice is shown as fixed legend text."
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ACROSS_REPLICATE_OPS.map((op) => (
                          <label
                            key={op}
                            className="flex items-center gap-1 text-xs text-gray-800"
                          >
                            <input
                              type="checkbox"
                              checked={across.includes(op)}
                              onChange={() => {
                                const next = across.includes(op)
                                  ? across.filter((item) => item !== op)
                                  : [...across, op];
                                if (next.length === 0) return;
                                onAcrossChange(column, next);
                              }}
                            />
                            {/* eslint-disable-next-line i18next/no-literal-string */}
                            {op}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <p className="text-xs text-gray-600">
                      {t("Showing {{op}} of {{column}} per {{unit}}", {
                        op: across[0],
                        column,
                        unit,
                      })}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModeCard({
  selected,
  title,
  body,
  onClick,
}: {
  selected: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-2 text-left ${
        selected
          ? "border-primary-500 bg-primary-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <span className="block text-sm font-medium text-gray-900">{title}</span>
      <span className="mt-1 block text-xs leading-snug text-gray-600">
        {body}
      </span>
    </button>
  );
}

function LockedChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
      {label}
    </span>
  );
}

export function isReplicateLabelPreset(
  value: string
): value is ReplicateLabelPreset {
  return (REPLICATE_LABEL_PRESETS as readonly string[]).includes(value);
}
