import { TableIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";
import { tableLabel } from "./dataTableSummary";

export default function DataTableCreatedFieldGroupListItem(
  props: FieldGroupListItemProps,
) {
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  const label = tableLabel(to, t("Untitled table"));

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<TableIcon className="h-5 w-5" />}
      iconClassName="bg-green-50 text-green-500"
    >
      <Trans ns="admin:data">
        uploaded data table <ChangeValue>{label}</ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}
