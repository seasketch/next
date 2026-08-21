import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  createLayerYearTemporalInfo,
  isTemporalInfo,
  TemporalInfo,
} from "@seasketch/geostats-types";
import {
  FullAdminSourceFragment,
  useUpdateDataSourceTemporalMutation,
} from "../../../generated/graphql";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";

/**
 * v1 "Temporal coverage" section for the layer admin editor (Settings tab).
 * Writes layer-granularity year intervals per the design doc's
 * Administrative Interface section: typing `2018` stores
 * `{ kind: "interval", start: "2018", end: "2019", precision: "year" }`.
 * An optional last year widens the interval (end is stored exclusive).
 * Documents authored elsewhere (ingest, finer precision, other
 * granularities) are shown read-only rather than clobbered.
 *
 * Deferred: this Year + optional Last year UI (no instant-vs-interval
 * switch) will be redesigned after the remaining temporal workstreams.
 * Do not expand this editor until that pass.
 */
export default function TemporalCoverageEditor({
  source,
  changeLogRefetchQueries,
}: {
  source: FullAdminSourceFragment;
  changeLogRefetchQueries?: any[];
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const [mutate, mutationState] = useUpdateDataSourceTemporalMutation({
    onError,
    refetchQueries: changeLogRefetchQueries,
  });

  const existing: TemporalInfo | null = useMemo(
    () => (isTemporalInfo(source.temporal) ? source.temporal : null),
    [source.temporal]
  );

  // This simple editor only round-trips the year-interval documents it
  // writes itself. Anything richer is displayed but not editable here yet.
  const editable =
    !existing ||
    (existing.granularity === "layer" &&
      existing.coverage.precision === "year" &&
      existing.coverage.end !== null);

  const initialFirst =
    existing && editable ? String(parseInt(existing.coverage.start, 10)) : "";
  const initialLast =
    existing && editable && existing.coverage.end
      ? String(parseInt(existing.coverage.end, 10) - 1)
      : "";

  const [firstYear, setFirstYear] = useState(initialFirst);
  const [lastYear, setLastYear] = useState(
    initialLast === initialFirst ? "" : initialLast
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  // Re-sync local inputs when switching between layers.
  useEffect(() => {
    setFirstYear(initialFirst);
    setLastYear(initialLast === initialFirst ? "" : initialLast);
    setValidationError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.id]);

  const save = () => {
    const first = firstYear.trim();
    const last = lastYear.trim();
    if (!first && !last) {
      setValidationError(null);
      if (existing) {
        mutate({ variables: { dataSourceId: source.id, temporal: null } });
      }
      return;
    }
    if (!/^\d{4}$/.test(first)) {
      setValidationError(t("Enter a 4-digit year, e.g. 2018"));
      return;
    }
    const start = parseInt(first, 10);
    let end = start;
    if (last) {
      if (!/^\d{4}$/.test(last)) {
        setValidationError(t("Enter a 4-digit year, e.g. 2020"));
        return;
      }
      end = parseInt(last, 10);
      if (end < start) {
        setValidationError(t("Last year must not be before the first year"));
        return;
      }
    }
    setValidationError(null);
    const doc = createLayerYearTemporalInfo(start);
    // Stored end is exclusive; the input is the inclusive last year.
    doc.coverage.end = String(end + 1);
    mutate({ variables: { dataSourceId: source.id, temporal: doc } });
  };

  const inputClassName =
    "w-24 rounded-md border-gray-300 shadow-sm focus:border-primary-300 focus:ring focus:ring-primary-200 focus:ring-opacity-50 text-sm";

  return (
    <div className="mt-5">
      <h3 className="py-1 text-sm font-medium text-gray-700">
        <Trans ns="admin:data">Temporal coverage</Trans>
      </h3>
      <p className="text-sm text-gray-500">
        <Trans ns="admin:data">
          Assign the year (or span of years) this layer represents, such as
          annual mangrove cover. Temporal layers can appear on a map timeslider
          and be plotted in report time series.
        </Trans>
      </p>
      {!editable && existing ? (
        <p className="mt-2 text-sm text-gray-600 bg-gray-50 border rounded p-2">
          {t(
            "This layer has {{granularity}}-level temporal metadata ({{start}} – {{end}}) that can't be edited with this form.",
            {
              granularity: existing.granularity,
              start: existing.coverage.start,
              end: existing.coverage.end ?? t("present"),
            }
          )}
        </p>
      ) : (
        <div className="mt-2 flex items-end gap-3">
          <label className="block text-sm text-gray-700">
            <span className="block pb-1">
              <Trans ns="admin:data">Year</Trans>
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder={
                // eslint-disable-next-line i18next/no-literal-string
                "2018"
              }
              className={inputClassName}
              value={firstYear}
              onChange={(e) => setFirstYear(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </label>
          <label className="block text-sm text-gray-700">
            <span className="block pb-1">
              <Trans ns="admin:data">Last year (optional)</Trans>
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder={
                // eslint-disable-next-line i18next/no-literal-string
                "2020"
              }
              className={inputClassName}
              value={lastYear}
              onChange={(e) => setLastYear(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </label>
          <span className="pb-2 text-xs text-gray-400">
            {mutationState.loading
              ? t("Saving…")
              : existing
              ? t("Saved")
              : ""}
          </span>
        </div>
      )}
      {validationError && (
        <p className="mt-1 text-sm text-red-600">{validationError}</p>
      )}
    </div>
  );
}
