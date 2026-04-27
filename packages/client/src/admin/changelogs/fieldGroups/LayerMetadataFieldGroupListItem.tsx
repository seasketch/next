import { ClockIcon, DocumentTextIcon } from "@heroicons/react/outline";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/Tooltip";
import LayerMetadataRevisionModal from "../../data/LayerMetadataRevisionModal";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
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
        <Tooltip placement="top">
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="inline-flex max-w-full items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 align-baseline font-mono text-sm leading-5 text-gray-800 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label={t("View metadata history")}
            >
              <span>{t("metadata")}</span>
              <span className="relative inline-flex h-4 w-4 flex-none items-center justify-center">
                <DocumentTextIcon className="h-3.5 w-3.5 text-gray-500" />
                <ClockIcon className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-gray-100 text-gray-600" />
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <Trans ns="admin:data">View metadata history</Trans>
          </TooltipContent>
        </Tooltip>
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
