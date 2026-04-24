import { ArchiveIcon } from "@heroicons/react/outline";
import { Trans } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
} from "./FieldGroupListItemBase";

export default function GenericFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<ArchiveIcon className="h-5 w-5" />}
      iconClassName="bg-gray-50 text-gray-500"
    >
      <Trans ns="admin:data">
        updated <ChangeValue>{props.changeLog.fieldGroup}</ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}
