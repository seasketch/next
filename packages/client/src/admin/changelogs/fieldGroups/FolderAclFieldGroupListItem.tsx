import { FieldGroupListItemProps } from "./FieldGroupListItemBase";
import LayerAclFieldGroupListItem from "./LayerAclFieldGroupListItem";

export default function FolderAclFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  return <LayerAclFieldGroupListItem {...props} />;
}
