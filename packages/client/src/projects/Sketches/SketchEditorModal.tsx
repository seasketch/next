import {
  SketchingDetailsFragment,
  SketchingDocument,
  SketchingQuery,
  SketchTocDetailsFragment,
  useCreateSketchMutation,
  SketchEditorModalDetailsFragment,
  useUpdateSketchMutation,
  SketchCrudResponseFragment,
  SketchGeometryType,
} from "../../generated/graphql";
import { Trans, useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  useCallback,
  useContext,
  useEffect,
  useState,
  useMemo,
  useRef,
  memo,
} from "react";
import { motion } from "framer-motion";
import { useRouteMatch } from "react-router-dom";
import getSlug from "../../getSlug";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/outline";
import Button from "../../components/Button";
import useMapboxGLDraw, {
  DigitizingState,
  EMPTY_FEATURE_COLLECTION,
} from "../../draw/useMapboxGLDraw";
import { MapContext } from "../../dataLayers/MapContextManager";
import DigitizingTools from "../../formElements/DigitizingTools";
import { ZoomToFeature } from "../../draw/MapSettingsPopup";
import { BBox, Feature, Geometry } from "geojson";
import { toFeatureCollection } from "../../formElements/FormElement";
import useDialog from "../../components/useDialog";
import Warning from "../../components/Warning";
import Skeleton from "../../components/Skeleton";
import { MapMouseEvent } from "mapbox-gl";
import area from "@turf/area";
import bboxPolygon from "@turf/bbox-polygon";
import { currentSidebarState } from "../ProjectAppSidebar";
import SketchForm from "./SketchForm";
import { useTranslatedProps } from "../../components/TranslatedPropControl";
import { FormElementLayoutContext } from "../../surveys/SurveyAppLayout";
import { defaultStyle } from "../../surveys/appearance";
import { FilterInputServiceContextProvider } from "../../formElements/FilterInputContext";
import FilteredPlanningUnitCountHeader from "./FilteredPlanningUnitCountHeader";

