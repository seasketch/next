import { ShareIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
  valueText,
} from "./FieldGroupListItemBase";

export default function LayersPublishedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<ShareIcon className="h-5 w-5" />}
      iconClassName="bg-blue-50 text-blue-500"
    >
      <Trans ns="admin:data">
        published data layers list{" "}
        <ChangeValue>{valueText(to.layer_count, t("changes"))}</ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}
