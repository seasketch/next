import { useContext, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import Spinner from "../../../components/Spinner";
import Warning from "../../../components/Warning";
import { BasemapContext } from "../../../dataLayers/BasemapContext";
import {
  BasemapDetailsFragment,
  useLayerCartographyChangesQuery,
} from "../../../generated/graphql";
import CartographyRevisionSplitMap from "../CartographyRevisionSplitMap";
import {
  buildCartographyRevisions,
  CartographyRevision,
  hasComparableCartographyHistory,
  isCartographyComparisonSupported,
  normalizeMapboxGlStyles,
  resolveInitialLeftRevisionId,
  selectableLeftRevisions,
} from "../cartographyRevisionUtils";

export default function PublishCartographyBadgePreview({
  tableOfContentsItemId,
  initialChangeLogId,
}: {
  tableOfContentsItemId: number;
  /** Oldest cartography changelog id in the publish window — drives left revision */
  initialChangeLogId?: string | null;
}) {
  const { t } = useTranslation("admin:data");
  const basemapCtx = useContext(BasemapContext);
  const basemap = basemapCtx.getSelectedBasemap() as
    | BasemapDetailsFragment
    | undefined;

  const { data, loading, error } = useLayerCartographyChangesQuery({
    variables: { id: tableOfContentsItemId },
    fetchPolicy: "cache-first",
  });

  const toc = data?.tableOfContentsItem;
  const dataLayer = toc?.dataLayer;
  const source = dataLayer?.dataSource;

  const revisions = useMemo(() => buildCartographyRevisions(data), [data]);

  const leftRevisionId = useMemo(
    () =>
      resolveInitialLeftRevisionId(
        revisions,
        toc?.cartographyChangeLogs ?? [],
        initialChangeLogId ?? null
      ),
    [revisions, toc?.cartographyChangeLogs, initialChangeLogId]
  );

  const leftChoices = useMemo(
    () => selectableLeftRevisions(revisions),
    [revisions]
  );

  const leftRevision = useMemo(() => {
    return (
      leftChoices.find((r) => r.id === leftRevisionId) ??
      leftChoices[0] ??
      undefined
    );
  }, [leftChoices, leftRevisionId]);

  const currentRevision = useMemo(
    () => revisions.find((r: CartographyRevision) => r.current),
    [revisions]
  );

  const supportsComparison = isCartographyComparisonSupported(source?.type);
  const hasComparableHistory = hasComparableCartographyHistory(revisions);

  const previewLayer =
    dataLayer && source
      ? {
          id: dataLayer.id,
          sourceLayer: dataLayer.sourceLayer,
          sublayer: dataLayer.sublayer,
          dataSourceId: dataLayer.dataSourceId!,
        }
      : null;

  const mapShell = "w-[320px] max-w-full overflow-hidden rounded border border-gray-200 bg-white";

  if (loading && !data) {
    return (
      <div className={`${mapShell} flex h-28 items-center justify-center`}>
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Warning level="error" className="text-[11px] leading-tight">
        {error.message}
      </Warning>
    );
  }

  if (!supportsComparison) {
    return (
      <Warning level="warning" className="text-[11px] leading-tight">
        <Trans ns="admin:data">Comparison unavailable for this source.</Trans>
      </Warning>
    );
  }

  if (!dataLayer || !source || !previewLayer) {
    return (
      <Warning level="warning" className="text-[11px] leading-tight">
        <Trans ns="admin:data">No layer for preview.</Trans>
      </Warning>
    );
  }

  if (!hasComparableHistory) {
    return (
      <div className={`${mapShell} h-28`}>
      <CartographyRevisionSplitMap
        variant="single"
        basemap={basemap}
        dataSource={source}
        dataLayer={previewLayer}
        leftStyles={normalizeMapboxGlStyles(
          currentRevision?.mapboxGlStyles ?? dataLayer.mapboxGlStyles
        )}
        tocBounds={toc?.bounds ?? null}
        compactChrome
      />
      </div>
    );
  }

  return (
    <div className={`${mapShell} h-28`}>
      <CartographyRevisionSplitMap
        variant="compare"
        basemap={basemap}
        dataSource={source}
        dataLayer={previewLayer}
        leftStyles={normalizeMapboxGlStyles(leftRevision?.mapboxGlStyles)}
        rightStyles={normalizeMapboxGlStyles(
          currentRevision?.mapboxGlStyles ?? dataLayer.mapboxGlStyles
        )}
        tocBounds={toc?.bounds ?? null}
        leftLabel={t("Before")}
        rightLabel={t("After")}
        splitInteractive={false}
        compactChrome
        edgePaddingPx={{ left: 12, right: 12 }}
      />
    </div>
  );
}
