import {
  CheckIcon,
  ExclamationIcon,
  MapIcon,
  ScaleIcon,
  XIcon,
} from "@heroicons/react/outline";
import { colord } from "colord";
import { AnimatePresence, motion } from "framer-motion";
import {
  BBox,
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Polygon,
} from "geojson";
import { LngLatBoundsLike, Map, MapboxOptions, Style } from "mapbox-gl";
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import BasemapMultiSelectInput from "../../admin/surveys/BasemapMultiSelectInput";
import BoundsInput from "../../admin/surveys/BoundsInput";
import useMapEssentials from "../../admin/surveys/useMapEssentials";
import Button from "../../components/Button";
import MapboxMap from "../../components/MapboxMap";
import { Icons } from "../../components/SketchGeometryTypeSelector";
import {
  BasemapControl,
  ResetView,
  ZoomToFeature,
} from "../../draw/DigitizingActionsPopup";
import useMapboxGLDraw, {
  DigitizingState,
  EMPTY_FEATURE_COLLECTION,
} from "../../draw/useMapboxGLDraw";
import {
  FormElementFullDetailsFragment,
  FormElementLayout,
  SketchGeometryType,
} from "../../generated/graphql";
import FormElementFactory from "../../surveys/FormElementFactory";
import { SurveyLayoutContext } from "../../surveys/SurveyAppLayout";
import SurveyButton from "../../surveys/SurveyButton";
import DigitizingTools from "../DigitizingTools";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  sortFormElements,
  SurveyMapPortal,
} from "../FormElement";
import FormElementOptionsInput, {
  FormElementOption,
} from "../FormElementOptionsInput";
import fromMarkdown, { questionBodyFromMarkdown } from "../fromMarkdown";
import OptionPicker from "../OptionPicker";
import PlusCircle from "@heroicons/react/outline/PlusCircleIcon";
import SectorNavigation from "./SectorNavigation";
import ChooseSectors from "./ChooseSectors";
import bbox from "@turf/bbox";
import { XCircleIcon } from "@heroicons/react/solid";
import DigitizingMiniMap from "../DigitizingMiniMap";

export enum STAGES {
  CHOOSE_SECTORS,
  SECTOR_NAVIGATION,
  DRAWING_INTRO,
  SHAPE_EDITOR,
  LIST_SHAPES,
  MOBILE_DRAW_FIRST_SHAPE,
  MOBILE_EDIT_PROPERTIES,
  MOBILE_MAP_FEATURES,
}

interface FormElementState {
  value: any;
  errors: boolean;
}

interface ResponseState {
  [id: number]: FormElementState;
  submissionAttempted: boolean;
  featureId?: string;
}

export type SpatialAccessPriorityProps = {
  sectorOptions?: FormElementOption[];
  beginBody?: any;
  navBody?: any;
  listShapesBody?: any;
  startingBounds?: BBox;
  basemaps?: number[];
};
type SectorFeatureProps = { sector: string; [key: string]: any };
type FC = FeatureCollection<Polygon, SectorFeatureProps>;
export type SAPValueType = {
  collection: FC;
  sectors: string[];
};
const SpatialAccessPriority: FormElementComponent<
  SpatialAccessPriorityProps,
  SAPValueType
