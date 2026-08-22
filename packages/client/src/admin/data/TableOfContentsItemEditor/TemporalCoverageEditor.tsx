import { Dialog } from "@headlessui/react";
import { XIcon } from "@heroicons/react/outline";
import { isTemporalInfo } from "@seasketch/geostats-types";
import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import {
  FullAdminDataLayerFragment,
  FullAdminSourceFragment,
  useUpdateDataSourceTemporalMutation,
} from "../../../generated/graphql";
import LayerEditorTabs from "./LayerEditorTabs";
import {
  allowedTemporalModes,
  coerceSpanValue,
  formStateFromTemporal,
  sourceTemporalCapabilities,
  spanPickerType,
  summarizeTemporalInfo,
  TemporalCoverageFormState,
  TemporalCoverageMode,
  temporalFromFormState,
} from "./temporalCoverageForm";

const temporalFieldClassName =
  "rounded-md border border-white/10 bg-gray-900/40 px-2.5 py-1.5 font-mono text-sm text-green-300 shadow-sm [color-scheme:dark] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-80";

export default function TemporalCoverageEditor({
  source,
  layer,
  changeLogRefetchQueries,
}: {
  source: FullAdminSourceFragment;
  layer?: Pick<FullAdminDataLayerFragment, "sublayerType"> | null;
  changeLogRefetchQueries?: any[];
}) {
  const { t } = useTranslation("admin:data");
  const onError = useGlobalErrorHandler();
  const [open, setOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mutate, mutationState] = useUpdateDataSourceTemporalMutation({
    onError,
    refetchQueries: changeLogRefetchQueries,
  });

  const existing = isTemporalInfo(source.temporal) ? source.temporal : null;
  const caps = useMemo(
    () => sourceTemporalCapabilities(source, layer?.sublayerType),
    [source, layer?.sublayerType]
  );
  const modes = useMemo(() => allowedTemporalModes(caps), [caps]);
  const presentText = t("present");
  const summary = summarizeTemporalInfo(existing, presentText);

  const [form, setForm] = useState<TemporalCoverageFormState>(() =>
    formStateFromTemporal(existing, caps)
  );

  useEffect(() => {
    if (open) {
      setForm(formStateFromTemporal(existing, caps));
      setValidationError(null);
    }
  }, [open, existing, caps]);

  const canSave = form.mode !== "column" && form.mode !== "bands";

  const modeTabs = modes.map((id) => ({
    id,
    name: modeLabel(id, t),
    current: form.mode === id,
  }));

  const save = async () => {
    const result = temporalFromFormState(form);
    if (!result.ok) {
      setValidationError(validationMessage(result.error, t));
      return;
    }
    setValidationError(null);
    await mutate({
      variables: { dataSourceId: source.id, temporal: result.temporal },
    });
    setOpen(false);
  };

  return (
    <div className="mt-5">
      <div className="text-sm font-medium text-gray-800">
        <Trans ns="admin:data">Temporal coverage</Trans>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm hover:border-gray-400 hover:bg-gray-50 focus:border-blue-300 focus:outline-none focus:ring focus:ring-blue-200 focus:ring-opacity-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={existing ? "truncate text-gray-800" : "text-gray-400"}
          >
            {existing ? summary.label : t("None")}
          </span>
          {summary.chip === "bands" && (
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              <Trans ns="admin:data">bands</Trans>
            </span>
          )}
          {summary.chip === "features" && (
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              <Trans ns="admin:data">features</Trans>
            </span>
          )}
        </span>
        <span className="ml-3 shrink-0 text-primary-500">
          {existing ? t("Edit") : t("Set time")}
        </span>
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel
            className="w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-gray-700 text-gray-100 shadow-2xl [color-scheme:dark]"
            style={{ colorScheme: "dark" }}
          >
            <div className="border-b border-gray-600">
              <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                <Dialog.Title className="min-w-0 flex-1 truncate font-medium text-indigo-100">
                  <Trans ns="admin:data">Temporal coverage</Trans>
                </Dialog.Title>
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-black/20 text-gray-200 hover:bg-gray-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                  onClick={() => setOpen(false)}
                  aria-label={t("Close")}
                >
                  <XIcon className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <LayerEditorTabs
                tabs={modeTabs}
                onSelect={(id) => {
                  const next = modes.find((mode) => mode === id);
                  if (!next) return;
                  setForm((prev) => {
                    const nextForm = { ...prev, mode: next };
                    if (next === "span" && !nextForm.from) {
                      if (prev.year) {
                        nextForm.from = prev.year;
                        if (!nextForm.through) nextForm.through = prev.year;
                      } else if (prev.month) {
                        nextForm.from = prev.month;
                        if (!nextForm.through) nextForm.through = prev.month;
                        nextForm.spanPrecision = "month";
                      }
                    }
                    return nextForm;
                  });
                  setValidationError(null);
                }}
              />
            </div>

            <div className="px-5 py-5 min-h-[7rem]">
              {form.mode === "none" && (
                <p className="text-sm text-gray-400">
                  <Trans ns="admin:data">
                    This layer has no time. It will not appear on the
                    timeslider.
                  </Trans>
                </p>
              )}
              {form.mode === "column" && (
                <p className="text-sm text-gray-300 leading-relaxed">
                  <Trans ns="admin:data">
                    Mapping time from a feature column is coming in a later
                    update. You can still assign a year, month, or span to the
                    whole layer.
                  </Trans>
                </p>
              )}
              {form.mode === "bands" && (
                <p className="text-sm text-gray-300 leading-relaxed">
                  <Trans ns="admin:data">
                    Assigning a time to each raster band is coming in a later
                    update. You can still assign a year, month, or span to the
                    whole layer.
                  </Trans>
                </p>
              )}
              {form.mode === "year" && (
                <label className="block">
                  <span className="block text-sm text-gray-300 pb-1">
                    <Trans ns="admin:data">Year</Trans>
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    // eslint-disable-next-line i18next/no-literal-string
                    placeholder="1996"
                    className={`w-28 ${temporalFieldClassName}`}
                    value={form.year}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, year: e.target.value }))
                    }
                  />
                </label>
              )}
              {form.mode === "month" && (
                <label className="block">
                  <span className="block text-sm text-gray-300 pb-1">
                    <Trans ns="admin:data">Month</Trans>
                  </span>
                  <input
                    type="month"
                    className={temporalFieldClassName}
                    value={form.month}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, month: e.target.value }))
                    }
                  />
                </label>
              )}
              {form.mode === "span" && (
                <div>
                  <div className="flex items-end gap-3">
                    <label>
                      <span className="block text-sm text-gray-300 pb-1">
                        <Trans ns="admin:data">From</Trans>
                      </span>
                      <input
                        type={spanPickerType(form.spanPrecision)}
                        inputMode={
                          form.spanPrecision === "year" ? "numeric" : undefined
                        }
                        className={`${
                          form.spanPrecision === "year" ? "w-28" : "w-40"
                        } ${temporalFieldClassName}`}
                        value={form.from}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, from: e.target.value }))
                        }
                      />
                    </label>
                    {!form.ongoing && (
                      <>
                        <span className="pb-2 text-sm text-gray-400">
                          <Trans ns="admin:data">to</Trans>
                        </span>
                        <label>
                          <span className="block text-sm text-gray-300 pb-1">
                            <Trans ns="admin:data">Through</Trans>
                          </span>
                          <input
                            type={spanPickerType(form.spanPrecision)}
                            inputMode={
                              form.spanPrecision === "year"
                                ? "numeric"
                                : undefined
                            }
                            min={
                              form.spanPrecision === "year"
                                ? undefined
                                : form.from || undefined
                            }
                            className={`${
                              form.spanPrecision === "year" ? "w-28" : "w-40"
                            } ${temporalFieldClassName}`}
                            value={form.through}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                through: e.target.value,
                              }))
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-sm text-gray-300">
                    <span>
                      <Trans ns="admin:data">Values are</Trans>
                    </span>
                    <div className="inline-flex gap-0.5 rounded-md bg-gray-800/90 p-0.5">
                      {(["year", "month", "day"] as const).map((unit) => (
                        <button
                          key={unit}
                          type="button"
                          className={`rounded px-2 py-1 text-xs ${
                            form.spanPrecision === unit
                              ? "bg-gray-600 font-semibold text-white shadow-sm ring-1 ring-white/10"
                              : "text-gray-300 hover:bg-gray-700/80 hover:text-white"
                          }`}
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              spanPrecision: unit,
                              from: coerceSpanValue(prev.from, unit),
                              through: coerceSpanValue(prev.through, unit),
                            }))
                          }
                        >
                          {unitLabel(unit, t)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mt-3 block text-sm text-blue-300 hover:text-blue-200"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        ongoing: !prev.ongoing,
                      }))
                    }
                  >
                    {form.ongoing ? (
                      <Trans ns="admin:data">Set an end date</Trans>
                    ) : (
                      <Trans ns="admin:data">
                        This is ongoing — no end date
                      </Trans>
                    )}
                  </button>
                </div>
              )}
              {validationError && (
                <p className="mt-3 text-sm text-red-300">{validationError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 bg-gray-900/30 px-5 py-3">
              <button
                type="button"
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-100 hover:bg-gray-600"
                onClick={() => setOpen(false)}
              >
                <Trans ns="admin:data">Cancel</Trans>
              </button>
              <button
                type="button"
                disabled={!canSave || mutationState.loading}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={save}
              >
                {mutationState.loading ? (
                  <Trans ns="admin:data">Saving…</Trans>
                ) : (
                  <Trans ns="admin:data">Save</Trans>
                )}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}

function modeLabel(
  mode: TemporalCoverageMode,
  t: (key: string) => string
): string {
  switch (mode) {
    case "none":
      return t("None");
    case "column":
      return t("A Column");
    case "bands":
      return t("Each Band");
    case "year":
      return t("Single Year");
    case "month":
      return t("Single Month");
    case "span":
      return t("Detailed TimeSpan");
  }
}

function unitLabel(
  unit: "year" | "month" | "day",
  t: (key: string) => string
): string {
  if (unit === "year") return t("Years");
  if (unit === "month") return t("Months");
  return t("Days");
}

function validationMessage(error: string, t: (key: string) => string): string {
  if (error === "year") return t("Enter a 4-digit year, e.g. 2018");
  if (error === "month") return t("Enter a month as YYYY-MM");
  if (error === "from") return t("Enter a valid start");
  if (error === "through") return t("Enter a valid end");
  if (error === "order") return t("Through must not be before From");
  return t("This option is not available yet.");
}

