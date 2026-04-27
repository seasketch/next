import { LayersIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import LayerCartographyRevisionModal from "../../data/LayerCartographyRevisionModal";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
  ModalDetailPill,
} from "./FieldGroupListItemBase";

export default function LayerCartographyFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const [showHistory, setShowHistory] = useState(false);
  const { t } = useTranslation("admin:data");

  return (
    <>
      <BaseFieldGroupListItem
        {...props}
        icon={<LayersIcon className="h-5 w-5" />}
        iconClassName="bg-pink-50 text-pink-500"
      >
        <Trans ns="admin:data">updated</Trans>{" "}
        <ModalDetailPill
          onClick={() => setShowHistory(true)}
          ariaLabel={t("View cartography history")}
        >
          {t("cartography")}
        </ModalDetailPill>
      </BaseFieldGroupListItem>
      {showHistory && (
        <LayerCartographyRevisionModal
          tableOfContentsItemId={props.changeLog.entityId}
          initialChangeLogId={props.changeLog.id}
          onRequestClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}
