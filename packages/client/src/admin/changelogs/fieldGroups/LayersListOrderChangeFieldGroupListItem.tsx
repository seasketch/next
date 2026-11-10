import { ViewListIcon } from "@heroicons/react/outline";
import { Trans } from "react-i18next";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
} from "./FieldGroupListItemBase";

export default function LayersListOrderChangeFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<ViewListIcon className="h-5 w-5" />}
      iconClassName="bg-indigo-50 text-indigo-500"
    >
      <Trans ns="admin:data">reordered the layer list</Trans>
    </BaseFieldGroupListItem>
  );
}
