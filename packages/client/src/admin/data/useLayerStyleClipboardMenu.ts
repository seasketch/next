import { gql, useApolloClient } from "@apollo/client";
import { useCallback, useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGlobalErrorHandler } from "../../components/GlobalErrorHandler";
import useDialog from "../../components/useDialog";
import { useToast } from "../../components/Toast";
import { MapManagerContext } from "../../dataLayers/MapContextManager";
import { resolveSourceGeostats } from "../../dataLayers/supportsSeasketchRasterInteractivity";
import {
  DataSourceTypes,
  GetLayerItemDocument,
  LayerCartographyChangesDocument,
  useUpdateLayerMutation,
} from "../../generated/graphql";
import { layerSettingsChangeLogRefetchQueries } from "../changelogs/layerSettingsChangeLogRefetch";
import {
  isCartographyComparisonSupported,
  normalizeMapboxGlStyles,
} from "./cartographyRevisionUtils";
import { validateGLStyleFragment } from "./GLStyleEditor/extensions/validateGLStyleFragment";
import {
  assessStylePaste,
  getCopiedLayerStyle,
  LayerStyleClipboardPayload,
  LayerStyleKind,
  readLayerStyleFromClipboard,
  setCopiedLayerStyle,
  StylePasteIssue,
  useCopiedLayerStyle,
  writeLayerStyleToClipboard,
} from "./layerStyleClipboard";
import { TocMenuItemType } from "./TableOfContentsItemMenu";

export function isStyleClipboardSourceType(
  type?: DataSourceTypes | null
): boolean {
  return isCartographyComparisonSupported(type);
}

function styleKindForSourceType(
  type?: DataSourceTypes | null
): LayerStyleKind | null {
  if (!type || !isStyleClipboardSourceType(type)) {
    return null;
  }
  return type === DataSourceTypes.SeasketchRaster ? "raster" : "vector";
}

