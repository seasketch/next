import { FolderIcon } from "@heroicons/react/outline";
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
  const fromFolder = valueText(from.folder);
  const toFolder = valueText(to.folder);
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<FolderIcon className="h-5 w-5" />}
      iconClassName="bg-indigo-50 text-indigo-500"
    >
      <Trans ns="admin:data">
        moved from{" "}
        <ChangeValue deleted>
          <FolderValue folder={fromFolder} fallback={t("root")} />
        </ChangeValue>{" "}
        to{" "}
        <ChangeValue>
          <FolderValue folder={toFolder} fallback={t("root")} />
        </ChangeValue>
      </Trans>
    </BaseFieldGroupListItem>
  );
}

function FolderValue({
  folder,
  fallback,
}: {
  folder: string;
  fallback: string;
}) {
  if (!folder) {
    return <>{fallback}</>;
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1 align-middle leading-5">
      <FolderIcon className="h-3.5 w-3.5 flex-none text-gray-400" aria-hidden />
      <span className="min-w-0 truncate">{folder}</span>
    </span>
  );
}
