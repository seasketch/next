import { Trans } from "react-i18next";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
} from "./FieldGroupListItemBase";
import { LayersIcon } from "@radix-ui/react-icons";

export default function LayerCartographyFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<LayersIcon className="h-5 w-5" />}
      iconClassName="bg-pink-50 text-pink-500"
    >
      <Trans ns="admin:data">updated cartography</Trans>
    </BaseFieldGroupListItem>
  );
}
