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
  missingProfileLabel,
  dataTableActions,
}: {
  changeLog: ChangeLogDetailsFragment;
  last?: boolean;
  itemTitle?: ReactNode;
  missingProfileLabel?: string;
  dataTableActions?: {
    tableOfContentsItemId: number;
    activeTables: { id: number; version: number }[];
  };
}) {
  const FieldGroupListItem =
    FIELD_GROUP_LIST_ITEM_COMPONENTS[changeLog.fieldGroup] ||
    GenericFieldGroupListItem;
  return (
    <FieldGroupListItem
      changeLog={changeLog}
      last={last}
      itemTitle={itemTitle}
      missingProfileLabel={missingProfileLabel}
      dataTableActions={dataTableActions}
    />
  );
}
