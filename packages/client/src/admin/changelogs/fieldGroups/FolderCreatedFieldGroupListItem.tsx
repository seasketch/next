import { FolderAddIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
  valueText,
} from "./FieldGroupListItemBase";

export default function FolderCreatedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<FolderAddIcon className="h-5 w-5" />}
      iconClassName="bg-green-50 text-green-500"
    >
      <Trans ns="admin:data">
        created folder{" "}
        <ChangeValue>{valueText(to.title, t("Untitled folder"))}</ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}
