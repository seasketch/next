import { PencilIcon, ShareIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
  valueText,
} from "./FieldGroupListItemBase";

export default function LayerAttributionFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<PencilIcon className="h-5 w-5" />}
      iconClassName="bg-gray-50 text-gray-500"
    >
      <Trans ns="admin:data">
        changed attribution from{" "}
        <ChangeValue deleted>
          {valueText(from.attribution, t("null"))}
        </ChangeValue>{" "}
        {" -> "}{" "}
        <ChangeValue>{valueText(to.attribution, t("null"))}</ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}