export function useLayerStyleClipboardMenu(item: TocMenuItemType) {
  const { t } = useTranslation("admin:data");
  const { alert, confirm, loadingMessage } = useDialog();
  const { toast } = useToast();
  const onError = useGlobalErrorHandler();
  const client = useApolloClient();
  const { manager } = useContext(MapManagerContext);
  const hopper = useCopiedLayerStyle();
  const [clipboardPeek, setClipboardPeek] =
    useState<LayerStyleClipboardPayload | null>(null);
  const [updateLayer] = useUpdateLayerMutation({
    refetchQueries: [
      ...layerSettingsChangeLogRefetchQueries(item.id),
      {
        query: LayerCartographyChangesDocument,
        variables: { id: item.id },
      },
    ],
    onError,
  });

  useEffect(() => {
    let cancelled = false;
    readLayerStyleFromClipboard().then((payload) => {
      if (!cancelled && payload) {
        setClipboardPeek(payload);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const knownStylable =
    item.dataSourceType == null ||
    isStyleClipboardSourceType(item.dataSourceType);
  const showStyleClipboard = !item.isFolder && knownStylable;
  const canPaste = Boolean(hopper || clipboardPeek);

  const copyStyle = useCallback(async () => {
    try {
      const { data } = await client.query({
        query: GetLayerItemDocument,
        variables: { id: item.id },
        fetchPolicy: "cache-first",
      });
      const toc = data.tableOfContentsItem;
      const layer = toc?.dataLayer;
      const sourceType = layer?.dataSource?.type;
      const styleKind = styleKindForSourceType(sourceType);
      if (!toc || !layer || !styleKind) {
        await alert(
          t("This layer type does not use a SeaSketch style that can be copied.")
        );
        return;
      }
      const styles = normalizeMapboxGlStyles(layer.mapboxGlStyles);
      if (!styles.length) {
        await alert(t("This layer has no style to copy."));
        return;
      }
      const payload: LayerStyleClipboardPayload = {
        version: 1,
        copiedFromTitle: toc.title || item.title,
        copiedFromTocItemId: toc.id,
        styleKind,
        mapboxGlStyles: styles,
      };
      await writeLayerStyleToClipboard(payload);
      toast(t("Style copied"), {
        description: payload.copiedFromTitle,
      });
    } catch (e) {
      onError(e);
    }
  }, [alert, client, item.id, item.title, onError, t, toast]);

  const pasteStyle = useCallback(async () => {
    try {
      const payload =
        (await readLayerStyleFromClipboard()) || getCopiedLayerStyle();
      if (!payload) {
        await alert(
          t("No layer style on the clipboard. Use Copy style first.")
        );
        return;
      }

      const { data } = await client.query({
        query: GetLayerItemDocument,
        variables: { id: item.id },
        fetchPolicy: "cache-first",
      });
      const toc = data.tableOfContentsItem;
      const layer = toc?.dataLayer;
      const sourceType = layer?.dataSource?.type;
      const targetKind = styleKindForSourceType(sourceType);
      if (!toc || !layer || !targetKind) {
        await alert(
          t("This layer type does not use a SeaSketch style that can be pasted.")
        );
        return;
      }

      const geostats = resolveSourceGeostats(
        layer.dataSource?.geostats,
        layer.sourceLayer
      );
      const issues = assessStylePaste({
        styles: payload.mapboxGlStyles,
        copiedKind: payload.styleKind,
        targetKind,
        geostats,
      });
      const blocker = issues.find(
        (issue): issue is Extract<
          StylePasteIssue,
          { kind: "style-kind-mismatch" }
        > => issue.kind === "style-kind-mismatch"
      );
      if (blocker) {
        await alert(
          blocker.copiedKind === "vector"
            ? t("A vector style cannot be pasted onto a raster layer.")
            : t("A raster style cannot be pasted onto a vector layer.")
        );
        return;
      }

      const validationErrors = validateGLStyleFragment(
        payload.mapboxGlStyles,
        targetKind
      );
      if (validationErrors.length) {
        await alert(t("This style cannot be applied to this layer."), {
          description: validationErrors[0].message,
        });
        return;
      }

      const warnings = issues.filter((issue) => issue.kind !== "style-kind-mismatch");
      if (warnings.length) {
        const sourceLabel = payload.copiedFromTitle || t("another layer");
        const ok = await confirm(t("Paste style anyway?"), {
          icon: "alert",
          primaryButtonText: t("Paste style"),
          description: describePasteWarnings(
            warnings,
            sourceLabel,
            toc.title || item.title,
            t
          ),
        });
        if (!ok) {
          return;
        }
      }

      const { hideLoadingMessage } = loadingMessage(t("Pasting style…"));
      try {
        client.writeFragment({
          id: `DataLayer:${layer.id}`,
          fragment: gql`
            fragment PastedGLStyle on DataLayer {
              mapboxGlStyles
            }
          `,
          data: {
            mapboxGlStyles: payload.mapboxGlStyles,
          },
        });
        await updateLayer({
          variables: {
            id: layer.id,
            mapboxGlStyles: payload.mapboxGlStyles,
          },
        });
        manager?.updateLegends(true);
        setCopiedLayerStyle(payload);
        toast(t("Style pasted"), {
          description: toc.title || item.title,
        });
      } finally {
        hideLoadingMessage();
      }
    } catch (e) {
      onError(e);
    }
  }, [
    alert,
    client,
    confirm,
    item.id,
    item.title,
    loadingMessage,
    manager,
    onError,
    t,
    toast,
    updateLayer,
  ]);

  return {
    showStyleClipboard,
    canPaste,
    copyStyle,
    pasteStyle,
  };
}

function describePasteWarnings(
  warnings: StylePasteIssue[],
  sourceLabel: string,
  targetLabel: string,
  t: (key: string, options?: { [key: string]: string }) => string
): string {
  const parts: string[] = [];
  for (const warning of warnings) {
    if (warning.kind === "missing-properties") {
      parts.push(
        t(
          'This style from "{{source}}" refers to properties that "{{target}}" does not have: {{properties}}. Those parts of the style may not draw correctly.',
          {
            source: sourceLabel,
            target: targetLabel,
            properties: warning.properties.join(", "),
          }
        )
      );
    } else if (warning.kind === "geometry-mismatch") {
      parts.push(
        t(
          'This style uses {{layerTypes}} layers, but "{{target}}" is {{geometry}} data and may not draw as expected.',
          {
            layerTypes: warning.styleLayerTypes.join(", "),
            target: targetLabel,
            geometry: warning.targetGeometry,
          }
        )
      );
    }
  }
  return parts.join(" ");
}
