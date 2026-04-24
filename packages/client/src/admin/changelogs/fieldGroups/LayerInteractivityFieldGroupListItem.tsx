import { CursorClickIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
  valueText,
} from "./FieldGroupListItemBase";

export default function LayerInteractivityFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<CursorClickIcon className="h-5 w-5" />}
      iconClassName="bg-purple-50 text-purple-500"
    >
      {to.type ? (
        <Trans ns="admin:data">
          updated interactivity to{" "}
          <ChangeValue>{valueText(to.type, t("custom"))}</ChangeValue>
        </Trans>
      ) : (
        <Trans ns="admin:data">updated interactivity</Trans>
      )}
    </BaseFieldGroupListItem>
  );
}
