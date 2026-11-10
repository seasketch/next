import { SpeakerphoneIcon } from "@heroicons/react/outline";
import { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import { TFunction } from "i18next";
import BaseFieldGroupListItem, {
  FieldGroupListItemProps,
  summary,
} from "./FieldGroupListItemBase";
import PublishedLayerNames, {
  PublishedLayerName,
} from "./PublishedLayerNames";

function namedItems(
  items: ReadonlyArray<{
    stableId?: string | null;
    title?: string | null;
    isFolder?: boolean | null;
  }> | null | undefined
): PublishedLayerName[] {
  return (items ?? []).flatMap((item) => {
    if (!item.stableId) {
      return [];
    }
    return [
      {
        stableId: item.stableId,
        title: item.title?.trim() ? item.title : item.stableId,
        isFolder: Boolean(item.isFolder),
      },
    ];
  });
}

function layersLabel(t: TFunction, n: number) {
  return n === 1 ? t("1 layer") : `${n} ${t("layers")}`;
}

function foldersLabel(t: TFunction, n: number) {
  return n === 1 ? t("1 folder") : `${n} ${t("folders")}`;
}

function othersLabel(t: TFunction, n: number) {
  return n === 1 ? t("1 other") : `${n} ${t("others")}`;
}

/** Layers and folders that shipped, named separately when both are present. */
function publishedChangesLabel(t: TFunction, layers: number, folders: number) {
  const layerText = layers > 0 ? layersLabel(t, layers) : "";
  const folderText = folders > 0 ? foldersLabel(t, folders) : "";
  if (layerText && folderText) {
    return `${layerText} ${t("and")} ${folderText}`;
  }
  if (folderText) {
    return folderText;
  }
  return layersLabel(t, layers);
}

function ratioLabel(t: TFunction, shipped: number, total: number) {
  return `${shipped} / ${total} ${t("layers")}`;
}

export default function LayersPublishedFieldGroupListItem(
  props: FieldGroupListItemProps
) {
  const { t } = useTranslation("admin:data");
  const to = summary(props.changeLog.toSummary);
  const layerCount = typeof to.layer_count === "number" ? to.layer_count : 0;
  const manifestKnown = typeof props.changeLog.fullOverlayPublish === "boolean";
  const fullPublish = props.changeLog.fullOverlayPublish === true;
  const items = namedItems(props.changeLog.publishedOverlayItems);
  const shipped = items.filter((item) => !item.isFolder).length;
  const folderCount = items.length - shipped;
  const names = (label: string) => (
    <PublishedLayerNames items={items} label={label} />
  );
  const sentence =
    props.scope === "project"
      ? projectSentence({
          t,
          manifestKnown,
          fullPublish,
          layerCount,
          shipped,
          folderCount,
          names,
        })
      : layerSentence({
          t,
          manifestKnown,
          fullPublish,
          layerCount,
          shipped,
          folderCount,
          names,
        });

  return (
    <BaseFieldGroupListItem
      {...props}
      icon={<SpeakerphoneIcon className="h-5 w-5" />}
      iconClassName="bg-emerald-100 text-emerald-700"
    >
      {sentence}
    </BaseFieldGroupListItem>
  );
}

function projectSentence({
  t,
  manifestKnown,
  fullPublish,
  layerCount,
  shipped,
  folderCount,
  names,
}: {
  t: TFunction;
  manifestKnown: boolean;
  fullPublish: boolean;
  layerCount: number;
  shipped: number;
  folderCount: number;
  names: (label: string) => ReactNode;
}) {
  if (!manifestKnown) {
    return (
      <Trans ns="admin:data" count={layerCount}>
        published {{ count: layerCount }} layers to project users
      </Trans>
    );
  }
  if (fullPublish && shipped === 0) {
    return t("published the full layer list");
  }
  if (fullPublish && shipped === layerCount) {
    return (
      <>
        {t("published the full layer list of")} {names(layersLabel(t, shipped))}
      </>
    );
  }
  if (fullPublish) {
    return (
      <>
        {t("published the full layer list, including changes to")}{" "}
        {names(ratioLabel(t, shipped, layerCount))}
      </>
    );
  }
  const label = publishedChangesLabel(t, shipped, folderCount);
  return (
    <>
      {t("published changes to")} {names(label)}
    </>
  );
}

function layerSentence({
  t,
  manifestKnown,
  fullPublish,
  layerCount,
  shipped,
  folderCount,
  names,
}: {
  t: TFunction;
  manifestKnown: boolean;
  fullPublish: boolean;
  layerCount: number;
  shipped: number;
  folderCount: number;
  names: (label: string) => ReactNode;
}) {
  if (!manifestKnown) {
    return (
      <Trans ns="admin:data">
        published this layer along with {{ layerCount }} others
      </Trans>
    );
  }
  const others = Math.max(shipped - 1, 0);
  if (fullPublish && shipped < layerCount) {
    return (
      <>
        {t("published this layer in a full list update that changed")}{" "}
        {names(ratioLabel(t, shipped, layerCount))}
      </>
    );
  }
  if (fullPublish) {
    const label = layersLabel(t, shipped);
    return (
      <>
        {t("published this layer with the full layer list of")} {names(label)}
      </>
    );
  }
  if (others === 0 && folderCount === 0) {
    return t("published this layer");
  }
  const companion =
    folderCount === 0
      ? othersLabel(t, others)
      : others === 0
      ? foldersLabel(t, folderCount)
      : `${othersLabel(t, others)} ${t("and")} ${foldersLabel(t, folderCount)}`;
  return (
    <>
      {t("published this layer along with")} {names(companion)}
    </>
  );
}
