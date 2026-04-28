import { DocumentTextIcon } from "@heroicons/react/outline";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import LayerMetadataRevisionModal from "../../data/LayerMetadataRevisionModal";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
  ModalDetailPill,
} from "./FieldGroupListItemBase";

export default function LayerMetadataFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const [showHistory, setShowHistory] = useState(false);
  const { t } = useTranslation("admin:data");

  return (
    <>
      <BaseFieldGroupListItem
        {...props}
        icon={<DocumentTextIcon className="h-5 w-5" />}
        iconClassName="bg-gray-50 text-gray-500"
      >
        <Trans ns="admin:data">updated</Trans>{" "}
        <ModalDetailPill
          onClick={() => setShowHistory(true)}
          ariaLabel={t("View metadata history")}
        >
          {t("metadata")}
        </ModalDetailPill>
      </BaseFieldGroupListItem>
      {showHistory && (
        <LayerMetadataRevisionModal
          tableOfContentsItemId={props.changeLog.entityId}
          initialChangeLogId={props.changeLog.id}
          onRequestClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}
