import { ClockIcon } from "@heroicons/react/outline";
import { LayersIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/Tooltip";
import LayerCartographyRevisionModal from "../../data/LayerCartographyRevisionModal";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
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
        <Tooltip placement="top">
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="inline-flex max-w-full items-center gap-1 rounded bg-pink-100/80 px-1.5 py-0.5 align-baseline font-mono text-sm leading-5 text-pink-900 hover:bg-pink-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label={t("View cartography history")}
            >
              <span>{t("cartography")}</span>
              <span className="relative inline-flex h-4 w-4 flex-none items-center justify-center">
                <LayersIcon className="h-3.5 w-3.5 text-pink-600" />
                <ClockIcon className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-pink-100 text-pink-800" />
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <Trans ns="admin:data">View cartography history</Trans>
          </TooltipContent>
        </Tooltip>
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
