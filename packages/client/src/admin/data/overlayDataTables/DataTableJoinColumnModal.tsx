import { useEffect, useMemo, useState } from "react";
import { Trans, useTranslation, TFunction } from "react-i18next";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import * as Tooltip from "@radix-ui/react-tooltip";
import { GeostatsLayer } from "@seasketch/geostats-types";
import Modal from "../../../components/Modal";
import Warning from "../../../components/Warning";
import {
  OverlayJoinColumnOption,
  partitionOverlayJoinColumnOptions,
} from "./overlayJoinColumnOptions";

export default function DataTableJoinColumnModal({
  open,
  onClose,
  geostatsLayer,
  aiBestIdColumnHint,
  initialJoinColumn,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  geostatsLayer: GeostatsLayer | undefined;
  aiBestIdColumnHint?: string | null;
  initialJoinColumn?: string | null;
  onSave: (joinColumn: string) => void;
  saving?: boolean;
}) {
  const { t } = useTranslation("admin:data");
  const { suggested, other, featureCount } = useMemo(
    () => partitionOverlayJoinColumnOptions(geostatsLayer, aiBestIdColumnHint),
    [geostatsLayer, aiBestIdColumnHint]
  );
  const validOptions = useMemo(
    () =>
      [...suggested, ...other].filter((option) => option.status === "valid"),
    [suggested, other]
  );
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (!open) {
      return;
    }
    const preferred =
      initialJoinColumn &&
      validOptions.some((option) => option.attribute === initialJoinColumn)
        ? initialJoinColumn
        : validOptions[0]?.attribute || "";
    setSelected(preferred);
  }, [open, initialJoinColumn, validOptions]);

  const hasAnyOptions = suggested.length + other.length > 0;

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      title={t("Choose a join column")}
      scrollable
      autoWidth
      panelClassName="sm:max-w-lg"
      bodyClassName="px-6 py-4 flex flex-col gap-4 min-h-0 max-h-[70vh]"
      footer={[
        {
          label: t("Cancel"),
          onClick: onClose,
          disabled: saving,
        },
        {
          label: t("Save"),
          variant: "primary",
          onClick: () => selected && onSave(selected),
          disabled: saving || !selected,
          loading: saving,
        },
      ]}
    >
      <Tooltip.Provider delayDuration={200}>
        <p className="text-sm text-gray-600">
          <Trans ns="admin:data">
            Data tables you upload will need to be joined to spatial features in
            this layer using a common ID column (e.g. site_id). When you upload
            new tables, distinct values in all columns will be compared to this
            column in order to determine how to join the two datasets.
          </Trans>
        </p>

        {!hasAnyOptions ? (
          <Warning>
            <Trans ns="admin:data">
              No attribute statistics are available for this layer. Upload or
              reprocess the source data so geostats can be computed before
              enabling data tables.
            </Trans>
          </Warning>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {suggested.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  {t("Best columns")}
                </h3>
                <div className="space-y-2">
                  {suggested.map((option) => (
                    <JoinColumnOptionRow
                      key={option.attribute}
                      option={option}
                      selected={selected === option.attribute}
                      onSelect={() => setSelected(option.attribute)}
                    />
                  ))}
                </div>
                {hasAnyOptions && validOptions.length === 0 ? (
                  <Warning>
                    <Trans ns="admin:data">
                      None of the suggested columns uniquely identify every
                      feature. Fix the source data in desktop GIS and re-upload
                      in order to enable data tables.
                    </Trans>
                  </Warning>
                ) : null}
              </section>
            ) : null}

            {other.length > 0 ? (
              <section className="flex min-h-0 flex-1 flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  {t("Unsuitable columns")}
                </h3>
                <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 pr-1">
                  {other.map((option) => (
                    <UnsuitableColumnRow
                      key={option.attribute}
                      option={option}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </Tooltip.Provider>
    </Modal>
  );
}

function getJoinColumnReasonText(
  option: OverlayJoinColumnOption,
  t: TFunction<"admin:data">
): string | null {
  switch (option.reason) {
    case "unsupported_type":
      return t("Only text or numeric columns can be used as join keys.");
    case "too_few_values":
      return t("This column has too few distinct values to identify features.");
    case "duplicate_values":
      return t(
        "{{distinct}} distinct values for {{features}} features. {{shared}} value(s) appear on multiple features, so rows cannot be linked unambiguously.",
        {
          distinct: option.distinctCount.toLocaleString(),
          features: option.featureCount.toLocaleString(),
          shared: option.duplicateValueNames ?? 0,
        }
      );
    case "not_unique":
      return t(
        "This column does not have exactly one value per feature in the layer."
      );
    default:
      return option.status === "valid"
        ? t("Unique value for every feature.")
        : null;
  }
}

function UnsuitableColumnRow({ option }: { option: OverlayJoinColumnOption }) {
  const { t } = useTranslation("admin:data");
  const sampleText = option.sampleValues.join(", ");
  const reasonText = getJoinColumnReasonText(option, t);

  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-2 text-sm text-gray-500">
      <span className="shrink-0 font-medium text-gray-700">
        {option.attribute}
      </span>
      {sampleText ? (
        <span className="min-w-0 flex-1 line-clamp-2 text-xs leading-snug">
          {sampleText}
        </span>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      <span className="shrink-0 text-xs tabular-nums text-right">
        {t("{{distinct}} distinct values", {
          distinct: option.distinctCount.toLocaleString(),
        })}
      </span>
      {reasonText ? (
        <Tooltip.Root delayDuration={100}>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              className="inline-flex shrink-0 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-400"
              aria-label={t("Why this column is unsuitable")}
            >
              <QuestionMarkCircledIcon className="h-4 w-4" aria-hidden />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="left"
              sideOffset={6}
              className="z-[60] max-w-xs rounded-md bg-gray-900 px-3 py-2 text-xs leading-snug text-white shadow-lg"
            >
              {reasonText}
              <Tooltip.Arrow className="fill-gray-900" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      ) : null}
    </div>
  );
}

function JoinColumnOptionRow({
  option,
  selected,
  onSelect,
}: {
  option: OverlayJoinColumnOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation("admin:data");
  const disabled = option.status !== "valid";
  const sampleText = option.sampleValues.join(", ");
  const reasonText = getJoinColumnReasonText(option, t);

  const rowClassName = disabled
    ? "border-gray-200 bg-gray-50 cursor-not-allowed select-none"
    : selected
    ? "border-primary-500 bg-primary-50 cursor-pointer"
    : "border-gray-200 bg-white hover:border-gray-300 cursor-pointer";

  const body = (
    <div className="flex items-start gap-3">
      <input
        type="radio"
        name="overlay-join-column"
        className={`mt-1 shrink-0 ${
          disabled
            ? "pointer-events-none cursor-not-allowed opacity-40 accent-gray-400"
            : "cursor-pointer"
        }`}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        tabIndex={disabled ? -1 : undefined}
        aria-disabled={disabled}
      />
      <div
        className={`min-w-0 flex-1 space-y-1 ${disabled ? "opacity-70" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-sm font-medium ${
              disabled ? "text-gray-500" : "text-gray-900"
            }`}
          >
            {option.attribute}
          </span>
          <span className="text-xs text-gray-500">
            {t("{{distinct}} / {{features}} distinct", {
              distinct: option.distinctCount.toLocaleString(),
              features: option.featureCount.toLocaleString(),
            })}
          </span>
        </div>
        {sampleText ? (
          <p className="text-xs text-gray-500 line-clamp-2 leading-snug">
            {t("Examples: {{values}}", { values: sampleText })}
          </p>
        ) : null}
        {option.status === "valid" ? (
          <p className="text-xs text-green-700">{reasonText}</p>
        ) : reasonText ? (
          <p
            className={`text-xs ${
              option.status === "close" ? "text-amber-700" : "text-gray-500"
            }`}
          >
            {reasonText}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (disabled) {
    return (
      <div className={`block rounded-lg border px-4 py-3 ${rowClassName}`}>
        {body}
      </div>
    );
  }

  return (
    <label className={`block rounded-lg border px-4 py-3 ${rowClassName}`}>
      {body}
    </label>
  );
}
