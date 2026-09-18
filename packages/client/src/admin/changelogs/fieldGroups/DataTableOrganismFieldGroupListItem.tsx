import { SearchIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";
import {
  tableNameFromSummary,
  tableVersionFromSummary,
} from "./dataTableSummary";
import {
  isOrganismReprocess,
  organismColumnLabel,
  organismFromSummary,
} from "./dataTableOrganismChange";

export default function DataTableOrganismFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  const noneText = t("None");
  const fromLabel = organismColumnLabel(from, noneText);
  const toLabel = organismColumnLabel(to, noneText);
  const name =
    tableNameFromSummary(to) || tableNameFromSummary(from) || t("Untitled table");
  const reprocessed = isOrganismReprocess(props.changeLog.meta);
  const version = tableVersionFromSummary(to);
  const counts = organismFromSummary(to);
  const classifiedCount = counts?.classifiedCount;
  const valueCount = counts?.valueCount;

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<SearchIcon className="h-5 w-5" />}
      iconClassName="bg-gray-50 text-gray-500"
    >
      {reprocessed ? (
        <Trans ns="admin:data">
          enriched organisms for <ChangeValue>{name}</ChangeValue>
        </Trans>
      ) : (
        <Trans ns="admin:data">
          updated organism identity for <ChangeValue>{name}</ChangeValue>
        </Trans>
      )}
      {version != null ? <> {t("(v{{version}})", { version })}</> : null}{" "}
      <Trans ns="admin:data">
        from <ChangeValue deleted>{fromLabel}</ChangeValue>
        {" -> "}
        <ChangeValue>{toLabel}</ChangeValue>
      </Trans>
      {classifiedCount != null && valueCount != null ? (
        <>
          {" "}
          {t("{{classified}}/{{total}} classified", {
            classified: classifiedCount,
            total: valueCount,
          })}
        </>
      ) : null}
    </BaseFieldGroupListItem>
  );
}
