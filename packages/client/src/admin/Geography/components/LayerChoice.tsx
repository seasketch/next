/* eslint-disable jsx-a11y/anchor-is-valid */
import { Trans, useTranslation } from "react-i18next";
import Button from "../../../components/Button";
import {
  DataSourceTypes,
  DataUploadOutputType,
  OverlayForGeographyListFragment,
  useOverlaysForGeographyQuery,
  useOverlayForGeographyDetailsQuery,
  AuthorProfileFragment,
} from "../../../generated/graphql";
import getSlug from "../../../getSlug";
import { useGlobalErrorHandler } from "../../../components/GlobalErrorHandler";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Spinner from "../../../components/Spinner";
import { SingleSelect } from "../../users/GroupMultiSelect";
import type {
  Map as MapboxMap,
  AnyLayer,
  LngLatBoundsLike,
  AnySourceData,
} from "mapbox-gl";
import { GeostatsLayer } from "@seasketch/geostats-types";
import bytes from "bytes";
import InputBlock from "../../../components/InputBlock";
import Switch from "../../../components/Switch";
import {
  isExpression,
  findGetExpression,
} from "../../../dataLayers/legends/utils";

interface Group {
  value: number;
  label: string;
}

interface LayerChoiceGroup extends Group {
  data: OverlayForGeographyListFragment;
}

interface LayerChoiceProps {
  onCancel: () => void;
  onSubmit: (params: {
    dataLayerId: number;
    selectedAttribute?: string;
    attributeValues?: (string | number | boolean)[];
    eraseLand: boolean;
    layerTitle: string;
    authorProfile?: AuthorProfileFragment;
    createdAt: string;
  }) => Promise<void>;
  map: MapboxMap | null;
  mode?: "geographyCreation" | "clippingLayerAddition";
  excludeDataLayerIds?: number[];
}

const SOURCE_PREFIX = "layer-choice";
const LAYER_PREFIX = "layer-choice-layer";

