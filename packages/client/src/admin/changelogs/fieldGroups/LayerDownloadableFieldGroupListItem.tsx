import { DownloadIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";
import { downloadLabel } from "./labels";

export default function LayerDownloadableFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<DownloadIcon className="h-5 w-5" />}
      iconClassName="bg-green-50 text-green-500"
    >
      <Trans ns="admin:data">
        <ChangeValue>{downloadLabel(t, to.enable_download)}</ChangeValue> data
        downloads
      </Trans>
    </BaseFieldGroupListItem>
  );
}
