import { MinusCircleIcon } from "@heroicons/react/outline";
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
  isNodataReprocess,
  nodataValuesLabel,
} from "./dataTableNodataChange";

export default function DataTableNodataFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  const noneText = t("None");
  const fromLabel = nodataValuesLabel(from, noneText);
  const toLabel = nodataValuesLabel(to, noneText);
  const name =
    tableNameFromSummary(to) || tableNameFromSummary(from) || t("Untitled table");
  const reprocessed = isNodataReprocess(
    props.changeLog.meta,
    props.changeLog.fromSummary,
    props.changeLog.toSummary
  );
  const version = tableVersionFromSummary(to);

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<MinusCircleIcon className="h-5 w-5" />}
      iconClassName="bg-gray-50 text-gray-500"
    >
      {reprocessed ? (
        <Trans ns="admin:data">
          reprocessed no-data values for{" "}
          <ChangeValue>{name}</ChangeValue>
        </Trans>
      ) : (
        <Trans ns="admin:data">
          updated no-data values for <ChangeValue>{name}</ChangeValue>
        </Trans>
      )}
      {version != null ? <> {t("(v{{version}})", { version })}</> : null}
      {" "}
      <Trans ns="admin:data">
        from <ChangeValue deleted>{fromLabel}</ChangeValue>
        {" -> "}
        <ChangeValue>{toLabel}</ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}
