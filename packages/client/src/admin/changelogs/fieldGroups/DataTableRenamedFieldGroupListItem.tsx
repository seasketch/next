import { PencilIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
  valueText,
} from "./FieldGroupListItemBase";
import { tableVersionFromSummary } from "./dataTableSummary";

export default function DataTableRenamedFieldGroupListItem(
  props: FieldGroupListItemProps,
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  const version = tableVersionFromSummary(to);

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<PencilIcon className="h-5 w-5" />}
      iconClassName="bg-gray-50 text-gray-500"
    >
      <Trans ns="admin:data">
        renamed data table from{" "}
        <ChangeValue deleted>
          {valueText(from.name, t("Untitled table"))}
        </ChangeValue>{" "}
        {" -> "}
        <ChangeValue>{valueText(to.name, t("Untitled table"))}</ChangeValue>
      </Trans>
      {version != null ? (
        <> {t("(v{{version}})", { version })}</>
      ) : null}
    </BaseFieldGroupListItem>
  );
}
