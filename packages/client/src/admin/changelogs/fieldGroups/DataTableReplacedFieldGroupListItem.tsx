import { RefreshIcon } from "@heroicons/react/outline";
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
  tableLabel,
  tableNameFromSummary,
  tableVersionFromSummary,
} from "./dataTableSummary";

export default function DataTableReplacedFieldGroupListItem(
  props: FieldGroupListItemProps,
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
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
    versionLabel != null && fromVersion != null && (downloadUrl || canRollback);
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

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<RefreshIcon className="h-5 w-5" />}
      iconClassName="bg-indigo-50 text-indigo-500"
    >
      {fromVersion != null && toVersion != null ? (
        <>
          <Trans ns="admin:data">replaced data table</Trans>{" "}
          <ChangeValue>{name}</ChangeValue>{" "}
          {versionMenu ?? (
            <ChangeValue>{versionLabel}</ChangeValue>
          )}
        </>
      ) : (
        <Trans ns="admin:data">
          replaced data table{" "}
          <ChangeValue>{tableLabel(to, t("Untitled table"))}</ChangeValue>
        </Trans>
      )}
    </BaseFieldGroupListItem>
  );
}
