import { ReactNode } from "react";
import { ChangeLogDetailsFragment } from "../../generated/graphql";
import {
  FIELD_GROUP_LIST_ITEM_COMPONENTS,
  GenericFieldGroupListItem,
} from "./fieldGroups";

export default function ChangeLogListItem({
  changeLog,
  last,
  itemTitle,
}: {
  changeLog: ChangeLogDetailsFragment;
  last?: boolean;
  itemTitle?: ReactNode;
}) {
  const FieldGroupListItem =
    FIELD_GROUP_LIST_ITEM_COMPONENTS[changeLog.fieldGroup] ||
    GenericFieldGroupListItem;
  return (
    <FieldGroupListItem
      changeLog={changeLog}
      last={last}
      itemTitle={itemTitle}
    />
  );
}
