import { DownloadIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";
import { downloadLabel } from "./labels";
import { Share1Icon } from "@radix-ui/react-icons";

export default function LayerDownloadableFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<Share1Icon className="h-5 w-5" />}
      iconClassName="bg-blue-50 text-blue-500"
    >
      <Trans ns="admin:data">
        <ChangeValue>{downloadLabel(t, to.enable_download)}</ChangeValue> data
        downloads
      </Trans>
    </BaseFieldGroupListItem>
  );
}
