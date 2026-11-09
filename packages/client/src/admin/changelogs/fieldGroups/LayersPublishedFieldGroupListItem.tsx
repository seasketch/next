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

function layerItems(
  items: ReadonlyArray<PublishedLayerName> | null | undefined
) {
  return (items ?? []).filter((item) => !item.isFolder);
}

function layersLabel(t: TFunction, n: number) {
  return n === 1 ? t("1 layer") : `${n} ${t("layers")}`;
}

function othersLabel(t: TFunction, n: number) {
  return n === 1 ? t("1 other") : `${n} ${t("others")}`;
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
  const items = props.changeLog.publishedOverlayItems ?? [];
  const shipped = layerItems(items).length;
  const names = (label: string) => (
    <PublishedLayerNames items={items} label={label} />
  );
  const sentence =
    props.scope === "project"
      ? projectSentence({ t, manifestKnown, fullPublish, layerCount, shipped, names })
      : layerSentence({ t, manifestKnown, fullPublish, layerCount, shipped, names });

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
  names,
}: {
  t: TFunction;
  manifestKnown: boolean;
  fullPublish: boolean;
  layerCount: number;
  shipped: number;
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
  const label = layersLabel(t, shipped);
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
  names,
}: {
  t: TFunction;
  manifestKnown: boolean;
  fullPublish: boolean;
  layerCount: number;
  shipped: number;
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
  if (others === 0) {
    return t("published this layer");
  }
  return (
    <>
      {t("published this layer along with")} {names(othersLabel(t, others))}
    </>
  );
}
