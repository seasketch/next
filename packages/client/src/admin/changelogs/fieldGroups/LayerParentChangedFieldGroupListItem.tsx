import { SwitchHorizontalIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
  valueText,
} from "./FieldGroupListItemBase";

export default function LayerParentChangedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<SwitchHorizontalIcon className="h-5 w-5" />}
      iconClassName="bg-indigo-50 text-indigo-500"
    >
      <Trans ns="admin:data">
        moved from{" "}
        <ChangeValue deleted>{valueText(from.folder, t("top level"))}</ChangeValue>{" "}
        to <ChangeValue>{valueText(to.folder, t("top level"))}</ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}