// Helper function to score attributes based on our criteria
function scoreAttributes(
  geostats: GeostatsLayer | undefined,
  styleLayers?: any[]
): Array<{ attribute: string; score: number; hasUniqueValues: boolean }> {
  if (!geostats?.attributes) return [];

  // Attributes to exclude from consideration
  const excludePatterns = [
    /shape[_-]?length/i,
    /shape[_-]?area/i,
    /area/i,
    /length/i,
    /perimeter/i,
    /id$/i,
    /^id/i,
    /^fid/i,
    /^gid/i,
    /^objectid/i,
    /^oid/i,
  ];

  // Important paint properties to check for get expressions
  const importantPaintProps = [
    "fill-color",
    "line-color",
    "circle-color",
    "icon-image",
  ];

  // First, collect attributes used in the style
  const styleAttributes = new Set<string>();
  if (styleLayers?.length) {
    for (const layer of styleLayers) {
      if (layer.paint) {
        for (const prop of importantPaintProps) {
          const value = layer.paint[prop];
          if (value && isExpression(value)) {
            const getExpr = findGetExpression(value);
            if (getExpr && "property" in getExpr) {
              styleAttributes.add(getExpr.property);
            }
          }
        }
      }
    }
  }

  // Score all attributes
  return geostats.attributes
    .map((attr) => {
      let score = 0;

      // Check if number of unique values matches feature count
      const uniqueValues = Object.keys(attr.values).length;
      const hasUniqueValues = uniqueValues === geostats.count;
      if (hasUniqueValues) score += 3;

      // Highest priority: attributes used in style
      if (styleAttributes.has(attr.attribute)) {
        score += 5;
      }

      // Check if it's a string type
      const isString = typeof Object.keys(attr.values)[0] === "string";
      if (isString) score += 2;

      // Penalize attributes that match exclusion patterns
      const shouldExclude = excludePatterns.some((pattern) =>
        pattern.test(attr.attribute)
      );
      if (shouldExclude) score -= 2;

      return {
        attribute: attr.attribute,
        score,
        hasUniqueValues,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// Helper function to choose the best attribute for labeling
function chooseBestLabelAttribute(
  geostats: GeostatsLayer | undefined,
  styleLayers?: any[]
): string | undefined {
  const scoredAttributes = scoreAttributes(geostats, styleLayers);
  // Only choose attributes that have unique values
  const bestAttribute = scoredAttributes.find((attr) => attr.hasUniqueValues);
  return bestAttribute?.attribute;
}

export default function LayerChoice({
  onCancel,
  onSubmit,
  map,
  mode = "geographyCreation",
  excludeDataLayerIds,
}: LayerChoiceProps) {
  const { t } = useTranslation("admin:geography");
  const onError = useGlobalErrorHandler();
  const { data, loading } = useOverlaysForGeographyQuery({
    variables: { slug: getSlug() },
    onError,
  });

  const [saving, setSaving] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<
    LayerChoiceGroup | undefined
  >();
  const [selectedAttribute, setSelectedAttribute] = useState<string>();
  const [eraseLand, setEraseLand] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const addedLayersRef = useRef<Set<string>>(new Set());
  const addedSourcesRef = useRef<Set<string>>(new Set());

  const validChoices = useMemo(() => {
    const items = data?.projectBySlug?.polygonOverlaysForGeography;
    if (!items) {
      return [];
    }
    const excludeIds = excludeDataLayerIds || [];
    return items.map((item: OverlayForGeographyListFragment) => ({
      value: item.id,
      label:
        item.title +
        " (" +
        (item.dataLayer?.dataSource?.vectorGeometryType || "") +
        ")",
      data: item,
      disabled: excludeIds.includes(item.dataLayer?.id ?? -1),
    }));
  }, [data?.projectBySlug?.polygonOverlaysForGeography, excludeDataLayerIds]);

  const selectedTocId = selectedLayer?.value;
  const { data: detailsData, loading: detailsLoading } =
    useOverlayForGeographyDetailsQuery({
      variables: { id: selectedTocId! },
      skip: selectedTocId == null,
      onError,
    });
  const detailsItem = detailsData?.tableOfContentsItem;
  const selectedDetails =
    detailsItem && detailsItem.id === selectedTocId ? detailsItem : undefined;

  // Cleanup function to remove all added layers and sources
  const cleanupLayersAndSources = useCallback(() => {
    if (!map) return;

    // Remove all tracked layers
    addedLayersRef.current.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });
    addedLayersRef.current.clear();

    // Remove all tracked sources
    addedSourcesRef.current.forEach((sourceId) => {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    });
    addedSourcesRef.current.clear();
  }, [map]);

  // Handle layer display on map
  useEffect(() => {
    if (!map) return;

    // Clean up any existing layers and sources
    cleanupLayersAndSources();

    if (!selectedDetails?.dataLayer) return;

    if (selectedDetails.bounds) {
      map.fitBounds(selectedDetails.bounds as LngLatBoundsLike, {
        animate: true,
        // maxDuration: 500,
        speed: 3,
      });
    }

    const sourceId = `${SOURCE_PREFIX}-${selectedDetails.id}`;
    const layerId = `${LAYER_PREFIX}-${selectedDetails.id}`;

    // Add the new source
    const source: AnySourceData =
      selectedDetails.dataLayer.dataSource?.type === DataSourceTypes.Geojson ||
      selectedDetails.dataLayer.dataSource?.type ===
        DataSourceTypes.SeasketchVector
        ? {
            type: "geojson",
            data: selectedDetails.dataLayer.dataSource?.url || "",
          }
        : {
            type: "vector",
            url: selectedDetails.dataLayer.dataSource!.url! + ".json",
          };
    map.addSource(sourceId, source);
    addedSourcesRef.current.add(sourceId);

    // Add each style layer from the mapboxGlStyles array
    const styleLayers = selectedDetails.dataLayer.mapboxGlStyles || [];
    styleLayers.forEach((styleLayer: any, index: number) => {
      const layerStyle = {
        ...styleLayer,
        id: `${layerId}-${index}`,
        source: sourceId,
        "source-layer": selectedDetails.dataLayer?.sourceLayer || "",
      };
      map.addLayer(layerStyle as AnyLayer);
      addedLayersRef.current.add(`${layerId}-${index}`);
    });

    // Cleanup function
    return () => {
      cleanupLayersAndSources();
    };
  }, [cleanupLayersAndSources, map, selectedDetails]);

  // Dedicated cleanup effect for component unmounting
  useEffect(() => {
    return () => {
      cleanupLayersAndSources();
    };
  }, [cleanupLayersAndSources]);

  const handleLayerChange = (value?: Group) => {
    if (!value) {
      setSelectedLayer(undefined);
      setSelectedAttribute(undefined);
      setValidationError(null);
      return;
    }
    const fullLayer = validChoices.find(
      (choice) => choice.value === value.value
    );

    setSelectedLayer(fullLayer);
    setSelectedAttribute(undefined);

    // Check if the selected layer is disabled (i.e., its dataLayerId is in excludeDataLayerIds)
    if (
      fullLayer &&
      excludeDataLayerIds &&
      excludeDataLayerIds.includes(fullLayer.data.dataLayer?.id ?? -1)
    ) {
      setValidationError(
        t(
          "This layer is already used in this geography and cannot be selected."
        )
      );
    } else {
      setValidationError(null);
    }
  };

  const geostatsLayer: GeostatsLayer | undefined =
    selectedDetails?.dataLayer?.dataSource?.geostats?.layers?.[0];
  const styleLayers = selectedDetails?.dataLayer?.mapboxGlStyles;

  useEffect(() => {
    if (!geostatsLayer) {
      return;
    }
    setSelectedAttribute(chooseBestLabelAttribute(geostatsLayer, styleLayers));
  }, [geostatsLayer, styleLayers]);

  const size = (selectedDetails?.dataLayer?.dataSource?.outputs || []).find(
    (output) => output.type === DataUploadOutputType.FlatGeobuf
  )?.size;

  const featureCount =
    selectedLayer?.data.dataLayer?.dataSource?.featureCount ??
    geostatsLayer?.count;
  const bytesPerFeature = size && featureCount ? size / featureCount : 0;
  const isLargeLayer = bytesPerFeature > 3 * 1024 * 1024; // 3MB in bytes

  const getAttributeOptions = useMemo(() => {
    if (!geostatsLayer?.attributes) return [];
    const scoredAttributes = scoreAttributes(geostatsLayer, styleLayers);
    return scoredAttributes.map(({ attribute, hasUniqueValues }) => {
      const attr = geostatsLayer.attributes.find(
        (a) => a.attribute === attribute
      )!;
      const sampleValues = Object.keys(attr.values).slice(0, 3).join(", ");
      return {
        value: attribute,
        label: `${attribute} (${sampleValues ? `${sampleValues}` : ""})`,
        disabled: !hasUniqueValues,
      };
    });
  }, [geostatsLayer, styleLayers]);

  const hasSuitableAttributes = useMemo(() => {
    if (!geostatsLayer?.attributes) return false;
    const scoredAttributes = scoreAttributes(geostatsLayer, styleLayers);
    return scoredAttributes.some((attr) => attr.hasUniqueValues);
  }, [geostatsLayer, styleLayers]);

  return (
    <div className="w-full absolute flex justify-center items-center z-20 top-0">
      <div className="w-144 bg-white rounded-b-md shadow-md">
        <div className="p-4">
          <h2 className="text-lg">{t("Choose a Polygon Layer")}</h2>
          <p className="text-sm text-gray-500 mt-2">
            {mode === "geographyCreation" ? (
              <Trans ns="admin:geography">
                Choose a layer as a base for your Geography. Layers with
                multiple features will produce multiple Geographies. You may
                select from the list of existing Overlays, or upload a new
                vector layer.
              </Trans>
            ) : (
              <Trans ns="admin:geography">
                Choose an overlay layer to use as a clipping boundary for this
                geography.
              </Trans>
            )}
          </p>
          {loading && (
            <div className="flex justify-center items-center h-32">
              <Spinner />
            </div>
          )}
          {!loading && validChoices.length === 0 && (
            <div className="text-sm text-gray-500 py-4">
              {t("No valid polygon layers found")}
            </div>
          )}
          {!loading && validChoices.length > 0 && (
            <div className="mt-2">
              <SingleSelect
                groups={validChoices}
                value={selectedLayer}
                onChange={handleLayerChange}
                title={""}
                loading={loading}
              />
            </div>
          )}
          {selectedLayer && detailsLoading && (
            <div className="flex justify-center items-center h-16">
              <Spinner />
            </div>
          )}

          {validationError && (
            <div className="text-sm text-red-500 mt-2">{validationError}</div>
          )}

          {featureCount !== undefined && (
            <div className="text-sm text-gray-500 mt-2">
              {t(
                "This layer contains {{count}} {{featureText}}{{size}}{{isLarge}}",
                {
                  count: featureCount,
                  featureText: featureCount === 1 ? "feature" : "features",
                  size: size ? ` and is ${bytes(parseInt(size))} in size` : "",
                  isLarge: isLargeLayer
                    ? ". Clipping operations against large layers may be slower"
                    : "",
                }
              )}
            </div>
          )}

          {mode === "geographyCreation" && (
            <>
              {selectedLayer &&
                featureCount !== undefined &&
                featureCount > 1 &&
                featureCount <= 10 &&
                !hasSuitableAttributes && (
                  <div className="text-sm text-red-500 mt-2">
                    {t(
                      "Warning: No attributes found with unique values for each feature. Each Geography requires a unique identifier."
                    )}
                  </div>
                )}

              {selectedLayer &&
                featureCount !== undefined &&
                featureCount <= 10 &&
                (featureCount === 1 ||
                  (featureCount > 1 &&
                    hasSuitableAttributes &&
                    getAttributeOptions.length > 0)) && (
                  <div className="mt-4 space-y-4">
                    {featureCount > 1 && (
                      <InputBlock
                        title={t("Identify Features By")}
                        description={t(
                          "Choose an attribute to use as a unique identifier for your Geographies"
                        )}
                        input={
                          <select
                            className="w-64 px-2 py-0.5 pr-8 border rounded truncate"
                            value={selectedAttribute}
                            onChange={(e) =>
                              setSelectedAttribute(e.target.value)
                            }
                          >
                            {getAttributeOptions.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                                disabled={option.disabled}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        }
                      />
                    )}

                    <InputBlock
                      title={t("Remove Land")}
                      description={t(
                        "If enabled, OpenStreetMap coastline data will be used to remove land from sketches drawn within this geography. Only enable if your features are not already clipped to land."
                      )}
                      input={
                        <Switch
                          isToggled={eraseLand}
                          onClick={() => setEraseLand(!eraseLand)}
                        />
                      }
                    />
                  </div>
                )}

              {featureCount !== undefined && featureCount > 10 && (
                <div className="text-sm text-red-500 mt-2">
                  <Trans ns="admin:geography">
                    Geography creation for this layer is disabled because it has
                    &gt; 10 individual features and would create too many
                    Geographies. If you need to create a Geography that has more
                    than one polygon, use desktop GIS to create a MultiPolygon
                    layer. Contact{" "}
                    <a target="_blank" className="underline">
                      support@seasketch.org
                    </a>{" "}
                    if you need help.
                  </Trans>
                </div>
              )}
            </>
          )}
        </div>
        <div className="space-x-2 bg-gray-50 border-t p-4 py-3 rounded-b">
          <Button label={t("Cancel")} disabled={saving} onClick={onCancel} />
          <Button
            label={t("Continue")}
            primary
            loading={saving}
            onClick={async () => {
              const dataLayerId =
                selectedDetails?.dataLayer?.id ??
                selectedLayer?.data.dataLayer?.id;
              if (!dataLayerId) return;

              setSaving(true);
              try {
                // For single-feature layers, we don't need attribute values
                const attributeValues =
                  mode === "geographyCreation" &&
                  featureCount !== 1 &&
                  selectedAttribute
                    ? (() => {
                        const attr = geostatsLayer?.attributes?.find(
                          (attr) => attr.attribute === selectedAttribute
                        );
                        if (!attr) return undefined;

                        // Coerce values based on the attribute type
                        switch (attr.type) {
                          case "boolean":
                            return Object.keys(attr.values).map(
                              (v) => v === "true"
                            );
                          case "number":
                            return Object.keys(attr.values).map((v) =>
                              Number(v)
                            );
                          case "string":
                          case "mixed": // For mixed types, keep as strings
                            return Object.keys(attr.values);
                          default:
                            return undefined;
                        }
                      })()
                    : undefined;

                await onSubmit({
                  dataLayerId,
                  selectedAttribute:
                    mode === "geographyCreation" && featureCount !== 1
                      ? selectedAttribute
                      : undefined,
                  attributeValues,
                  eraseLand: mode === "geographyCreation" ? eraseLand : false,
                  layerTitle: selectedLayer?.data.title || "",
                  authorProfile: selectedDetails?.dataLayer?.dataSource
                    ?.authorProfile as AuthorProfileFragment | undefined,
                  createdAt:
                    selectedDetails?.dataLayer?.dataSource?.createdAt ||
                    selectedLayer?.data.dataLayer?.dataSource?.createdAt ||
                    new Date().toISOString(),
                });
              } finally {
                setSaving(false);
              }
            }}
            disabled={
              !selectedLayer ||
              detailsLoading ||
              !selectedDetails?.dataLayer?.id ||
              saving ||
              !!validationError ||
              (mode === "geographyCreation" &&
                ((featureCount !== undefined && featureCount > 10) ||
                  (featureCount !== undefined &&
                    featureCount > 1 &&
                    !hasSuitableAttributes)))
            }
          />
        </div>
      </div>
    </div>
  );
}
