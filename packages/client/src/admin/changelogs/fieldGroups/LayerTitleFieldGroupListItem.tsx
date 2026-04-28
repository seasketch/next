import { PencilIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
  valueText,
} from "./FieldGroupListItemBase";

export default function LayerTitleFieldGroupListItem(
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
        changed title from{" "}
        <ChangeValue deleted>
          {valueText(from.title, t("Untitled"))}
        </ChangeValue>{" "}
        {" -> "} <ChangeValue>{valueText(to.title, t("Untitled"))}</ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}
