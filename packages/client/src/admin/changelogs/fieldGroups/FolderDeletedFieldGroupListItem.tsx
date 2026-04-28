import { TrashIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
  valueText,
} from "./FieldGroupListItemBase";

export default function FolderDeletedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const from = summary(props.changeLog.fromSummary);
  const { t } = useTranslation("admin:data");
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<TrashIcon className="h-5 w-5" />}
      iconClassName="bg-red-50 text-red-500"
    >
      <Trans ns="admin:data">
        deleted folder{" "}
        <ChangeValue>{valueText(from.title, t("Untitled folder"))}</ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}
