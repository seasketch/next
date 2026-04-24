import { ViewListIcon } from "@heroicons/react/outline";
import { Trans } from "react-i18next";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
} from "./FieldGroupListItemBase";

export default function LayersZOrderChangeFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<ViewListIcon className="h-5 w-5" />}
      iconClassName="bg-indigo-50 text-indigo-500"
    >
      <Trans ns="admin:data">reordered data layers</Trans>
    </BaseFieldGroupListItem>
  );
}