function SketchEditorModal({
  sketch,
  sketchClass,
  onCancel,
  onComplete,
  folderId,
  loading,
  loadingTitle,
  collectionId,
}: {
  loading?: boolean;
  loadingTitle?: string;
  sketch?: SketchEditorModalDetailsFragment;
  sketchClass: SketchingDetailsFragment;
  onCancel: () => void;
  onComplete: (sketch: SketchTocDetailsFragment) => void;
  folderId?: number;
  collectionId?: number;
}) {
  const { t } = useTranslation("sketching");
  const [left, setLeft] = useState(true);
  const baseRoute = useRouteMatch(`/${getSlug()}/app`);
  const mapContext = useContext(MapContext);
  const [feature, setFeature] = useState<Feature | null>(null);
  const [preprocessedGeometry, setPreprocessedGeometry] =
    useState<Geometry | null>(null);
  const [submissionAttempted, setSubmissionAttempted] = useState(false);
  const [name, setName] = useState<string>();
  const [properties, setProperties] = useState<any>(sketch?.properties || {});
  const [hasValidationErrors, setHasValidationErrors] = useState(false);

  useEffect(() => {
    if (
      sketchClass.geometryType === SketchGeometryType.FilteredPlanningUnits &&
      mapContext.manager &&
      sketch
    ) {
      const manager = mapContext.manager;
      manager.hideEditableSketch(sketch.id);
      return () => {
        manager.unhideEditableSketch();
      };
    }
  }, [sketchClass.geometryType, mapContext.manager, sketch]);
  //   const styleRelevantProps = useMemo(() => {
  //     return extractRelevantPropsFromStyle(sketchClass.mapboxGlStyle || []);
  //   }, [sketchClass]);
  // //

  // useEffect(() => {
  //   const elements = sketchClass.form?.formElements || [];
  //   if (styleRelevantProps.length && elements.length && mapContext.manager) {
  //     const newProperties: { [key: string]: any } = {};
  //     styleRelevantProps.forEach((prop) => {
  //       const element =
  //         prop === "name"
  //           ? elements.find((e) => e.type?.componentName === "FeatureName")
  //           : elements.find((e) => e.generatedExportId === prop);
  //       if (element) {
  //         newProperties[prop] = properties[element.id];
  //       }
  //     });
  //     mapContext.manager.updateSketchProperties(sketch?.id || 0, newProperties);
  //   }
  // }, [
  //   styleRelevantProps,
  //   properties,
  //   sketchClass.form?.formElements,
  //   mapContext.manager,
  // ]);

  const scrollableAreaRef = useRef<HTMLDivElement>(null);

  const formElements = useMemo(() => {
    const elements = sketchClass.form?.formElements || [];
    let sorted = [...elements].sort((a, b) => a.position - b.position);
    return [
      sorted.find((el) => el.typeId === "FeatureName")!,
      ...sorted.filter((el) => el.typeId !== "FeatureName"),
    ];
  }, [sketchClass.form?.formElements]);

  const nameElementId = useMemo(() => {
    return (sketchClass.form?.formElements || []).find(
      (e) => e.typeId === "FeatureName"
    )?.id;
  }, [sketchClass.form?.formElements]);

  const startingProperties = useMemo(() => {
    if (!sketch) {
      return {};
    } else {
      // @ts-ignore
      const properties = { ...sketch.properties } || {};
      const nameElement = formElements.find((f) => f.typeId === "FeatureName");
      if (nameElement) {
        properties[nameElement.id] = sketch.name;
      }
      return properties;
    }
  }, [sketch, formElements]);

  const handleCancel = useCallback(() => {
    mapContext.manager?.clearSketchEditingState();
    onCancel();
  }, [onCancel, mapContext.manager]);

  const [createSketch, createSketchState] = useCreateSketchMutation({
    update: (cache, { data }) => {
      if (data?.createSketch) {
        const sketch = data.createSketch;
        const results = cache.readQuery<SketchingQuery>({
          query: SketchingDocument,
          variables: {
            slug: getSlug(),
          },
        });
        if (results?.projectBySlug?.mySketches) {
          cache.writeQuery({
            query: SketchingDocument,
            variables: { slug: getSlug() },
            data: {
              ...results,
              projectBySlug: {
                ...results.projectBySlug,
                mySketches: [...results.projectBySlug.mySketches, sketch],
              },
            },
          });
        }
      }
    },
  });

  const [updateSketch, updateSketchState] = useUpdateSketchMutation({});

  const extraRequestParams = useMemo(() => {
    if (
      sketchClass.isGeographyClippingEnabled &&
      Array.isArray(sketchClass.clippingGeographies)
    ) {
      const geographies = [];
      for (const geography of sketchClass.clippingGeographies!) {
        if (!geography) {
          continue;
        }
        const clippingLayers = [];
        if (geography.clippingLayers) {
          for (const layer of geography.clippingLayers) {
            if (!layer.dataLayer?.vectorObjectKey) {
              throw new Error("Vector object key is required");
            }
            if (layer.objectKey) {
              clippingLayers.push({
                id: layer.id,
                cql2Query: layer.cql2Query,
                op: layer.operationType,
                dataset: layer.dataLayer.vectorObjectKey,
                templateId: layer.templateId,
              });
            }
          }
        }
        geographies.push({
          name: geography.name,
          id: geography.id,
          clippingLayers,
        });
      }
      return {
        geographies,
      };
    }
    return undefined;
  }, [sketchClass.isGeographyClippingEnabled, sketchClass.clippingGeographies]);

  const draw = useMapboxGLDraw(
    mapContext,
    sketchClass.geometryType,
    EMPTY_FEATURE_COLLECTION,
    (feature) => {
      setFeature(feature);
    },
    undefined,
    sketchClass.isGeographyClippingEnabled
      ? "https://overlay.seasketch.org/geographies/clip"
      : sketchClass.preprocessingEndpoint || undefined,
    setPreprocessedGeometry,
    extraRequestParams,
    (feature) => {
      if (
        feature.geometry.coordinates[0].length > 3 &&
        sketchClass.isGeographyClippingEnabled
      ) {
        fetch("https://overlay.seasketch.org/geographies/warm-cache", {
          method: "POST",
          body: JSON.stringify({
            ...extraRequestParams,
            feature,
          }),
          headers: {
            "Content-Type": "application/json",
          },
        }).catch((err) => {
          console.error("err", err);
        });
      }
    }
  );

  useEffect(() => {
    if (
      sketch?.bbox &&
      mapContext.manager?.map &&
      sketchClass.geometryType !== SketchGeometryType.Collection &&
      sketchClass.geometryType !== SketchGeometryType.Point &&
      sketchClass.geometryType !== SketchGeometryType.FilteredPlanningUnits
    ) {
      // If the sketch is not within the current viewport bounds, or is very
      // small or otherwise hard to see, zoom to it.
      const map = mapContext.manager.map;
      const bbox = sketch.bbox as number[];
      const boundsLike = [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ] as [[number, number], [number, number]];
      const mapBounds = map.getBounds();
      // If the map contains the coordinates of our bbox, skip
      if (
        mapBounds.contains(boundsLike[0]) ||
        mapBounds.contains(boundsLike[1])
      ) {
        // make sure that the size of the feature on the screen > 0.05%
        const viewport = [
          mapBounds.getWest(),
          mapBounds.getSouth(),
          mapBounds.getEast(),
          mapBounds.getNorth(),
        ] as [number, number, number, number];
        const bboxArea = area(bboxPolygon(sketch.bbox as BBox));
        const viewportArea = area(bboxPolygon(viewport));
        const fraction = bboxArea / viewportArea;
        if (fraction > 0.0005) {
          return;
        }
      }
      const sidebarInfo = currentSidebarState();
      map.fitBounds(boundsLike, {
        animate: true,
        padding: true // sidebarInfo.open
          ? {
              top: 150,
              bottom: 150,
              right: 150,
              left: sidebarInfo.width + 50,
            }
          : 150,
      });
    }
  }, [sketch?.bbox, mapContext.manager?.map, sketchClass.geometryType]);

  useEffect(() => {
    if (
      mapContext.manager &&
      sketch &&
      mapContext.manager.interactivityManager
    ) {
      const manager = mapContext.manager;
      const interactivityManager = mapContext.manager.interactivityManager;
      const focusedSketchClickHandler = (
        focusedFeature: Feature<any>,
        originalEvent: MapMouseEvent
      ) => {
        manager.hideEditableSketch(sketch.id);
        draw.setCollection(
          toFeatureCollection([
            {
              id: sketch.id.toString(),
              type: "Feature",
              properties: {},
              geometry: sketch.userGeom!.geojson,
            },
          ]),
          true
        );
      };
      manager.markSketchAsEditable(sketch.id);
      // draw.disable();
      interactivityManager.on(
        "click:focused-sketch",
        focusedSketchClickHandler
      );
      return () => {
        manager.unmarkSketchAsEditable();
        interactivityManager.off(
          "click:focused-sketch",
          focusedSketchClickHandler
        );
      };
    } else if (mapContext.manager && sketch) {
      // draw.disable();
      mapContext.manager?.clearSketchEditingState();
    } else {
      mapContext.manager?.clearSketchEditingState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapContext.manager,
    mapContext.manager?.interactivityManager,
    sketch?.id,
  ]);

  useEffect(() => {
    if (sketch) {
      if (sketch.userGeom?.geojson) {
        setFeature({
          id: sketch.id.toString(),
          type: "Feature",
          properties: startingProperties,
          geometry: sketch.userGeom.geojson,
        });
      }
    }
  }, [sketch, setFeature, startingProperties]);

  const scrollToBottom = useCallback(() => {
    if (scrollableAreaRef.current) {
      const area = scrollableAreaRef.current;
      setTimeout(() => {
        area.scrollTop = area.scrollHeight;
      }, 100);
    }
  }, [scrollableAreaRef]);

  useEffect(() => {
    if (sketch) {
      draw.actions.clearSelection();
      setName(sketch.name);
      setProperties(sketch.properties);
    } else {
      draw.create(false, true);
    }
    // If draw is added as a dependency, it will break shape editing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sketch, setName, setProperties]);

  useEffect(() => {
    if (!baseRoute?.isExact) {
      setLeft(false);
    }
  }, [baseRoute?.isExact, setLeft]);

  const { confirmDelete } = useDialog();

  const [geometryErrors, setGeometryErrors] = useState<string | null>(null);

  const onSubmit = useCallback(async () => {
    setSubmissionAttempted(true);

    if (
      draw.selfIntersects ||
      draw.digitizingState === DigitizingState.PREPROCESSING_ERROR
    ) {
      scrollToBottom();
      setGeometryErrors(t("You must fix problems with your geometry first"));
      return;
    }

    if (
      !feature &&
      sketchClass.geometryType !== SketchGeometryType.Collection &&
      sketchClass.geometryType !== SketchGeometryType.FilteredPlanningUnits
    ) {
      scrollToBottom();
      setGeometryErrors(t("You must finish your geometry first"));
      return;
    }

    if (draw.digitizingState === DigitizingState.PREPROCESSING) {
      scrollToBottom();
      setGeometryErrors(t("Wait until processing is complete"));
      return;
    }

    if (
      sketchClass.geometryType === SketchGeometryType.Point &&
      !sketchClass.preprocessingEndpoint
    ) {
      // skip right over "completing" geometry
    } else {
      if (
        sketchClass.geometryType !== SketchGeometryType.Collection &&
        draw.digitizingState !== DigitizingState.NO_SELECTION &&
        sketchClass.geometryType !== SketchGeometryType.FilteredPlanningUnits
      ) {
        scrollToBottom();
        setGeometryErrors(t("Please complete your geometry first"));
        return;
      }
    }

    if (hasValidationErrors) {
      scrollToBottom();
      return;
    }

    // draw.disable();

    // See if geometry has been changed.
    let geometryChanged = false;
    if (
      feature &&
      sketchClass.geometryType !== SketchGeometryType.Collection &&
      sketch?.userGeom?.geojson
    ) {
      const originalGeom = JSON.stringify(sketch.userGeom.geojson);
      const newGeom = JSON.stringify(feature.geometry);
      geometryChanged = originalGeom !== newGeom;
    }

    if (!name) {
      throw new Error("Name not specified");
    }

    let data: SketchCrudResponseFragment | undefined;
    if (sketch) {
      const response = await updateSketch({
        variables: geometryChanged
          ? {
              name,
              userGeom: feature,
              properties,
              id: sketch.id,
            }
          : {
              name,
              properties,
              id: sketch.id,
            },
      });
      data = response.data?.updateSketch || undefined;
    } else {
      const response = await createSketch({
        variables: {
          name,
          sketchClassId: sketchClass.id,
          userGeom: feature,
          folderId,
          collectionId,
          properties: properties,
        },
      });
      data = response.data?.createSketch || undefined;
    }
    const manager = mapContext.manager;
    if (manager && data) {
      if (geometryChanged && feature) {
        await manager.pushLocalSketchGeometryCopy(
          data.id,
          {
            type: "Feature",
            id: data.id,
            properties: data.geojsonProperties || {},
            bbox: (data.bbox as [number, number, number, number]) || undefined,
            geometry: preprocessedGeometry || feature.geometry,
          },
          data.timestamp
        );
      } else {
        // update local geometry copy attributes if it exists
        manager.updateLocalSketchGeometryProperties(
          data.id,
          data.timestamp,
          data.geojsonProperties || {}
        );
      }
      manager.clearSketchEditingState();
      onComplete(data);
    } else {
      throw new Error(
        "No response from mutation or mapContext.manager is unset"
      );
    }
  }, [
    draw,
    name,
    properties,
    feature,
    sketch,
    t,
    updateSketch,
    onComplete,
    createSketch,
    sketchClass.id,
    folderId,
    mapContext.manager,
    preprocessedGeometry,
    sketchClass.geometryType,
    hasValidationErrors,
    sketchClass.preprocessingEndpoint,
    collectionId,
    scrollToBottom,
  ]);

  useEffect(() => {
    if (
      feature &&
      !draw.selfIntersects &&
      geometryErrors &&
      !draw.preprocessingError &&
      draw.digitizingState !== DigitizingState.EDITING
    ) {
      setGeometryErrors(null);
    }
  }, [
    feature,
    draw.selfIntersects,
    geometryErrors,
    draw.preprocessingError,
    draw.digitizingState,
  ]);

  const getTranslatedProp = useTranslatedProps(sketchClass);

  // useEffect(() => {
  //   if (loading) {
  //     draw.disable();
  //   } else {
  //     draw.enable();
  //   }
  // }, [draw, draw.disable, draw.enable, loading]);

  return (
    <>
      {createPortal(
        <motion.div
          initial={{ scale: 0.8, opacity: 0, left: 72 }}
          variants={{
            left: {
              scale: 1,
              opacity: 1,
              left: 72,
            },
            right: {
              scale: 1,
              opacity: 1,
              left: "calc(100vw - 520px)",
            },
          }}
          transition={{
            duration: 0.2,
            bounce: false,
          }}
          animate={left ? "left" : "right"}
          className={`bg-white rounder absolute top-2 z-10 rounded-lg shadow-xl flex flex-col overflow-hidden`}
          style={{ maxHeight: "calc(100vh - 200px)", width: "26rem" }}
        >
          {" "}
          {loading ? (
            <div>
              <h1 className="flex items-center p-4">
                {loadingTitle || <Skeleton className="w-3/4" />}
              </h1>
              <div className="p-4 pt-0 flex-1 overflow-y-auto space-y-1">
                <Skeleton className="w-40 rounded" />
                <Skeleton className="w-full rounded h-8" />
                <div className="pt-3 space-y-1">
                  <Skeleton className="w-52 rounded" />
                  <Skeleton className="w-full rounded h-32" />
                </div>
              </div>
              <div className="pt-3 space-y-1 bg-gray-50 border-t flex items-center space-x-2 p-4">
                <Button label={t("Cancel")} onClick={handleCancel} />
              </div>
            </div>
          ) : (
            <>
              <FilterInputServiceContextProvider
                serviceLocation={
                  sketchClass.filterApiServerLocation || undefined
                }
                startingProperties={properties || startingProperties}
                formElements={formElements}
              >
                <h1 className="flex items-center p-4 border-b">
                  <span className="flex-1">
                    <span className="font-bold">
                      {!sketch && <Trans ns="sketching">New</Trans>}{" "}
                      {getTranslatedProp("name")}
                    </span>
                  </span>
                  {!left && (
                    <button onClick={() => setLeft(true)}>
                      <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                  )}
                  {left && (
                    <button onClick={() => setLeft(false)}>
                      <ArrowRightIcon className="w-6 h-6" />
                    </button>
                  )}
                </h1>
                {sketchClass.geometryType ===
                  SketchGeometryType.FilteredPlanningUnits && (
                  <FilteredPlanningUnitCountHeader />
                )}
                <div
                  className="mt-3 p-4 pt-0 flex-1 overflow-y-auto SketchForm"
                  dir="ltr"
                  ref={scrollableAreaRef}
                >
                  <FormElementLayoutContext.Provider
                    value={{
                      mapPortal: null,
                      style: {
                        ...defaultStyle,
                        isDark: false,
                        textClass: "text-black",
                        backgroundColor: "#eee",
                        secondaryColor: "#999",
                        secondaryColor2: "#aaa",
                        isSmall: false,
                        compactAppearance: true,
                      },
                      navigatingBackwards: false,
                    }}
                  >
                    <SketchForm
                      isSketchWorkflow={true}
                      logicRules={sketchClass.form?.logicRules || []}
                      onChange={(props, validationErrors) => {
                        const nameValue = nameElementId
                          ? props[nameElementId]
                          : undefined;
                        setName(nameValue);
                        setProperties(props);
                        setHasValidationErrors(validationErrors || !nameValue);
                      }}
                      formElements={formElements}
                      submissionAttempted={submissionAttempted}
                      startingProperties={startingProperties}
                      onSubmissionRequested={() => onSubmit()}
                    />
                  </FormElementLayoutContext.Provider>
                  {geometryErrors && <Warning>{geometryErrors}</Warning>}
                  {hasValidationErrors && submissionAttempted && (
                    <Warning>
                      <Trans ns="sketching">
                        Please complete your submission first.
                      </Trans>
                    </Warning>
                  )}
                  {createSketchState.error && (
                    <Warning level="error">
                      {createSketchState.error.message}
                    </Warning>
                  )}
                  {updateSketchState.error && (
                    <Warning level="error">
                      {updateSketchState.error.message}
                    </Warning>
                  )}
                </div>
                <div className="space-x-2 bg-gray-100 p-4 border-t">
                  <Button
                    onClick={handleCancel}
                    label={<Trans ns="sketching">Cancel</Trans>}
                  />
                  <Button
                    loading={
                      createSketchState.loading || updateSketchState.loading
                    }
                    disabled={
                      createSketchState.loading ||
                      updateSketchState.loading ||
                      (hasValidationErrors && submissionAttempted)
                    }
                    onClick={onSubmit}
                    label={<Trans ns="sketching">Submit</Trans>}
                    primary
                  />
                </div>
              </FilterInputServiceContextProvider>
            </>
          )}
        </motion.div>,
        document.body
      )}
      {mapContext.containerPortal &&
        createPortal(
          <div className="flex items-center justify-center w-screen h-full">
            <DigitizingTools
              preprocessingError={draw.preprocessingError || undefined}
              multiFeature={false}
              isSketchingWorkflow={true}
              selfIntersects={draw.selfIntersects}
              onRequestResetFeature={() => {
                draw.setCollection(EMPTY_FEATURE_COLLECTION);
                draw.create(false, true);
              }}
              onRequestFinishEditing={draw.actions.finishEditing}
              geometryType={sketchClass.geometryType}
              state={draw.digitizingState}
              onRequestSubmit={() => {}}
              onRequestDelete={() => {
                confirmDelete({
                  message: t("Delete Geometry"),
                  description: t(
                    "Are you sure you want to start over and redraw your sketch?"
                  ),
                  onDelete: async (value) => {
                    draw.setCollection(EMPTY_FEATURE_COLLECTION);
                    draw.create(false, true);
                    setFeature(null);
                  },
                });
              }}
              onRequestEdit={draw.actions.edit}
            >
              <ZoomToFeature
                map={mapContext.manager?.map!}
                isSmall={false}
                geometryType={sketchClass.geometryType}
              />
            </DigitizingTools>
          </div>,
          mapContext.containerPortal
        )}
    </>
  );
}

export default memo(SketchEditorModal);
