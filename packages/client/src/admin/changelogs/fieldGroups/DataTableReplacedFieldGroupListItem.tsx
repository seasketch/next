import { RefreshIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";
import {
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
          {t("v{{fromVersion}} → v{{toVersion}}", { fromVersion, toVersion })}
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
