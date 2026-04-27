import { CursorClickIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";
import { interactivityTypeLabel } from "./labels";

export default function LayerInteractivityFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  const from = summary(props.changeLog.fromSummary);
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<CursorClickIcon className="h-5 w-5" />}
      iconClassName="bg-purple-50 text-purple-500"
    >
      {to.type && from.type !== to.type ? (
        <Trans ns="admin:data">
          Changed interactivity from{" "}
          <ChangeValue>{interactivityTypeLabel(t, from.type)}</ChangeValue>
          {" -> "}{" "}
          <ChangeValue>{interactivityTypeLabel(t, to.type)}</ChangeValue>
        </Trans>
      ) : (
        <Trans ns="admin:data">updated interactivity text</Trans>
      )}
    </BaseFieldGroupListItem>
  );
}
