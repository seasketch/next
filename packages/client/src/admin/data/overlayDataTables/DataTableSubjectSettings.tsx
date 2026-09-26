import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DATA_TABLE_COVERAGE_PROMPT,
  DATA_TABLE_COVERAGE_SCHEMA,
} from "@seasketch/geostats-types";
import { replicateLegendUnit } from "./DataTableCalculationMode";
import { isInternalWhenColumn } from "../../../dataLayers/dataTableQueryApi";

/** Date-part columns, including names like `survey_year` that are not the configured time mapping. */
export function isTimeLikeColumnName(column: string): boolean {
  return /(?:^|_)(year|month|day|date|hour|minute|second)s?(?:$|_)/i.test(
    column
  );
}

export type CoverageModeChoice = "all_surveyed" | "rows_only" | "coverage_file";

/**
 * Subject, detail, survey coverage, nothing-seen rows, and rows to ignore.
 * Copy is the admin contract in the sparse-tables plan.
 */
export default function DataTableSubjectSettings({
  columns,
  subjectColumn,
  onSubjectColumn,
  subjectLockedReason,
  hasOrganism,
  onOpenOrganisms,
  detailColumns,
  onDetailColumns,
  coverageMode,
  onCoverageMode,
  effortMarkers,
  onEffortMarkers,
  excluded,
  onExcluded,
  replicateWord,
  within,
  joinColumn,
  unavailableColumns = [],
  valueColumns = [],
}: {
  columns: string[];
  subjectColumn: string;
  onSubjectColumn: (column: string) => void;
  subjectLockedReason: string | null;
  hasOrganism: boolean;
  onOpenOrganisms: () => void;
  detailColumns: string[];
  onDetailColumns: (columns: string[]) => void;
  coverageMode: CoverageModeChoice;
  onCoverageMode: (mode: CoverageModeChoice) => void;
  effortMarkers: string[];
  onEffortMarkers: (values: string[]) => void;
  excluded: { [column: string]: string[] };
  onExcluded: (excluded: { [column: string]: string[] }) => void;
  replicateWord: string;
  /** Inside-a-replicate operation for the value columns; "mixed" when they differ. */
  within: "sum" | "mean" | "min" | "max" | "mixed";
  joinColumn: string;
  /** Replicate columns, time-settings columns, and join columns. Not details. */
  unavailableColumns?: string[];
  /** Value columns the map calculates. Not details. */
  valueColumns?: string[];
}) {
  const { t } = useTranslation("admin:data");
  const [copied, setCopied] = useState<string | null>(null);
  const emptyOutcome = useMemo(() => {
    if (within === "mixed") {
      return t(
        "Depends on the value column: counts as 0 where rows are summed inside a replicate, left out where they are averaged or the min or max is taken."
      );
    }
    if (within !== "sum") {
      return t("Left out. There is no {{op}} of nothing.", { op: within });
    }
    if (coverageMode === "rows_only") {
      return t(
        "Counts as 0. A replicate is only known to exist when it has rows, so this is the same as above; the setting records that no further zeros should be inferred."
      );
    }
    if (coverageMode === "coverage_file") {
      return t("0 inside a listed period; left out outside one.");
    }
    return t("Counts as 0.");
  }, [coverageMode, t, within]);

  const copyText = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
  };

  const detailChoices = useMemo(() => {
    const blocked = new Set(
      [...unavailableColumns, ...valueColumns].filter((column) =>
        Boolean(column)
      )
    );
    if (joinColumn) blocked.add(joinColumn);
    if (subjectColumn) blocked.add(subjectColumn);
    return columns.filter(
      (column) =>
        column &&
        !blocked.has(column) &&
        !isInternalWhenColumn(column) &&
        !isTimeLikeColumnName(column)
    );
  }, [columns, joinColumn, subjectColumn, unavailableColumns, valueColumns]);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900">
          {t("Subject column")}
        </p>
        <p className="text-xs text-gray-500">
          {t(
            "Which column names what was observed: a species code, a substrate type, a debris category. When a map user filters on it, SeaSketch counts only that subject inside each replicate. Replicates stay on the map; what happens to a replicate with no rows for that subject is decided by “When a subject is missing from a replicate” below."
          )}
        </p>
        <select
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-100"
          value={subjectColumn}
          disabled={Boolean(subjectLockedReason)}
          onChange={(event) => onSubjectColumn(event.target.value)}
        >
          <option value="">{t("None")}</option>
          {columns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </select>
        {subjectLockedReason ? (
          <p className="text-xs text-amber-800">{subjectLockedReason}</p>
        ) : null}
        {hasOrganism ? (
          <p className="text-xs text-gray-600">
            {t(
              "Species names and photos for this column are set up in Subjects and organisms."
            )}{" "}
            <button
              type="button"
              className="text-primary-700 underline"
              onClick={onOpenOrganisms}
            >
              {t("Open")}
            </button>
          </p>
        ) : null}
        <p className="text-xs text-gray-500">
          {t(
            "If the same code can appear under different kinds of measurement, such as a species listed under both cover and canopy, make that kind a required filter below so map users pick it first."
          )}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900">
          {t("Detail columns")}
        </p>
        <p className="text-xs text-gray-500">
          {t(
            "Which columns describe a single observation rather than the replicate: sex, size class, length. When a map user filters on a detail, every replicate stays on the map and only matching observations are counted. What a replicate with no matching observations becomes is decided by the two settings below."
          )}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {detailChoices.map((column) => (
            <label key={column} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                checked={detailColumns.includes(column)}
                onChange={() => {
                  onDetailColumns(
                    detailColumns.includes(column)
                      ? detailColumns.filter((item) => item !== column)
                      : [...detailColumns, column]
                  );
                }}
              />
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="truncate font-mono text-xs">{column}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          {t(
            "Nothing is chosen for you. Columns that describe the whole survey, such as observer, depth, or program, should stay unchecked: filtering on them removes replicates that do not match."
          )}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900">
          {t("When a subject is missing from a replicate")}
        </p>
        <p className="text-xs text-gray-500">
          {t(
            "Your table may not have a row for every subject in every replicate. Choose what a missing row means."
          )}
        </p>
        <CoverageChoice
          selected={coverageMode === "all_surveyed"}
          title={t("It was surveyed and none were seen.")}
          body={t(
            "Every replicate looked for every subject. A missing row counts as zero. Choose this for surveys that record every taxon on a fixed list."
          )}
          onClick={() => onCoverageMode("all_surveyed")}
        />
        <CoverageChoice
          selected={coverageMode === "rows_only"}
          title={t("Nothing can be assumed.")}
          body={t(
            "SeaSketch does not fill in zeros for replicates it has no rows for. A replicate that does have rows, for any subject, still counts as surveyed. Choose this if the table only records what was seen, or if it already includes its own zero rows."
          )}
          onClick={() => onCoverageMode("rows_only")}
        />
        <CoverageChoice
          selected={coverageMode === "coverage_file"}
          title={t("It depends on when and where.")}
          body={t(
            "Some subjects were only surveyed in certain years or by certain programs. Upload a coverage file that lists those periods. Inside a listed period a missing row counts as zero; outside it the replicate is left out of the calculation for that subject."
          )}
          onClick={() => onCoverageMode("coverage_file")}
        />
        {coverageMode === "coverage_file" ? (
          <div className="space-y-2 rounded-md border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-900">
              {t("Coverage file")}
            </p>
            <p className="text-xs text-gray-500">
              {t(
                "A JSON list of periods, one per subject and program. To make one, copy the three items below into an AI assistant along with your own sampling history, then upload what it produces."
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                label={t("Copy file format")}
                copied={copied === "schema"}
                onClick={() =>
                  copyText(
                    "schema",
                    JSON.stringify(DATA_TABLE_COVERAGE_SCHEMA, null, 2)
                  )
                }
              />
              <CopyButton
                label={t("Copy instructions")}
                copied={copied === "prompt"}
                onClick={() => copyText("prompt", DATA_TABLE_COVERAGE_PROMPT)}
              />
            </div>
          </div>
        ) : null}
      </div>

      <ValueList
        title={t('"Nothing seen" rows')}
        body={t(
          "Some tables mark an empty survey with a placeholder value, such as NO_ORG or No Trash Present. List those values here so SeaSketch knows the replicate was surveyed and treats it as zero rather than dropping it. These values are hidden from map filters."
        )}
        column={subjectColumn || columns[0] || ""}
        values={effortMarkers}
        onChange={onEffortMarkers}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900">
          {t("Rows to ignore")}
        </p>
        <p className="text-xs text-gray-500">
          {t(
            "Some tables include total rows alongside the rows they add up, such as PeopleAll next to PeopBch and PeopSurf. List those values here and SeaSketch leaves the rows out entirely so nothing is counted twice."
          )}
        </p>
        <ExcludedEditor
          columns={columns}
          excluded={excluded}
          onChange={onExcluded}
        />
        <p className="text-xs text-gray-500">
          {t(
            "These rows are not shown on the map, in filters, or in “Rows behind this value”. For placeholders that mean “surveyed, nothing seen”, use “Nothing seen” rows instead. A value cannot be in both lists."
          )}
        </p>
      </div>

      <p className="text-xs text-gray-700">
        {t("What a replicate with no matching observations becomes")}:{" "}
        <span className="font-medium">{emptyOutcome}</span>
        {replicateWord ? (
          <span className="text-gray-500"> ({replicateWord})</span>
        ) : null}
      </p>
    </div>
  );
}

function CoverageChoice({
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
      className={`block w-full rounded-md border px-3 py-2 text-left ${
        selected
          ? "border-primary-500 bg-primary-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <span className="text-sm font-medium text-gray-900">{title}</span>
      <span className="mt-1 block text-xs text-gray-600">{body}</span>
    </button>
  );
}

function CopyButton({
  label,
  copied,
  onClick,
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation("admin:data");
  return (
    <button
      type="button"
      className="rounded-md border border-gray-300 px-2 py-1 text-xs"
      onClick={onClick}
    >
      {copied ? t("Copied") : label}
    </button>
  );
}

function ValueList({
  title,
  body,
  column,
  values,
  onChange,
}: {
  title: string;
  body: string;
  column: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useTranslation("admin:data");
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-xs text-gray-500">{body}</p>
      <div className="flex flex-wrap items-center gap-2">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span className="font-mono text-xs text-gray-700">{column || "—"}</span>
        {values.map((value) => (
          <button
            key={value}
            type="button"
            className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-xs"
            onClick={() => onChange(values.filter((item) => item !== value))}
          >
            {value}
          </button>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs"
          placeholder={t("Add")}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const next = draft.trim();
            if (!next || values.includes(next)) return;
            onChange([...values, next]);
            setDraft("");
          }}
        />
      </div>
    </div>
  );
}

function ExcludedEditor({
  columns,
  excluded,
  onChange,
}: {
  columns: string[];
  excluded: { [column: string]: string[] };
  onChange: (excluded: { [column: string]: string[] }) => void;
}) {
  const { t } = useTranslation("admin:data");
  const [column, setColumn] = useState(columns[0] || "");
  const [draft, setDraft] = useState("");
  return (
    <div className="space-y-2">
      {Object.entries(excluded).map(([name, values]) => (
        <p key={name} className="font-mono text-xs text-gray-800">
          {name}: {values.join(", ")}
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          value={column}
          onChange={(event) => setColumn(event.target.value)}
        >
          {columns.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs"
          placeholder={t("Add")}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const next = draft.trim();
            if (!column || !next) return;
            const current = excluded[column] || [];
            if (current.includes(next)) return;
            onChange({ ...excluded, [column]: [...current, next] });
            setDraft("");
          }}
        />
      </div>
    </div>
  );
}

export function replicateWordFrom(
  t: (key: string) => string,
  label: string,
  custom: string
) {
  return replicateLegendUnit(t, label, custom);
}
