import { FolderIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";
import { folderTypeLabel } from "./labels";

export default function FolderTypeFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<FolderIcon className="h-5 w-5" />}
      iconClassName="bg-yellow-50 text-yellow-600"
    >
      <Trans ns="admin:data">
        changed folder type from{" "}
        <ChangeValue deleted>{folderTypeLabel(t, from.type)}</ChangeValue> to{" "}
        <ChangeValue>{folderTypeLabel(t, to.type)}</ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}
