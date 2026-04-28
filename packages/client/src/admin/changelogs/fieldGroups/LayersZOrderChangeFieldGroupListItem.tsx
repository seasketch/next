import { ViewListIcon } from "@heroicons/react/outline";
import { Trans } from "react-i18next";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";

export default function LayersZOrderChangeFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const to = summary(props.changeLog.toSummary);
  const reorderedCount =
    typeof to.reordered_count === "number" ? to.reordered_count : undefined;

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<ViewListIcon className="h-5 w-5" />}
      iconClassName="bg-indigo-50 text-indigo-500"
    >
      {reorderedCount == null ? (
        <Trans ns="admin:data">reordered data layers</Trans>
      ) : (
        <Trans ns="admin:data" count={reorderedCount}>
          Reordered the z-index of {{ count: reorderedCount }} layers
        </Trans>
      )}
    </BaseFieldGroupListItem>
  );
}