> = (props) => {
  const { t } = useTranslation("admin:surveys");
  const context = useContext(SurveyLayoutContext);
  const { mapContext, basemaps, bounds } = useMapEssentials({
    bounds: props.componentSettings.startingBounds,
    filterBasemapIds: props.componentSettings.basemaps,
  });
  const style = context.style;
  const [sector, setSector] = useState<FormElementOption | null>(
    props.componentSettings.sectorOptions
      ? props.componentSettings.sectorOptions[0]
      : null
  );
  const [miniMap, setMiniMap] = useState<Map | null>(null);
  const [miniMapStyle, setMiniMapStyle] = useState<Style>();

  const [geometryEditingState, setGeometryEditingState] = useState<{
    isNew: boolean;
    feature?: Feature<any>;
  } | null>(null);
  const [responseState, setResponseState] = useState<ResponseState>({
    submissionAttempted: false,
  });

  const priorityElementId = (props.sketchClass?.form?.formElements || []).find(
    (el) => el.typeId === "SAPRange"
  )?.id;

  const nameElementId = (props.sketchClass?.form?.formElements || []).find(
    (el) => el.typeId === "FeatureName"
  )?.id;

  function onChange(value: SAPValueType) {
    let errors = !value.sectors || value.sectors.length < 1;
    if (!errors) {
      for (const sector of value.sectors) {
        const anyFeatures = (value.collection?.features || []).find(
          (f) => f.properties.sector === sector
        );
        if (!anyFeatures) {
          errors = true;
          break;
        }
      }
    }
    props.onChange(value, props.isRequired ? errors : false);
  }

  /**
   * Updates GeoJSON features contained in props.value.collection. Be specifying
   * either props or geometry (or both), you can update just part of the feature
   * @param id
   * @param opts
   */
  function updateFeatureValue(
    id: string,
    opts: { props?: SectorFeatureProps; geometry?: Feature<Polygon> }
  ) {
    const features = props.value!.collection.features;
    const idx = features.findIndex((f) => f.id === id);
    if (idx === -1) {
      throw new Error(`Can't find feature with id ${id}`);
    }
    const feature = features[idx];
    onChange({
      ...props.value!,
      collection: {
        ...props.value!.collection!,
        features: [
          ...features.slice(0, idx),
          {
            ...feature,
            ...(opts.geometry ? { geometry: opts.geometry.geometry } : {}),
            ...(opts.props ? { properties: opts.props } : {}),
          } as Feature<Polygon, SectorFeatureProps>,
          ...features.slice(idx + 1),
        ],
      },
    });
  }

  // Calls updateFeatureValue whenever the property editing form is modified,
  // as long as the feature is not new.
  useEffect(() => {
    if (responseState.featureId && geometryEditingState?.isNew !== true) {
      updateFeatureValue(responseState.featureId as string, {
        props: responseStateToProps(
          sector!.value || sector!.label,
          responseState
        ),
      });
    }
  }, [responseState, geometryEditingState?.isNew]);

  function updateResponseState(id: number) {
    return (value: any, errors: boolean) => {
      setResponseState((prev) => {
        return {
          ...prev,
          [id]: {
            ...prev[id],
            value,
            errors,
          },
        };
      });
    };
  }

  // formElements need to be sorted before display
  const formElements = useMemo<FormElementFullDetailsFragment[]>(() => {
    return sortFormElements(props.sketchClass!.form!.formElements!);
  }, [props.sketchClass!.form?.formElements]);

  /**
   * Filter features to just those that belong to the current stage
   */
  const filteredFeatures: FC = useMemo(() => {
    return props.value?.collection && sector
      ? {
          ...EMPTY_FEATURE_COLLECTION,
          features: props.value?.collection.features.filter(
            (f) => f.properties.sector === (sector.value || sector.label)
          ),
        }
      : (EMPTY_FEATURE_COLLECTION as FC);
  }, [props.value?.collection, sector]);

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
    mapContext.manager?.map,
    props.sketchClass!.geometryType,
    filteredFeatures,
    (updatedFeature) => {
      if (!selection || geometryEditingState?.isNew) {
        setGeometryEditingState({
          isNew: true,
          feature: updatedFeature || undefined,
        });
      } else if (updatedFeature) {
        updateFeatureValue(updatedFeature.id as string, {
          geometry: updatedFeature,
        });
      }
      if (
        props.stage === STAGES.DRAWING_INTRO ||
        props.stage === STAGES.MOBILE_DRAW_FIRST_SHAPE
      ) {
        if (style.isSmall) {
          if (!selfIntersects) {
            props.onRequestStageChange(STAGES.MOBILE_EDIT_PROPERTIES);
          }
        } else {
          props.onRequestStageChange(STAGES.SHAPE_EDITOR);
        }
      }
    }
  );

  function setFilteredCollection(
    collection: FeatureCollection<Polygon, { sector: string }>
  ) {
    if (!sector) {
      throw new Error("Sector not set");
    }
    const filtered = {
      ...EMPTY_FEATURE_COLLECTION,
      features: collection.features.filter(
        (f) => f.properties.sector === (sector.value || sector.label)
      ),
    };
    setCollection(filtered);
  }

  useEffect(() => {
    if (props.value?.collection) {
      // set gl-draw collection to just those shapes in the sector
      setFilteredCollection(props.value?.collection);
      // reset the view extent
      mapContext.manager?.map?.fitBounds(bounds as LngLatBoundsLike, {
        animate: false,
      });
    }
  }, [sector]);

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
  }, [props.stage, mapContext.manager?.map]);

  useEffect(() => {
    if (selection && geometryEditingState?.isNew !== true) {
      if (responseState.featureId !== selection.id) {
        let properties = {};
        const feature = props.value!.collection.features.find(
          (f) => f.id === selection.id
        );
        properties = feature?.properties || {};
        setResponseState(
          propsToResponseState(selection.id as string, properties)
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
      setResponseState({
        submissionAttempted: false,
      });
    }
  }, [selection]);

  useEffect(() => {
    if (
      props.value?.sectors.length &&
      props.componentSettings.sectorOptions?.length
    ) {
      setSector(
        props.componentSettings.sectorOptions.find(
          (s) => (s.value || s.label) === props.value!.sectors[0]
        )!
      );
    }
  }, [props.value?.sectors, props.componentSettings.sectorOptions]);

  async function updateMiniBasemap() {
    if (miniMap && mapContext.manager && basemaps) {
      const style = await mapContext.manager.getComputedStyle();
      setMiniMapStyle(style.style);
    }
  }

  useEffect(() => {
    if (mapContext.manager && basemaps) {
      mapContext.manager
        .getComputedStyle()
        .then((style) => setMiniMapStyle(style.style));
    }
  }, [mapContext.manager, basemaps]);

  function onClickSave() {
    if (selfIntersects) {
      return window.alert(t("Please fix problems with your shape first."));
    }
    if (geometryEditingState?.isNew !== true) {
      if (style.isSmall) {
        props.onRequestStageChange(STAGES.LIST_SHAPES);
      }
      return actions.clearSelection();
    }
    let errors = false;
    for (const element of formElements) {
      if (element.isRequired && element.type?.isInput) {
        errors =
          errors ||
          responseState[element.id] === undefined ||
          responseState[element.id].errors === true ||
          responseState[element.id].value === undefined;
      }
    }
    if (errors) {
      // Check to see that all required fields are filled in and valid
      setResponseState((prev) => ({
        ...prev,
        submissionAttempted: true,
      }));
      window.alert(t("Please fill in required fields"));
    } else if (!geometryEditingState?.feature || selfIntersects) {
      return window.alert(t("Please complete your shape on the map"));
    } else {
      if (!sector) {
        throw new Error("Sector not set");
      }
      const feature = { ...geometryEditingState.feature };
      feature.properties = {
        ...responseStateToProps(sector.value || sector.label, responseState),
      };

      onChange({
        sectors: props.value!.sectors,
        collection: {
          ...props.value!.collection,
          features: [
            // @ts-ignore
            ...props.value!.collection.features,
            // @ts-ignore
            feature,
          ],
        },
      });
      props.onRequestStageChange(STAGES.LIST_SHAPES);
      setGeometryEditingState(null);
      setResponseState({ submissionAttempted: false });
      actions.clearSelection();
      if (style.isSmall) {
        props.onRequestStageChange(STAGES.LIST_SHAPES);
      }
    }
  }

  function onClickDoneMobile() {
    if (selfIntersects) {
      return window.alert(t("Please fix problems with your shape first."));
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
    } as Partial<MapboxOptions>;
  }, [style.isSmall]);

  const onClickMapNonInteractive = useCallback(() => {
    props.onRequestStageChange(STAGES.SHAPE_EDITOR);
    setTimeout(() => {
      if (mapContext.manager?.map && selection) {
        mapContext.manager.map.resize();
        mapContext.manager.map.fitBounds(bbox(selection) as LngLatBoundsLike, {
          padding: 50,
        });
      }
    }, 10);
  }, [mapContext, props, selection]);

  return (
    <>
      <AnimatePresence
        initial={false}
        exitBeforeEnter={true}
        presenceAffectsLayout={false}
        // onExitComplete={() => {
        //   setBackwards(false);
        //   setFormElement((prev) => ({
        //     ...prev,
        //     exiting: undefined,
        //   }));
        // }}
      >
        <motion.div
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
          {props.stage !== STAGES.CHOOSE_SECTORS &&
            props.stage !== STAGES.SHAPE_EDITOR &&
            props.stage !== STAGES.SECTOR_NAVIGATION &&
            props.stage !== STAGES.MOBILE_EDIT_PROPERTIES && (
              <h4
                className={`font-bold text-xl pb-4 ${!style.isSmall && "pt-6"}`}
              >
                {sector?.label || "$SECTOR"}
              </h4>
            )}
          {props.stage === STAGES.CHOOSE_SECTORS && (
            <ChooseSectors
              {...props}
              setSector={setSector}
              updateValue={onChange}
            />
          )}
          {props.stage === STAGES.SECTOR_NAVIGATION && (
            <SectorNavigation {...props} setSector={setSector} />
          )}
          {(props.stage === STAGES.DRAWING_INTRO ||
            props.stage === STAGES.MOBILE_DRAW_FIRST_SHAPE) && (
            <>
              <FormElementBody
                componentSettingName={"beginBody"}
                componentSettings={props.componentSettings}
                required={false}
                formElementId={props.id}
                isInput={false}
                body={
                  props.componentSettings.beginBody ||
                  SpatialAccessPriority.defaultComponentSettings?.beginBody
                }
                editable={true}
              />
              {style.isSmall && (
                <SurveyButton
                  label={t("Begin")}
                  className="pt-5"
                  onClick={() =>
                    props.onRequestStageChange(STAGES.MOBILE_DRAW_FIRST_SHAPE)
                  }
                />
              )}
            </>
          )}
          {props.stage === STAGES.LIST_SHAPES && (
            <>
              <FormElementBody
                required={false}
                componentSettings={props.componentSettings}
                componentSettingName={"listShapesBody"}
                formElementId={props.id}
                isInput={false}
                body={
                  props.componentSettings.listShapesBody ||
                  SpatialAccessPriority.defaultComponentSettings?.listShapesBody
                }
                editable={true}
              />
              <div
                className="my-8"
                style={{
                  gridRowGap: "5px",
                  display: "grid",
                  grid: `
                  [row1-start] "shape slider" 1fr [row1-end]
                  / 3fr minmax(180px, 2fr)
                  `,
                }}
              >
                <div className="flex align-middle h-full">
                  {/* <Trans ns="surveys">Name</Trans> */}
                </div>
                <div className="flex align-middle h-full text-xs uppercase px-2">
                  <div className="flex-1">
                    <Trans ns="surveys">Low</Trans>
                  </div>
                  <div className="flex-1 text-center">
                    <Trans ns="surveys">Average</Trans>
                  </div>
                  <div className="flex-1 text-right">
                    <Trans ns="surveys">High</Trans>
                  </div>
                </div>

                {filteredFeatures.features.map((feature) => (
                  <React.Fragment key={feature.id}>
                    <button
                      className="block rounded-l w-full text-left px-4 py-2 border-opacity-50 h-full"
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
                          actions.selectFeature(feature.id as string);
                        }
                      }}
                    >
                      {nameElementId ? feature.properties[nameElementId] : ""}
                    </button>
                    <div
                      className="h-full align-middle flex rounded-r p-2 px-4"
                      style={{
                        // gridArea: "slider"
                        backgroundColor: colord(style.backgroundColor)
                          .darken(0.025)
                          .toHex(),
                      }}
                    >
                      <input
                        className="w-full SAPRange SAPRangeMini"
                        style={{ height: "10px" }}
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={feature.properties[priorityElementId!]}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          updateFeatureValue(feature.id as string, {
                            props: {
                              ...feature.properties,
                              // @ts-ignore
                              [priorityElementId]: value,
                            },
                          });
                        }}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div className="space-y-2 sm:space-y-0 sm:space-x-1 sm:flex sm:w-full">
                <SurveyButton
                  className="w-full sm:w-auto block"
                  buttonClassName="w-full justify-center sm:w-auto text-base sm:text-sm"
                  label={
                    <>
                      <PlusCircle className="w-5 h-5 mr-2" />
                      {t("New Shape")}
                    </>
                  }
                  onClick={() => {
                    setResponseState({ submissionAttempted: false });
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
                      <>
                        <MapIcon className="w-5 h-5 mr-2" />
                        {t("View Map")}
                      </>
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
                    <>
                      <CheckIcon className="w-5 h-5 mr-2" />
                      <Trans ns="surveys">Finish Sector</Trans>
                    </>
                  }
                  onClick={() => {
                    props.onRequestStageChange(STAGES.SECTOR_NAVIGATION);
                  }}
                />
              </div>
            </>
          )}
          {(props.stage === STAGES.SHAPE_EDITOR ||
            props.stage === STAGES.MOBILE_EDIT_PROPERTIES) && (
            <div className="py-5 space-y-2">
              {formElements.map((details, i) => {
                // const Component = components[details.typeId];
                return (
                  <FormElementFactory
                    key={`${details.id}`}
                    {...details}
                    onChange={updateResponseState(details.id)}
                    onSubmit={() => null}
                    isSpatial={false}
                    onRequestStageChange={() => null}
                    featureNumber={
                      ((
                        props.value?.collection.features.filter(
                          (f) =>
                            f.properties.sector ===
                            (sector?.value || sector?.label)
                        ) || []
                      ).length || 0) + 1
                    }
                    stage={0}
                    onRequestNext={() => null}
                    onRequestPrevious={() => null}
                    typeName={details.typeId}
                    value={responseState[details.id]?.value}
                    autoFocus={i === 0}
                    submissionAttempted={responseState.submissionAttempted}
                  />
                );
              })}
              <div className="space-x-2">
                {geometryEditingState?.isNew && (
                  <SurveyButton
                    secondary={true}
                    label={t("Cancel")}
                    onClick={() => {
                      if (!geometryEditingState?.isNew) {
                        throw new Error(
                          "Editor is not in state geometryEditingState.isNew"
                        );
                      }
                      if (
                        !geometryEditingState.feature ||
                        window.confirm(
                          t("Are you sure you want to delete this shape?")
                        )
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
                  label={geometryEditingState?.isNew ? t("Save") : t("Close")}
                  onClick={onClickSave}
                />
                {!geometryEditingState?.isNew && style.isSmall && (
                  <>
                    <SurveyButton
                      label={t("Edit on Map")}
                      onClick={onClickMapNonInteractive}
                    />
                    <SurveyButton
                      label={t("Delete")}
                      onClick={() => {
                        if (!selection?.id) {
                          throw new Error("No selection to delete");
                        }
                        if (!props.value) {
                          throw new Error(
                            "No collection to delete feature from"
                          );
                        }
                        if (
                          window.confirm(
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
                {style.isSmall && (
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
      {props.stage !== STAGES.CHOOSE_SECTORS && (
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
                      label={t("Cancel")}
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
                    label={t("Done")}
                    onClick={style.isSmall ? onClickDoneMobile : onClickSave}
                    buttonClassName={
                      style.isSmall
                        ? "py-3 flex-1 justify-center content-center text-base"
                        : ""
                    }
                  />
                }
                noSelectionStateButtons={
                  style.isSmall ? (
                    <>
                      <Button
                        className="pointer-events-auto"
                        label={t("Back to List")}
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
                        label={t("New Shape")}
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
                onRequestDelete={() => {
                  if (!selection?.id) {
                    throw new Error("No selection to delete");
                  }
                  if (!props.value) {
                    throw new Error("No collection to delete feature from");
                  }
                  if (
                    window.confirm(
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
                    }
                  }
                }}
                onRequestSubmit={() => {
                  // if (props.value?.collection.features?.length) {
                  // console.log("onSubmit");
                  // props.onSubmit();
                  // }
                }}
              >
                <ResetView map={mapContext.manager?.map!} bounds={bounds} />
                {selection || props.value?.collection ? (
                  <ZoomToFeature
                    map={mapContext.manager?.map!}
                    feature={
                      selection
                        ? selection
                        : {
                            ...EMPTY_FEATURE_COLLECTION,
                            features: (
                              props.value?.collection ||
                              EMPTY_FEATURE_COLLECTION
                            ).features.filter(
                              (f) =>
                                f.properties?.sector ===
                                (sector!.value || sector!.label)
                            ),
                          }
                    }
                    isSmall={style.isSmall}
                    geometryType={props.sketchClass!.geometryType}
                    title={!selection ? t("Focus on shapes") : undefined}
                  />
                ) : null}
                <BasemapControl
                  basemaps={basemaps}
                  afterChange={() => {
                    // updateMiniBasemap
                  }}
                />
              </DigitizingTools>
            )}
            <MapboxMap
              key={`sap-map-${props.id}`}
              interactive={props.stage !== STAGES.MOBILE_EDIT_PROPERTIES}
              onClickNonInteractive={onClickMapNonInteractive}
              showNavigationControls
              hideDrawControls
              className="w-full h-full absolute top-0 bottom-0"
              initOptions={mapInitOptions}
            />
            {miniMapStyle && mapContext.manager?.map && (
              <DigitizingMiniMap
                topologyErrors={selfIntersects}
                style={miniMapStyle}
                dragTarget={dragTarget}
                onLoad={(map) => setMiniMap(map)}
              />
            )}
          </div>
        </SurveyMapPortal>
      )}

      <Admin
        map={mapContext.manager?.map}
        bounds={bounds}
        disableDraw={disable}
        enableDraw={enable}
        componentSettings={props.componentSettings}
        id={props.id}
      />
    </>
  );
};

SpatialAccessPriority.label = (
  <Trans ns="admin:surveys">Spatial Access Priority</Trans>
);
SpatialAccessPriority.description = (
  <Trans ns="admin:surveys">Prioritize use by location</Trans>
);
// eslint-disable-next-line i18next/no-literal-string
SpatialAccessPriority.defaultBody = questionBodyFromMarkdown(`
# What sectors do you represent?

For each selection, you will be asked to draw and prioritize valued areas.
`);

SpatialAccessPriority.icon = ({ componentSettings, sketchClass }) => {
  const Icon = Icons[sketchClass?.geometryType || SketchGeometryType.Polygon];
  return (
    <div className="bg-red-500 w-full h-full font-bold text-center flex justify-center items-center  italic text-white relative">
      <ScaleIcon className="text-white w-5 h-6" />
      {/* <Icon multi={true} className="text-white w-5 h-6" /> */}
    </div>
  );
};

SpatialAccessPriority.defaultComponentSettings = {
  sectorOptions: [
    {
      label: "Commercial Fishing",
      value: "fishing_com",
    },
    {
      label: "Recreational Fishing",
      value: "fishing_rec",
    },
    {
      label: "Diving",
      value: "diving",
    },
  ],
  // eslint-disable-next-line i18next/no-literal-string
  beginBody: fromMarkdown(`
Use the map to indicate the most valued places for this activity. You can draw multiple areas and prioritize them individually.
`),
  // eslint-disable-next-line i18next/no-literal-string
  listShapesBody: fromMarkdown(`
Add as many shapes as necessary to represent valued areas for this activity, then adjust their relative priority below. 

These scores will be summed among all survey responses to create a heatmap of valued areas.
`),
  // eslint-disable-next-line i18next/no-literal-string
  navBody: fromMarkdown(`
# Your sectors
Please prioritize areas for each sector you represent.
`),
};

SpatialAccessPriority.stages = STAGES;

SpatialAccessPriority.getLayout = (
  stage,
  componentSettings,
  defaultLayout,
  isSmall
) => {
  if (stage === STAGES.CHOOSE_SECTORS || stage === STAGES.SECTOR_NAVIGATION) {
    // default to admin-setting, or setting from previous questions
    return defaultLayout;
  } else {
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
  }
};

function Admin(props: {
  id: number;
  componentSettings: SpatialAccessPriorityProps;
  map?: Map;
  bounds: BBox;
  enableDraw: () => void;
  disableDraw: () => void;
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
            <FormElementOptionsInput
              key={props.id}
              initialValue={props.componentSettings.sectorOptions || []}
              onChange={updateComponentSetting(
                "sectorOptions",
                props.componentSettings
              )}
              heading={t("Sector Options")}
              description={
                <Trans ns="admin:surveys">
                  List sector options below to collect data related to different
                  ocean uses. If no sectors are provided then the sectors
                  question will be skipped and only a single set of shapes will
                  be collected.
                </Trans>
              }
            />
            <BasemapMultiSelectInput
              value={props.componentSettings.basemaps}
              onChange={updateComponentSetting(
                "basemaps",
                props.componentSettings
              )}
            />
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
          </>
        );
      }}
    />
  );
}

function propsToResponseState(
  featureId: string,
  props: GeoJsonProperties
): ResponseState {
  const responseState = {
    submissionAttempted: false,
    featureId,
  } as ResponseState;
  for (const key in props) {
    responseState[parseInt(key)] = {
      value: props[key],
      errors: false,
    };
  }
  return responseState;
}

function responseStateToProps(sector: string, responseState: ResponseState) {
  const properties: { [key: number]: any; sector: string } = { sector };
  for (const key in responseState) {
    if (key !== "submissionAttempted") {
      properties[parseInt(key)] = responseState[key].value;
    }
  }
  return properties;
}

SpatialAccessPriority.hideNav = (componentSettings, isMobile, stage) => {
  if (stage === STAGES.CHOOSE_SECTORS || stage === STAGES.SECTOR_NAVIGATION) {
    return false;
  } else {
    return true;
  }
};

SpatialAccessPriority.getInitialStage = (value, componentSettings) => {
  if (value?.sectors?.length > 0) {
    return STAGES.SECTOR_NAVIGATION;
  } else {
    return STAGES.CHOOSE_SECTORS;
  }
};

export default SpatialAccessPriority;
