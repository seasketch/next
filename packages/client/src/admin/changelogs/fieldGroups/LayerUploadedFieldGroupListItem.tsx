import { UploadIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";
import BaseFieldGroupListItem, {
  ChangeValue,
  FieldGroupListItemProps,
  summary,
  valueText,
} from "./FieldGroupListItemBase";

export default function LayerUploadedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const to = summary(props.changeLog.toSummary);
  const { t } = useTranslation("admin:data");
  const filename = valueText(to.filename, t("uploaded source"));
  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<UploadIcon className="h-5 w-5" />}
      iconClassName="bg-green-50 text-green-500"
    >
      {to.replacement ? (
        <Trans ns="admin:data">
          replaced source data with <ChangeValue>{filename}</ChangeValue>
        </Trans>
      ) : (
        <Trans ns="admin:data">
          uploaded <ChangeValue>{filename}</ChangeValue>
        </Trans>
      )}
      {to.changelog && (
        <span className="ml-1 text-gray-500">
          <ChangeValue>{valueText(to.changelog)}</ChangeValue>
        </span>
      )}
    </BaseFieldGroupListItem>
  );
}
