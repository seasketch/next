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
          {t("Calculation mode")}
        </p>
        <p className="text-xs text-gray-500">
          {t(
            "Simple averages each matching row. Multiple replicates first combines rows that belong to the same sample, then calculates across those samples."
          )}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <ModeCard
          selected={mode === "simple"}
          title={t("Simple")}
          body={t(
            "Best for datasets where there is one observation for a given subject and time step. For example, a list of taxa with a single record of #/m² for any given year."
          )}
          onClick={() => onModeChange("simple")}
        />
        <ModeCard
          selected={mode === "replicates"}
          title={t("Multiple replicates")}
          body={t(
            "Choose if you have multiple quadrats or transects performed at the same time at any given site, or if you have multiple observations of a subject that need to be combined (for example the same taxon recorded by sex or size class)."
          )}
          onClick={() => onModeChange("replicates")}
        />
      </div>
      {mode === "replicates" ? (
        <div className="space-y-5 rounded-md border border-gray-200 p-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">
              {t("Replicate identifiers")}
            </p>
            <p className="text-xs text-gray-500">
              {t(
                "A replicate is one sampling unit. Time step and the join column are always part of it. Check the other columns that distinguish one unit from another."
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <LockedChip label={t("Time step")} />
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
                    "No extra columns are selected, so the map still averages rows. Add the columns that identify a transect, quadrat, or similar unit."
                  )
                : t(
                    "A replicate is one combination of time step, {{join}}, and {{ids}}. Rows that differ only by {{collapsed}} are combined inside that unit.",
                    {
                      join: joinColumn,
                      ids: identifiers.join(", "),
                      collapsed: collapsed.length
                        ? collapsed.join(", ")
                        : t("nothing else"),
                    }
                  )}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">
              {t("Replicate label")}
            </p>
            <p className="text-xs text-gray-500">
              {t(
                "This word appears in the legend, for example “mean of count per transect”."
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
                {t("Per data column")}
              </p>
              <p className="text-xs text-gray-500">
                {t(
                  "Rows that share a replicate are combined first. The map then calculates across those replicate values. The legend uses the across-replicate operation."
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
                        {t("Within a replicate")}
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
                        {t("Across replicates")}
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
