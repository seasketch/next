import { MapIcon, PlusCircleIcon, XIcon } from "@heroicons/react/outline";
import { colord } from "colord";
import { AnimatePresence, motion } from "framer-motion";
import {
  BBox,
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  LineString,
  Point,
  Polygon,
} from "geojson";
import { LngLatBoundsLike, Map, MapboxOptions, Style } from "mapbox-gl";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import BasemapMultiSelectInput from "../admin/surveys/BasemapMultiSelectInput";
import BoundsInput from "../admin/surveys/BoundsInput";
import useMapEssentials from "../admin/surveys/useMapEssentials";
import Button from "../components/Button";
import MapboxMap from "../components/MapboxMap";
import SketchGeometryTypeSelector, {
  Icons,
} from "../components/SketchGeometryTypeSelector";
import {
  Measure,
  ResetView,
  ShowCoordinates,
  ShowScaleBar,
  ZoomToFeature,
} from "../draw/MapSettingsPopup";
import useMapboxGLDraw, {
  DigitizingState,
  EMPTY_FEATURE_COLLECTION,
} from "../draw/useMapboxGLDraw";
import {
  FormElementFullDetailsFragment,
  FormElementLayout,
  SketchGeometryType,
} from "../generated/graphql";
import { FormElementLayoutContext } from "../surveys/SurveyAppLayout";
import SurveyButton from "../surveys/SurveyButton";
import DigitizingTools from "./DigitizingTools";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyMapPortal,
} from "./FormElement";
import fromMarkdown, { questionBodyFromMarkdown } from "./fromMarkdown";
import bbox from "@turf/bbox";
import DigitizingMiniMap from "./DigitizingMiniMap";
import useDebounce from "../useDebounce";
import MapPicker from "../components/MapPicker";
import useDialog from "../components/useDialog";
import { SketchClassDetailsFragment } from "../generated/queries";
import SketchForm from "../projects/Sketches/SketchForm";

export enum STAGES {
  DRAWING_INTRO,
  SHAPE_EDITOR,
  LIST_SHAPES,
  MOBILE_DRAW_FIRST_SHAPE,
  MOBILE_EDIT_PROPERTIES,
  MOBILE_MAP_FEATURES,
}

/**
 * Holds SketchForm related state. This is state that is "local" to the
 * input, and may not yet be hoisted up into props.value yet since it
 * may contain invalid form data that needs to be corrected by the user
 * before setting props.value using props.onChange.
 */
interface MultiSpatialInputLocalState {
  [id: number]: any;
  submissionAttempted: boolean;
  featureId?: string;
  hasValidationErrors?: boolean;
}

export type MultiSpatialInputProps = {
  body?: any;
  listShapesBody?: any;
  startingBounds?: BBox;
  basemaps?: number[];
};
type FC = FeatureCollection<Polygon, any>;
export type MultiSpatialInputValueType = {
  collection: FC;
};

const MultiSpatialInput: FormElementComponent<
  MultiSpatialInputProps,
  MultiSpatialInputValueType
