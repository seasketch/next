import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  Summary,
  summary,
  valueText,
} from "./FieldGroupListItemBase";
import { tableLabel, tableNameFromSummary } from "./dataTableSummary";

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => valueText(entry).trim())
    .filter(Boolean);
}

function listsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((entry, index) => entry === b[index]);
}

function SettingsDetails({
  from,
  to,
  columnsLabel,
  calculationsLabel,
  requiredFiltersLabel,
  allColumnsLabel,
  allCalculationsLabel,
  noneLabel,
}: {
  from: Summary;
  to: Summary;
  columnsLabel: string;
  calculationsLabel: string;
  requiredFiltersLabel: string;
  allColumnsLabel: string;
  allCalculationsLabel: string;
  noneLabel: string;
}) {
  const rows = [
    {
      label: columnsLabel,
      before: formatColumnList(stringList(from.visualizationColumns), allColumnsLabel),
      after: formatColumnList(stringList(to.visualizationColumns), allColumnsLabel),
    },
    {
      label: calculationsLabel,
      before: formatColumnList(stringList(from.visualizationOps), allCalculationsLabel),
      after: formatColumnList(stringList(to.visualizationOps), allCalculationsLabel),
    },
    {
      label: requiredFiltersLabel,
      before: formatColumnList(stringList(from.requiredFilterColumns), noneLabel),
      after: formatColumnList(stringList(to.requiredFilterColumns), noneLabel),
    },
  ];

  return (
    <div className="w-80 max-w-full text-left text-sm">
      <div className="border-b border-gray-100 px-3 py-2">
        <h3 className="font-semibold text-gray-900">
          <Trans ns="admin:data">Map display settings</Trans>
        </h3>
      </div>
      <dl className="space-y-3 p-3">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {row.label}
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-gray-800">
              <span className="rounded bg-gray-50 px-1.5 py-0.5 font-mono text-xs text-gray-500 line-through">
                {row.before}
              </span>
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="text-gray-400" aria-hidden>
                {"->"}
              </span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                {row.after}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function formatColumnList(values: string[], emptyLabel: string) {
  return values.length ? values.join(", ") : emptyLabel;
}

export default function DataTableVisualizationSettingsUpdatedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");

  const fromColumns = stringList(from.visualizationColumns);
  const toColumns = stringList(to.visualizationColumns);
  const fromOps = stringList(from.visualizationOps);
  const toOps = stringList(to.visualizationOps);
  const fromRequired = stringList(from.requiredFilterColumns);
  const toRequired = stringList(to.requiredFilterColumns);

  const columnsChanged = !listsEqual(fromColumns, toColumns);
  const opsChanged = !listsEqual(fromOps, toOps);
  const requiredChanged = !listsEqual(fromRequired, toRequired);
  const changedCount =
    Number(columnsChanged) + Number(opsChanged) + Number(requiredChanged);

  const namedSummary = tableNameFromSummary(to)
    ? to
    : tableNameFromSummary(from)
      ? from
      : null;
  const tableLabelText = namedSummary
    ? tableLabel(namedSummary, t("Untitled table"))
    : "";

  const allColumnsLabel = t("all columns");
  const allCalculationsLabel = t("all calculations");
  const noneLabel = t("none");
  const details = (
    <SettingsDetails
      from={from}
      to={to}
      columnsLabel={t("Data columns")}
      calculationsLabel={t("Calculations")}
      requiredFiltersLabel={t("Required filters")}
      allColumnsLabel={allColumnsLabel}
      allCalculationsLabel={allCalculationsLabel}
      noneLabel={noneLabel}
    />
  );

  // When the publish UI already shows overlay · table as itemTitle, skip
  // repeating the table name in the summary line.
  const showTableInSummary = Boolean(tableLabelText) && !props.itemTitle;

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<MixerHorizontalIcon className="h-5 w-5" />}
      iconClassName="bg-blue-50 text-blue-500"
    >
      {changedCount === 1 && columnsChanged ? (
        <Trans ns="admin:data">
          updated map data columns from{" "}
          <ChangeValue deleted>
            {formatColumnList(fromColumns, allColumnsLabel)}
          </ChangeValue>{" "}
          {" -> "}
          <ChangeValue>
            {formatColumnList(toColumns, allColumnsLabel)}
          </ChangeValue>
        </Trans>
      ) : changedCount === 1 && opsChanged ? (
        <Trans ns="admin:data">
          updated map calculations from{" "}
          <ChangeValue deleted>
            {formatColumnList(fromOps, allCalculationsLabel)}
          </ChangeValue>{" "}
          {" -> "}
          <ChangeValue>
            {formatColumnList(toOps, allCalculationsLabel)}
          </ChangeValue>
        </Trans>
      ) : changedCount === 1 && requiredChanged ? (
        <Trans ns="admin:data">
          updated required filters from{" "}
          <ChangeValue deleted>
            {formatColumnList(fromRequired, noneLabel)}
          </ChangeValue>{" "}
          {" -> "}
          <ChangeValue>
            {formatColumnList(toRequired, noneLabel)}
          </ChangeValue>
        </Trans>
      ) : showTableInSummary ? (
        <Trans ns="admin:data">
          updated{" "}
          <ChangeValue details={details}>map display settings</ChangeValue> for{" "}
          <ChangeValue>{tableLabelText}</ChangeValue>
        </Trans>
      ) : (
        <Trans ns="admin:data">
          updated{" "}
          <ChangeValue details={details}>map display settings</ChangeValue>
        </Trans>
      )}
    </BaseFieldGroupListItem>
  );
}
