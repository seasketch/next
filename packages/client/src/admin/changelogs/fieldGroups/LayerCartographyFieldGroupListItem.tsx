import { ColorSwatchIcon } from "@heroicons/react/outline";
import { Trans } from "react-i18next";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
} from "./FieldGroupListItemBase";

export default function LayerCartographyFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<ColorSwatchIcon className="h-5 w-5" />}
      iconClassName="bg-blue-50 text-blue-500"
    >
      <Trans ns="admin:data">updated cartography</Trans>
    </BaseFieldGroupListItem>
  );
}
