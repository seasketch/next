import { ClockIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import { useRollbackOverlayDataTableVersionMutation } from "../../../generated/graphql";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";
import { dataTableMutationRefetchQueries } from "../dataTableChangeLogRefetch";
import DataTableReplacementVersionMenu from "./DataTableReplacementVersionMenu";
import {
  parquetUrlFromSummary,
  tableNameFromSummary,
  tableVersionFromSummary,
} from "./dataTableSummary";
import {
  isTemporalReprocess,
  temporalSettingsChange,
  temporalSettingsSnapshot,
} from "./dataTableTemporalChange";

function SettingsDetails({
  coverageLabel,
  mappingLabel,
  viewLabel,
  supportedLabel,
  fromCoverage,
  toCoverage,
  fromMapping,
  toMapping,
  fromView,
  toView,
  fromSupported,
  toSupported,
}: {
  coverageLabel: string;
  mappingLabel: string;
  viewLabel: string;
  supportedLabel: string;
  fromCoverage: string;
  toCoverage: string;
  fromMapping: string;
  toMapping: string;
  fromView: string;
  toView: string;
  fromSupported: string;
  toSupported: string;
}) {
  const rows = [
    { label: coverageLabel, before: fromCoverage, after: toCoverage },
    { label: mappingLabel, before: fromMapping, after: toMapping },
    { label: viewLabel, before: fromView, after: toView },
    { label: supportedLabel, before: fromSupported, after: toSupported },
  ].filter((row) => row.before !== row.after);
  return (
    <div className="w-[22rem] max-w-full text-left text-sm">
      <div className="border-b border-gray-100 px-3 py-2">
        <h3 className="font-semibold text-gray-900">
          <Trans ns="admin:data">Temporal settings</Trans>
        </h3>
      </div>
      <dl className="space-y-3 p-3">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {row.label}
            </dt>
            <dd className="mt-1.5 flex flex-col gap-1 text-gray-800">
              <span className="w-fit max-w-full rounded bg-gray-50 px-1.5 py-0.5 font-mono text-xs text-gray-500 line-through">
                {row.before}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-gray-400" aria-hidden>
                  {/* eslint-disable-next-line i18next/no-literal-string */}
                  {"->"}
                </span>
                <span className="w-fit max-w-full rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                  {row.after}
                </span>
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function DataTableTemporalFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  const noneText = t("None");
  const presentText = t("present");
  const fromSnap = temporalSettingsSnapshot(from.temporal, noneText, presentText);
  const toSnap = temporalSettingsSnapshot(to.temporal, noneText, presentText);
  const change = temporalSettingsChange(
    from.temporal,
    to.temporal,
    noneText,
    presentText
  );
  const reprocessed = isTemporalReprocess(
    props.changeLog.fromSummary,
    props.changeLog.toSummary,
    props.changeLog.meta
  );
  const name =
    tableNameFromSummary(to) ||
    tableNameFromSummary(from) ||
    t("Untitled table");
  const fromVersion = tableVersionFromSummary(from);
  const toVersion = tableVersionFromSummary(to);
  const downloadUrl = parquetUrlFromSummary(from);
  const tableId = props.changeLog.entityId;
  const actions = props.dataTableActions;
  const activeTable = actions?.activeTables.find((table) => table.id === tableId);
  const canRollback =
    reprocessed &&
    actions != null &&
    activeTable != null &&
    toVersion != null &&
    activeTable.version === toVersion &&
    toVersion > 1;
  const refetchQueries = actions
    ? dataTableMutationRefetchQueries(actions.tableOfContentsItemId)
    : undefined;
  const [rollbackTable, { loading: rollbackLoading }] =
    useRollbackOverlayDataTableVersionMutation({
      refetchQueries,
    });
  const versionLabel =
    fromVersion != null && toVersion != null
      ? t("v{{fromVersion}} → v{{toVersion}}", { fromVersion, toVersion })
      : null;
  const hasVersionMenu =
    reprocessed &&
    versionLabel != null &&
    fromVersion != null &&
    (downloadUrl || canRollback);
  const versionMenu = hasVersionMenu ? (
    <DataTableReplacementVersionMenu
      versionLabel={versionLabel}
      fromVersion={fromVersion}
      tableName={name}
      downloadUrl={downloadUrl}
      canRollback={canRollback}
      rollbackLoading={rollbackLoading}
      onRollback={() => {
        void rollbackTable({ variables: { id: tableId } });
      }}
    />
  ) : null;

  const details = (
    <SettingsDetails
      coverageLabel={t("Coverage")}
      mappingLabel={t("Date columns")}
      viewLabel={t("Default view")}
      supportedLabel={t("Supported views")}
      fromCoverage={fromSnap.coverageLabel}
      toCoverage={toSnap.coverageLabel}
      fromMapping={fromSnap.mappingLabel}
      toMapping={toSnap.mappingLabel}
      fromView={fromSnap.defaultViewResolution}
      toView={toSnap.defaultViewResolution}
      fromSupported={fromSnap.supportedViewResolutions}
      toSupported={toSnap.supportedViewResolutions}
    />
  );

  const coverageFromTo = (
    <Trans ns="admin:data">
      from{" "}
      <ChangeValue deleted>{fromSnap.coverageLabel}</ChangeValue>
      {" -> "}
      <ChangeValue details={details}>{toSnap.coverageLabel}</ChangeValue>
    </Trans>
  );

  const mappingFromTo = (
    <Trans ns="admin:data">
      from{" "}
      <ChangeValue deleted>{fromSnap.mappingLabel}</ChangeValue>
      {" -> "}
      <ChangeValue details={details}>{toSnap.mappingLabel}</ChangeValue>
    </Trans>
  );

  const changedCount =
    Number(change.coverage) +
    Number(change.mapping) +
    Number(change.defaultView) +
    Number(change.supportedViews);

  let body;
  if (reprocessed) {
    if (changedCount === 1 && change.coverage) {
      body = (
        <>
          <Trans ns="admin:data">reprocessed temporal coverage</Trans>{" "}
          {coverageFromTo}
          {versionMenu ? <> {versionMenu}</> : null}
        </>
      );
    } else if (changedCount === 1 && change.mapping) {
      body = (
        <>
          <Trans ns="admin:data">reprocessed date columns</Trans>{" "}
          {mappingFromTo}
          {versionMenu ? <> {versionMenu}</> : null}
        </>
      );
    } else {
      body = (
        <>
          <Trans ns="admin:data">
            reprocessed{" "}
            <ChangeValue details={details}>temporal settings</ChangeValue>
          </Trans>
          {versionMenu ? <> {versionMenu}</> : null}
        </>
      );
    }
  } else if (!from.temporal && to.temporal) {
    body = (
      <Trans ns="admin:data">
        set temporal coverage to{" "}
        <ChangeValue details={details}>{toSnap.coverageLabel}</ChangeValue>
      </Trans>
    );
  } else if (from.temporal && !to.temporal) {
    body = (
      <Trans ns="admin:data">
        cleared temporal coverage{" "}
        <ChangeValue deleted details={details}>
          {fromSnap.coverageLabel}
        </ChangeValue>
      </Trans>
    );
  } else if (changedCount === 1 && change.coverage) {
    body = (
      <>
        <Trans ns="admin:data">changed temporal coverage</Trans>{" "}
        {coverageFromTo}
      </>
    );
  } else if (changedCount === 1 && change.mapping) {
    body = (
      <>
        <Trans ns="admin:data">changed date columns</Trans> {mappingFromTo}
      </>
    );
  } else {
    body = (
      <Trans ns="admin:data">
        updated{" "}
        <ChangeValue details={details}>temporal settings</ChangeValue>
      </Trans>
    );
  }

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<ClockIcon className="h-5 w-5" />}
      iconClassName="bg-violet-50 text-violet-500"
    >
      {body}
    </BaseFieldGroupListItem>
  );
}
