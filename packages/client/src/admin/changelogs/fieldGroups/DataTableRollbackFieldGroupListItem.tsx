import { ReplyIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";
import { removedVersionFromSummary, tableLabel } from "./dataTableSummary";

export default function DataTableRollbackFieldGroupListItem(
  props: FieldGroupListItemProps,
) {
  const from = summary(props.changeLog.fromSummary);
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  const removedVersion = removedVersionFromSummary(from);
  const restored = tableLabel(to, t("Untitled table"));

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<ReplyIcon className="h-5 w-5" />}
      iconClassName="bg-amber-50 text-amber-600"
    >
      <Trans ns="admin:data">
        rolled back to <ChangeValue>{restored}</ChangeValue>
      </Trans>
      {removedVersion != null ? (
        <> {t("(removed v{{version}})", { version: removedVersion })}</>
      ) : null}
    </BaseFieldGroupListItem>
  );
}
