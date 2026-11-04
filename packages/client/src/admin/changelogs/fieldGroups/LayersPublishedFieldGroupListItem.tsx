import { SpeakerphoneIcon } from "@heroicons/react/outline";
import { Trans } from "react-i18next";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";

export default function LayersPublishedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const to = summary(props.changeLog.toSummary);
  const layerCount = typeof to.layer_count === "number" ? to.layer_count : 0;
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<SpeakerphoneIcon className="h-5 w-5" />}
      iconClassName="bg-emerald-100 text-emerald-700"
    >
      {props.scope === "project" ? (
        <Trans ns="admin:data" count={layerCount}>
          published {{ count: layerCount }} layers to project users
        </Trans>
      ) : (
        <Trans ns="admin:data">
          published this layer along with {{ layerCount }} others
        </Trans>
      )}
    </BaseFieldGroupListItem>
  );
}