> = (props) => {
  const { t } = useTranslation("admin:surveys");
  const context = useContext(FormElementLayoutContext);
  const { mapContext, basemaps, bounds } = useMapEssentials({
    bounds: props.componentSettings.startingBounds,
    filterBasemapIds: props.componentSettings.basemaps,
  });
  const [animating, setAnimating] = useState(false);
  const debouncedAnimating = useDebounce(animating, 10);
  const style = context.style;
  const { alert } = useDialog();

  // set default value of empty feature collection
  useEffect(() => {
    if (props.value === undefined) {
      props.onChange(
        {
          collection: {
            type: "FeatureCollection",
            features: [],
          },
        },
        props.isRequired ? true : false
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value, props.onChange]);

  const [, setMiniMap] = useState<Map | null>(null);
  const [miniMapStyle, setMiniMapStyle] = useState<Style>();

  const [geometryEditingState, setGeometryEditingState] = useState<{
    isNew: boolean;
    feature?: Feature<any>;
  } | null>(null);
  const [state, setState] = useState<MultiSpatialInputLocalState>({
    submissionAttempted: false,
  });

  const nameElementId = (props.sketchClass?.form?.formElements || []).find(
    (el) => el.typeId === "FeatureName"
  )?.id;

  const onChange = useCallback(
    (value: MultiSpatialInputValueType) => {
      props.onChange(
        value,
        props.isRequired ? value.collection.features.length === 0 : false
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.onChange, props.isRequired]
  );

  // Admin interface: clear value when the geometryType changes
  useEffect(() => {
    if (props.editable) {
      props.onChange(
        {
          collection: EMPTY_FEATURE_COLLECTION,
        },
        false
      );
      setCollection(EMPTY_FEATURE_COLLECTION);
      setTimeout(() => {
        create(true);
      }, 50);
      props.onRequestStageChange(STAGES.DRAWING_INTRO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sketchClass?.geometryType, props.editable]);

  const { confirm } = useDialog();

  const {
    digitizingState,
    disable,
    enable,
    create,
    actions,
    selfIntersects,
    selection,
    setCollection,
    resetFeature,
    dragTarget,
  } = useMapboxGLDraw(
    mapContext,
    props.sketchClass!.geometryType,
    props.value?.collection || EMPTY_FEATURE_COLLECTION,
    async (updatedFeature, hasKinks) => {
      // Handle deletion of all vertexes
      if (updatedFeature?.geometry.coordinates.length === 0) {
        if (
          await confirm(
            t("This will delete your entire shape. Are you sure?", {
              ns: "surveys",
            })
          )
        ) {
          // delete the entire shape
          const collection = removeFeatureFromValue(updatedFeature.id!);
          setFilteredCollection(collection);
          props.onRequestStageChange(STAGES.LIST_SHAPES);
        } else {
          setCollection(props.value?.collection || EMPTY_FEATURE_COLLECTION);
          props.onRequestStageChange(STAGES.LIST_SHAPES);
          return;
        }
      } else {
        if (!selection || geometryEditingState?.isNew) {
          if (hasKinks && digitizingState !== DigitizingState.UNFINISHED) {
            // Timeout is to prevent an infinite loop. I guess because digitizingState is set late?
            setTimeout(() => {
              actions.setUnfinished(updatedFeature!.id as string);
            }, 50);
          }
          setGeometryEditingState({
            isNew: true,
            feature: updatedFeature || undefined,
          });
        } else if (updatedFeature) {
          onChange({
            collection: updateFeatureInCollection(
              updatedFeature.id as string,
              {
                geometry: updatedFeature,
              },
              props.value?.collection || EMPTY_FEATURE_COLLECTION
            ),
          });
        }
        if (
          (props.stage === STAGES.DRAWING_INTRO ||
            props.stage === STAGES.MOBILE_DRAW_FIRST_SHAPE) &&
          digitizingState !== DigitizingState.UNFINISHED &&
          digitizingState !== DigitizingState.EDITING
        ) {
          if (style.isSmall) {
            if (hasKinks) {
              // Do nothing
              // Require explicit action to proceed to the next stage now
            } else {
              props.onRequestStageChange(STAGES.MOBILE_EDIT_PROPERTIES);
            }
          } else {
            props.onRequestStageChange(STAGES.SHAPE_EDITOR);
          }
        }
      }
    },
    () => {
      if (!selection) {
        setTimeout(() => {
          create(true);
        }, 50);
      } else {
        setGeometryEditingState({ isNew: false });
        props.onRequestStageChange(STAGES.LIST_SHAPES);
      }
    }
  );

  function setFilteredCollection(collection: FeatureCollection<Polygon, any>) {
    setCollection(collection);
  }

  useEffect(() => {
    if (
      (props.stage === STAGES.DRAWING_INTRO ||
        props.stage === STAGES.MOBILE_DRAW_FIRST_SHAPE) &&
      mapContext.manager?.map
    ) {
      create(true);
    }
    if (mapContext.manager?.map) {
      mapContext.manager.map.resize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.stage, mapContext.manager?.map]);

  useEffect(() => {
    if (state.featureId && selection?.id === state.featureId) {
      return;
    }
    if (
      state.featureId &&
      state.hasValidationErrors &&
      (!selection || selection.id !== state.featureId)
    ) {
      alert(t("Please fill in required fields", { ns: "surveys" }));
      actions.selectFeature(state.featureId);
      return;
    }
    if (selection && geometryEditingState?.isNew !== true) {
      if (state.featureId !== selection.id) {
        let properties = {};
        const feature = props.value!.collection.features.find(
          (f) => f.id === selection.id
        );
        properties = feature?.properties || {};
        setState(
          featurePropertiesToInputLocalState(selection.id as string, properties)
        );
        if (!style.isSmall) {
          if (props.stage === STAGES.LIST_SHAPES) {
            props.onRequestStageChange(STAGES.SHAPE_EDITOR);
          }
        }
      }
    } else if (geometryEditingState?.isNew !== true) {
      if (!style.isSmall) {
        if (props.stage === STAGES.SHAPE_EDITOR) {
          props.onRequestStageChange(STAGES.LIST_SHAPES);
        }
      }
      setState({
        submissionAttempted: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, alert]);

  useEffect(() => {
    if (mapContext.manager && basemaps && mapContext.styleHash.length > 0) {
      mapContext.manager
        .getComputedStyle()
        .then((style) => setMiniMapStyle(style.style));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapContext.manager, mapContext.styleHash]);

  function onClickSave() {
    if (selfIntersects) {
      return alert(
        t("Please fix problems with your shape first.", { ns: "surveys" })
      );
    }
    const errors = state.hasValidationErrors === true;
    if (errors) {
      // Check to see that all required fields are filled in and valid
      setState((prev) => ({
        ...prev,
        submissionAttempted: true,
      }));
      alert(t("Please fill in required fields", { ns: "surveys" }));
    } else if (
      // detect when no geometry edits have been attempted so there is no
      // need to complete the shape
      (geometryEditingState !== null && !geometryEditingState.feature) ||
      selfIntersects
    ) {
      return alert(
        t("Please complete your shape on the map", { ns: "surveys" })
      );
    } else {
      if (geometryEditingState?.isNew !== true) {
        // if (style.isSmall) {
        props.onRequestStageChange(STAGES.LIST_SHAPES);
        // }
        return actions.clearSelection();
      }
      if (geometryEditingState?.isNew === true) {
        const feature = { ...geometryEditingState.feature! };
        feature.properties = localStateToFeatureProperties(state);

        onChange({
          collection: {
            ...props.value!.collection,
            features: [...props.value!.collection.features, feature],
          },
        });
        props.onRequestStageChange(STAGES.LIST_SHAPES);
        setGeometryEditingState(null);
        setState({ submissionAttempted: false });
        actions.clearSelection();
        if (style.isSmall) {
          props.onRequestStageChange(STAGES.LIST_SHAPES);
        }
      }
    }
  }

  function onClickDoneMobile() {
    if (selfIntersects) {
      return alert(
        t("Please fix problems with your shape first.", { ns: "surveys" })
      );
    } else {
      props.onRequestStageChange(STAGES.MOBILE_EDIT_PROPERTIES);
      setTimeout(() => {
        if (mapContext.manager?.map && selection) {
          // mapContext.manager.map.panTo()
          mapContext.manager.map.resize();
          mapContext.manager.map.fitBounds(
            bbox(selection) as LngLatBoundsLike,
            { padding: 20 }
          );
        }
      }, 10);
    }
  }

  function removeFeatureFromValue(featureId: string | number) {
    if (!props.value) {
      throw new Error("props.value not set");
    }
    const collection = {
      ...props.value.collection,
      features: props.value.collection.features.filter(
        (f) => f.id !== featureId
      ),
    };
    onChange({
      ...props.value,
      collection,
    });
    return collection;
  }

  const mapInitOptions = useMemo(() => {
    return {
      logoPosition: "bottom-left",
      attributionControl: !style.isSmall,
      bounds: props.componentSettings.startingBounds,
    } as Partial<MapboxOptions>;
  }, [style.isSmall, props.componentSettings.startingBounds]);

  const onClickMapNonInteractive = useCallback(() => {
    // First, check to make sure that the form has valid input
    if (state.hasValidationErrors === true) {
      alert(t("Please fill in required fields", { ns: "surveys" }));
      return;
    }

    props.onRequestStageChange(STAGES.SHAPE_EDITOR);
    setTimeout(() => {
      if (mapContext.manager?.map && selection) {
        mapContext.manager.map.resize();
        mapContext.manager.map.fitBounds(bbox(selection) as LngLatBoundsLike, {
          padding: 50,
        });
      }
    }, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapContext.manager?.map,
    props.onRequestStageChange,
    selection,
    state.hasValidationErrors,
    t,
  ]);

  const popupActions = (
    <>
      <ResetView map={mapContext.manager?.map!} bounds={bounds} />
      {selection ||
      (props.value?.collection &&
        props.value.collection.features.length > 0) ? (
        <ZoomToFeature
          map={mapContext.manager?.map!}
          feature={
            selection
              ? selection
              : {
                  ...EMPTY_FEATURE_COLLECTION,
                  features: (
                    props.value?.collection || EMPTY_FEATURE_COLLECTION
                  ).features,
                }
          }
          isSmall={style.isSmall}
          geometryType={props.sketchClass!.geometryType}
          title={
            !selection ? t("Focus on shapes", { ns: "surveys" }) : undefined
          }
        />
      ) : null}
      <ShowScaleBar mapContext={mapContext} />
      <ShowCoordinates mapContext={mapContext} />

      <Measure />
    </>
  );

  return (
    <>
      <AnimatePresence
        initial={false}
        exitBeforeEnter={true}
        presenceAffectsLayout={false}
      >
        <motion.div
          onAnimationStart={() => setAnimating(true)}
          onAnimationComplete={() => setAnimating(false)}
          custom={{
            direction: context.navigatingBackwards,
            stage: props.stage,
            isSmall: style.isSmall,
          }}
          className="relative w-full"
          variants={{
            exit: ({
              direction,
              stage,
              isSmall,
            }: {
              direction: boolean;
              stage: STAGES;
              isSmall: boolean;
            }) => {
              return {
                opacity: 0,
                translateY: direction ? 100 : -100,
                position: "relative",
                transition:
                  isSmall && stage === STAGES.SHAPE_EDITOR
                    ? { duration: 0 }
                    : {
                        duration: 0.3,
                      },
              };
            },
            enter: ({ direction }: { direction: boolean; stage: STAGES }) => ({
              opacity: 0,
              translateY: direction ? -100 : 100,
              position: "relative",
            }),
            show: ({ direction }: { direction: boolean; stage: STAGES }) => ({
              opacity: 1,
              translateY: 0,
              position: "relative",
            }),
          }}
          transition={
            style.isSmall
              ? { duration: 0 }
              : {
                  duration: 0.3,
                }
          }
          key={props.stage}
          initial="enter"
          animate="show"
          exit="exit"
        >
          {(props.stage === STAGES.DRAWING_INTRO ||
            props.stage === STAGES.MOBILE_DRAW_FIRST_SHAPE) && (
            <>
              <FormElementBody
                formElementId={props.id}
                isInput={true}
                body={props.body}
                required={props.isRequired}
                editable={props.editable}
                alternateLanguageSettings={props.alternateLanguageSettings}
              />
              {style.isSmall && (
                <SurveyButton
                  label={t("Begin", { ns: "surveys" })}
                  className="pt-5"
                  onClick={() =>
                    props.onRequestStageChange(STAGES.MOBILE_DRAW_FIRST_SHAPE)
                  }
                />
              )}
              {!props.isRequired && !style.isSmall && (
                <SurveyButton
                  label={t("Skip Question", { ns: "surveys" })}
                  className="mt-10"
                  onClick={() => props.onRequestNext()}
                />
              )}
            </>
          )}
          {props.stage === STAGES.LIST_SHAPES && (
            <>
              <FormElementBody
                alternateLanguageSettings={props.alternateLanguageSettings}
                required={false}
                componentSettings={props.componentSettings}
                componentSettingName={"listShapesBody"}
                formElementId={props.id}
                isInput={false}
                body={
                  props.componentSettings.listShapesBody ||
                  MultiSpatialInput.defaultComponentSettings?.listShapesBody
                }
                editable={props.editable}
              />
              <div
                className="my-8"
                style={{
                  gridRowGap: "5px",
                  display: "grid",
                  grid: `
                  [row1-start] "shape" 1fr [row1-end]
                  / 1fr
                  `,
                }}
              >
                {(props.value?.collection?.features || []).map((feature) => (
                  <button
                    key={feature.id}
                    className="block ltr:rounded-l rtl:rounded-r w-full text-left rtl:text-right px-4 py-2 border-opacity-50 h-full"
                    style={{
                      backgroundColor: colord(style.backgroundColor)
                        .darken(0.025)
                        .toHex(),
                      // gridArea: "shape",
                    }}
                    onClick={() => {
                      if (style.isSmall) {
                        props.onRequestStageChange(
                          STAGES.MOBILE_EDIT_PROPERTIES
                        );
                        if (mapContext?.manager?.map) {
                          mapContext.manager.map.resize();
                          setTimeout(() => {
                            if (style.isSmall && mapContext?.manager?.map) {
                              mapContext.manager.map.fitBounds(
                                bbox(feature) as LngLatBoundsLike,
                                { padding: 20, animate: false }
                              );
                            }
                          }, 100);
                        }
                        actions.selectFeature(feature.id as string);
                      } else {
                        props.onRequestStageChange(STAGES.SHAPE_EDITOR);
                        actions.selectFeature(feature.id as string);
                      }
                    }}
                  >
                    {nameElementId ? feature.properties[nameElementId] : ""}
                  </button>
                ))}
              </div>
              <div className="space-y-2 sm:space-y-0 sm:space-x-2 sm:rtl:space-x-reverse sm:flex sm:w-full">
                <SurveyButton
                  className="w-full sm:w-auto block"
                  buttonClassName="w-full justify-center sm:w-auto text-base sm:text-sm"
                  label={
                    <span className="space-x-1 rtl:space-x-reverse flex">
                      <PlusCircleIcon className="w-5 h-5" />
                      <span>
                        <Trans ns="surveys">New Shape</Trans>
                      </span>
                    </span>
                  }
                  onClick={() => {
                    setState({ submissionAttempted: false });
                    setGeometryEditingState({
                      isNew: true,
                    });
                    if (style.isSmall) {
                      props.onRequestStageChange(
                        STAGES.MOBILE_DRAW_FIRST_SHAPE
                      );
                    } else {
                      props.onRequestStageChange(STAGES.SHAPE_EDITOR);
                    }
                    create(true);
                  }}
                />
                {style.isSmall && (
                  <SurveyButton
                    className="w-full sm:w-auto block"
                    buttonClassName="w-full justify-center sm:w-auto text-base sm:text-sm"
                    label={
                      <span className="space-x-1 rtl:space-x-reverse flex">
                        <MapIcon className="w-5 h-5" />
                        <span>
                          <Trans ns="surveys">View Map</Trans>
                        </span>
                      </span>
                    }
                    onClick={() =>
                      props.onRequestStageChange(STAGES.SHAPE_EDITOR)
                    }
                  />
                )}
                <SurveyButton
                  className="w-full sm:w-auto block"
                  buttonClassName="w-full justify-center sm:w-auto text-base sm:text-sm"
                  label={
                    <span className="space-x-1 rtl:space-x-reverse flex">
                      <span>
                        <Trans ns="surveys">Next Question</Trans>
                      </span>
                    </span>
                  }
                  onClick={() => {
                    props.onRequestNext();
                  }}
                />
              </div>
            </>
          )}
          {(props.stage === STAGES.SHAPE_EDITOR ||
            props.stage === STAGES.MOBILE_EDIT_PROPERTIES) && (
            <div className="py-5 space-y-2">
              <SketchForm
                key={state.featureId}
                formElements={
                  (props.sketchClass?.form?.formElements ||
                    []) as FormElementFullDetailsFragment[]
                }
                logicRules={props.sketchClass?.form?.logicRules || []}
                startingProperties={state}
                submissionAttempted={state.submissionAttempted}
                editable={props.editable}
                featureNumber={
                  ((props.value?.collection.features || []).length || 0) + 1
                }
                onSubmissionRequested={onClickSave}
                onChange={(newProperties, hasValidationErrors) => {
                  setState((prev) => {
                    return {
                      ...prev,
                      ...newProperties,
                      hasValidationErrors,
                    };
                  });
                  // If editing an existing shape and there are no validation errors,
                  // update the feature in the collection and props.value immediately
                  if (
                    !hasValidationErrors &&
                    state.featureId &&
                    geometryEditingState?.isNew !== true
                  ) {
                    onChange({
                      collection: updateFeatureInCollection(
                        state.featureId as string,
                        {
                          props: newProperties,
                        },
                        props.value?.collection || EMPTY_FEATURE_COLLECTION
                      ),
                    });
                  }
                }}
              />
              <div className="space-x-2 rtl:space-x-reverse">
                {geometryEditingState?.isNew && (
                  <SurveyButton
                    secondary={true}
                    label={<Trans ns="surveys">Cancel</Trans>}
                    onClick={async () => {
                      if (!geometryEditingState?.isNew) {
                        throw new Error(
                          "Editor is not in state geometryEditingState.isNew"
                        );
                      }
                      if (
                        !geometryEditingState.feature ||
                        (await confirm(
                          t("Are you sure you want to delete this shape?", {
                            ns: "surveys",
                          })
                        ))
                      ) {
                        if (geometryEditingState.feature) {
                          const collection = removeFeatureFromValue(
                            geometryEditingState.feature.id!
                          );
                          setFilteredCollection(collection);
                        }
                        setGeometryEditingState({ isNew: false });
                        props.onRequestStageChange(STAGES.LIST_SHAPES);
                        actions.finishEditing();
                        setFilteredCollection(props.value!.collection);
                      }
                    }}
                  />
                )}
                <SurveyButton
                  label={
                    geometryEditingState?.isNew
                      ? t("Save", { ns: "surveys" })
                      : t("Close", { ns: "surveys" })
                  }
                  onClick={onClickSave}
                />
                {!geometryEditingState?.isNew && style.isSmall && (
                  <>
                    <SurveyButton
                      label={t("Edit on Map", { ns: "surveys" })}
                      onClick={onClickMapNonInteractive}
                    />
                    <SurveyButton
                      label={t("Delete", { ns: "surveys" })}
                      onClick={async () => {
                        if (!selection?.id) {
                          throw new Error("No selection to delete");
                        }
                        if (!props.value) {
                          throw new Error(
                            "No collection to delete feature from"
                          );
                        }
                        if (
                          await confirm(
                            t("Are you sure you want to delete this shape?", {
                              ns: "surveys",
                            })
                          )
                        ) {
                          const collection = removeFeatureFromValue(
                            selection.id
                          );
                          setFilteredCollection(collection);
                          if (geometryEditingState?.isNew) {
                            setGeometryEditingState({ isNew: false });
                          }
                          props.onRequestStageChange(STAGES.LIST_SHAPES);
                        }
                      }}
                    />
                  </>
                )}
                {style.isSmall && !geometryEditingState?.isNew && (
                  <div
                    className={`rounded-full fixed top-4 right-2 z-10 shadow-lg bg-black bg-opacity-20`}
                    onClick={onClickSave}
                    // style={{ backgroundColor: style.secondaryColor }}
                  >
                    <XIcon className="w-10 h-10" />
                    {/* <XCircleIcon className="w-10 h-10" /> */}
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <SurveyMapPortal mapContext={mapContext}>
        <div
          className={`flex items-center justify-center w-full h-full ${
            props.stage === STAGES.MOBILE_EDIT_PROPERTIES
              ? "hide-all-gl-controls"
              : ""
          }`}
        >
          {props.stage !== STAGES.MOBILE_EDIT_PROPERTIES && (
            <DigitizingTools
              selfIntersects={selfIntersects}
              multiFeature={true}
              state={digitizingState}
              geometryType={props.sketchClass!.geometryType}
              onRequestEdit={actions.edit}
              onRequestFinishEditing={actions.finishEditing}
              createStateButtons={
                style.isSmall && (
                  <Button
                    label={t("Cancel", { ns: "surveys" })}
                    onClick={() => {
                      if (geometryEditingState?.feature) {
                        const collection = removeFeatureFromValue(
                          geometryEditingState.feature.id!
                        );
                        setFilteredCollection(collection);
                      }
                      setGeometryEditingState({ isNew: false });
                      props.onRequestStageChange(STAGES.LIST_SHAPES);
                      actions.finishEditing();
                      setFilteredCollection(props.value!.collection);
                    }}
                    buttonClassName={
                      style.isSmall
                        ? "py-3 flex-1 justify-center content-center text-base"
                        : ""
                    }
                  />
                )
              }
              unfinishedStateButtons={
                <Button
                  className="pointer-events-auto"
                  primary
                  label={t("Done", { ns: "surveys" })}
                  onClick={style.isSmall ? onClickDoneMobile : onClickSave}
                  buttonClassName={
                    style.isSmall
                      ? "py-3 flex-1 justify-center content-center text-base"
                      : ""
                  }
                />
              }
              noSelectionStateButtons={
                style.isSmall && !geometryEditingState?.isNew ? (
                  <>
                    <Button
                      className="pointer-events-auto"
                      label={<Trans ns="surveys">Back to List</Trans>}
                      onClick={() => {
                        props.onRequestStageChange(STAGES.LIST_SHAPES);
                      }}
                      buttonClassName={
                        style.isSmall
                          ? "py-3 flex-1 justify-center content-center text-base"
                          : ""
                      }
                    />
                    <Button
                      className="pointer-events-auto"
                      label={<Trans ns="surveys">New Shape</Trans>}
                      onClick={() => {
                        create(true);
                      }}
                      buttonClassName={
                        style.isSmall
                          ? "py-3 flex-1 justify-center content-center text-base"
                          : ""
                      }
                    />
                  </>
                ) : undefined
              }
              onRequestResetFeature={() => {
                if (!selection) {
                  throw new Error("No selection to perform feature reset");
                }
                if (geometryEditingState?.isNew) {
                  throw new Error(
                    "Reset cannot be performed if geometry is new"
                  );
                } else {
                  const goodFeature = props.value?.collection.features.find(
                    (f) => f.id === selection.id
                  );
                  if (goodFeature) {
                    resetFeature(goodFeature);
                  } else {
                    throw new Error(
                      "Cannot find feature with id " + selection.id
                    );
                  }
                }
              }}
              onRequestDelete={async () => {
                if (!selection?.id) {
                  throw new Error("No selection to delete");
                }
                if (!props.value) {
                  throw new Error("No collection to delete feature from");
                }
                if (
                  await confirm(
                    t("Are you sure you want to delete this shape?", {
                      ns: "surveys",
                    })
                  )
                ) {
                  const collection = removeFeatureFromValue(selection.id);
                  setFilteredCollection(collection);
                  if (props.stage === STAGES.MOBILE_DRAW_FIRST_SHAPE) {
                    create(true);
                  } else {
                    if (geometryEditingState?.isNew) {
                      setGeometryEditingState({ isNew: false });
                    }
                    props.onRequestStageChange(STAGES.LIST_SHAPES);
                  }
                }
              }}
              onRequestSubmit={() => {
                // if (props.value?.collection.features?.length) {
                // props.onSubmit();
                // }
              }}
            ></DigitizingTools>
          )}
          <MapboxMap
            key={`sap-map-${props.id}`}
            interactive={props.stage !== STAGES.MOBILE_EDIT_PROPERTIES}
            onClickNonInteractive={onClickMapNonInteractive}
            showNavigationControls
            hideDrawControls
            className="w-full h-full absolute top-0 bottom-0"
            initOptions={mapInitOptions}
            lazyLoadReady={!animating && !debouncedAnimating}
          />
          {props.stage !== STAGES.MOBILE_EDIT_PROPERTIES && (
            <MapPicker basemaps={basemaps}>{popupActions}</MapPicker>
          )}
          {miniMapStyle && mapContext.manager?.map && (
            <DigitizingMiniMap
              topologyErrors={selfIntersects}
              style={miniMapStyle}
              dragTarget={dragTarget}
              onLoad={setMiniMap}
            />
          )}
        </div>
      </SurveyMapPortal>

      <Admin
        map={mapContext.manager?.map}
        bounds={bounds}
        disableDraw={disable}
        enableDraw={enable}
        componentSettings={props.componentSettings}
        id={props.id}
        alternateLanguageSettings={props.alternateLanguageSettings}
        sketchClass={props.sketchClass!}
      />
    </>
  );
};

MultiSpatialInput.icon = ({ componentSettings, sketchClass }) => {
  const Icon = Icons[sketchClass?.geometryType || SketchGeometryType.Polygon];
  return (
    <div className="bg-red-500 w-full h-full font-bold text-center flex justify-center items-center  italic text-white relative">
      <Icon multi={true} className="text-white w-5 h-6" />
    </div>
  );
};

MultiSpatialInput.defaultComponentSettings = {
  // eslint-disable-next-line i18next/no-literal-string
  body: fromMarkdown(`
# Where have you seen this species?

Use the map to indicate locations. You can draw as many as necessary.
`),
  // eslint-disable-next-line i18next/no-literal-string
  listShapesBody: fromMarkdown(`
Listed below are the shapes you have drawn. You can draw additional shapes, or edit your previous submissions. 
`),
};

MultiSpatialInput.stages = STAGES;

MultiSpatialInput.getLayout = (
  stage,
  componentSettings,
  defaultLayout,
  isSmall
) => {
  if (isSmall) {
    if (
      stage === STAGES.MOBILE_DRAW_FIRST_SHAPE ||
      stage === STAGES.MOBILE_MAP_FEATURES ||
      stage === STAGES.SHAPE_EDITOR
    ) {
      return FormElementLayout.MapFullscreen;
    } else if (stage === STAGES.MOBILE_EDIT_PROPERTIES) {
      // Will need to add an option for a header map
      return FormElementLayout.MapTop;
    } else {
      return FormElementLayout.Top;
    }
  } else {
    if (defaultLayout === FormElementLayout.Right) {
      return FormElementLayout.MapSidebarRight;
    } else {
      return FormElementLayout.MapSidebarLeft;
    }
  }
};

function Admin(props: {
  id: number;
  componentSettings: MultiSpatialInputProps;
  alternateLanguageSettings: { [lang: string]: { [key: string]: any } };
  map?: Map;
  bounds: BBox;
  enableDraw: () => void;
  disableDraw: () => void;
  sketchClass: SketchClassDetailsFragment;
}) {
  const { t } = useTranslation("admin:surveys");
  return (
    <FormElementEditorPortal
      render={(
        updateBaseSetting,
        updateComponentSetting,
        updateSurveySettings,
        updateSketchClass
      ) => {
        return (
          <>
            <div>
              <h4 className="block text-sm font-medium leading-5 text-gray-800">
                {t("Geometry Type")}
              </h4>
              <p className="text-sm text-gray-500 mb-2 mt-1">
                <Trans ns="admin:surveys">
                  Geometry type cannot be changed after responses are collected
                </Trans>
              </p>
              <SketchGeometryTypeSelector
                value={props.sketchClass.geometryType}
                onChange={(geometryType) =>
                  updateSketchClass({
                    geometryType,
                  })
                }
                simpleFeatures
              />
            </div>
            <BoundsInput
              value={props.bounds}
              map={props.map}
              onBeforeInput={props.disableDraw}
              onAfterInput={props.enableDraw}
              onChange={updateComponentSetting(
                "startingBounds",
                props.componentSettings
              )}
            />
            <div className="-mx-3">
              <BasemapMultiSelectInput
                value={props.componentSettings.basemaps}
                onChange={updateComponentSetting(
                  "basemaps",
                  props.componentSettings
                )}
              />
            </div>
          </>
        );
      }}
    />
  );
}

function featurePropertiesToInputLocalState(
  featureId: string,
  props: GeoJsonProperties
): MultiSpatialInputLocalState {
  const state = {
    submissionAttempted: false,
    featureId,
    ...props,
  } as MultiSpatialInputLocalState;
  return state;
}

function localStateToFeatureProperties(state: MultiSpatialInputLocalState) {
  const { submissionAttempted, featureId, ...props } = state;
  return props;
}

MultiSpatialInput.hideNav = (
  componentSettings,
  isMobile,
  stage,
  isRequired
) => {
  if (
    stage === STAGES.MOBILE_EDIT_PROPERTIES ||
    stage === STAGES.SHAPE_EDITOR
  ) {
    return true;
  } else {
    return false;
  }
};

MultiSpatialInput.getInitialStage = (value, componentSettings) => {
  return value?.collection?.features?.length > 0
    ? STAGES.LIST_SHAPES
    : STAGES.DRAWING_INTRO;
};

// TODO: admin editing?
// MultiSpatialInput.adminValueInput = function (props) {
//   return <ChoiceAdminValueInput {...props} optionsProp="sectorOptions" />;
// };

MultiSpatialInput.label = <Trans ns="admin:surveys">Multiple Locations</Trans>;
MultiSpatialInput.description = (
  <Trans ns="admin:surveys">Collect spatial features with attributes</Trans>
);
// eslint-disable-next-line i18next/no-literal-string
MultiSpatialInput.defaultBody = questionBodyFromMarkdown(`
# Where have you seen this species?
`);

// TODO:
MultiSpatialInput.ResponseGridCell = function ({
  value,
  componentSettings,
  geometryType,
}) {
  return (
    <div className="space-x-1">
      <Trans
        ns="admin:surveys"
        i18nKey="NumLocations"
        count={
          // @ts-ignore
          value?.collection?.length || 0
        }
      >
        {{
          // @ts-ignore
          count: value?.collection?.length || 0,
        }}{" "}
        locations
      </Trans>
    </div>
  );
};

export default MultiSpatialInput;

/**
 * Updates GeoJSON features contained in props.value.collection. Be specifying
 * either props or geometry (or both), you can update just part of the feature
 * @param id
 * @param opts
 */
export function updateFeatureInCollection(
  id: string,
  opts: { props?: any; geometry?: Feature<Point | Polygon | LineString> },
  collection: FC
) {
  const features = collection.features;
  const idx = features.findIndex((f) => f.id === id);
  if (idx === -1) {
    console.warn(`Can't find feature with id ${id}`);
    return collection;
  } else {
    const feature = features[idx];
    return {
      ...collection,
      features: [
        ...features.slice(0, idx),
        {
          ...feature,
          ...(opts.geometry ? { geometry: opts.geometry.geometry } : {}),
          ...(opts.props ? { properties: opts.props } : {}),
        } as Feature<Polygon, any>,
        ...features.slice(idx + 1),
      ],
    };
  }
}
