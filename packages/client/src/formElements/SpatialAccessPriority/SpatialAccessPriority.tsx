import {
  CheckIcon,
  MapIcon,
  PlusCircleIcon,
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
import {
  ResetView,
  ShowScaleBar,
  ZoomToFeature,
} from "../../draw/MapSettingsPopup";
import useMapboxGLDraw, {
  DigitizingState,
  EMPTY_FEATURE_COLLECTION,
} from "../../draw/useMapboxGLDraw";
import {
  FormElementDetailsFragment,
  FormElementFullDetailsFragment,
  FormElementLayout,
} from "../../generated/graphql";
import { FormElementLayoutContext } from "../../surveys/SurveyAppLayout";
import SurveyButton from "../../surveys/SurveyButton";
import DigitizingTools from "../DigitizingTools";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  FormLanguageContext,
  SurveyMapPortal,
  useLocalizedComponentSetting,
} from "../FormElement";
import FormElementOptionsInput, {
  FormElementOption,
} from "../FormElementOptionsInput";
import fromMarkdown, { questionBodyFromMarkdown } from "../fromMarkdown";
import SectorNavigation from "./SectorNavigation";
import ChooseSectors from "./ChooseSectors";
import bbox from "@turf/bbox";
import DigitizingMiniMap from "../DigitizingMiniMap";
import { FormEditorHeader } from "../../admin/surveys/SurveyFormEditor";
import InputBlock from "../../components/InputBlock";
import Switch from "../../components/Switch";
import { ChoiceAdminValueInput } from "../ComboBox";
import useDebounce from "../../useDebounce";
import Badge from "../../components/Badge";
import MapPicker from "../../components/MapPicker";
import useDialog from "../../components/useDialog";
import SketchForm from "../../projects/Sketches/SketchForm";
import { updateFeatureInCollection } from "../MultiSpatialInput";

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

interface SpatialAccessPriorityInputLocalState {
  [id: number]: FormElementState;
  submissionAttempted: boolean;
  featureId?: string;
  hasValidationErrors?: boolean;
}

interface ChildVisibilitySetting {
  /** If enabled, child will only be shown if in the list of valid sectors */
  enabled: boolean;
  /** Which sectors the child should be shown for, if enabled */
  sectors: string[];
}

export type SpatialAccessPriorityProps = {
  sectorOptions?: FormElementOption[];
  beginBody?: any;
  navBody?: any;
  listShapesBody?: any;
  startingBounds?: BBox;
  basemaps?: number[];
  childVisibilitySettings?: { [childId: number]: ChildVisibilitySetting };
  /**
   * Used to control formelements with a matching subordinateTo id. If the
   * selected sectors include those in the list, the subordinate element is
   * shown.
   */
  subordinateVisibilitySettings?: {
    [elementId: number]: string[];
  };
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
  const context = useContext(FormElementLayoutContext);
  const { mapContext, basemaps, bounds } = useMapEssentials({
    bounds: props.componentSettings.startingBounds,
    filterBasemapIds: props.componentSettings.basemaps,
  });
  const [animating, setAnimating] = useState(false);
  const debouncedAnimating = useDebounce(animating, 10);
  const style = context.style;
  const [sector, setSector] = useState<FormElementOption | null>(
    props.componentSettings.sectorOptions
      ? props.componentSettings.sectorOptions[0]
      : null
  );
  const { alert } = useDialog();

  const localizedSectors: FormElementOption[] = useLocalizedComponentSetting(
    "sectorOptions",
    props
  );

  const localizedSectorHeading = sector
    ? localizedSectors.find((s) => s.value === sector?.value)?.label
    : "";
  const [, setMiniMap] = useState<Map | null>(null);
  const [miniMapStyle, setMiniMapStyle] = useState<Style>();

  const [geometryEditingState, setGeometryEditingState] = useState<{
    isNew: boolean;
    feature?: Feature<any>;
  } | null>(null);
  const [state, setState] = useState<SpatialAccessPriorityInputLocalState>({
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
    mapContext.manager?.map,
    props.sketchClass!.geometryType,
    filteredFeatures,
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
          setCollection(filteredFeatures);
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
            sectors: props.value?.sectors || [],
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

  /**
   * Filter the features shown on the map to just those in the current sector
   */
  useEffect(() => {
    if (props.value?.collection) {
      // set gl-draw collection to just those shapes in the sector
      setFilteredCollection(props.value?.collection);
      // reset the view extent
      mapContext.manager?.map?.fitBounds(bounds as LngLatBoundsLike, {
        animate: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector]);

  /**
   * Watch stage and switch to drawing mode when appropriate. Resize the map
   * when starting to draw to ensure it renders tiles
   */
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

  // Set selected sector from props.value
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value?.sectors, props.componentSettings.sectorOptions]);

  /**
   * Update minimap style when basemap changes
   */
  useEffect(() => {
    if (mapContext.manager && basemaps) {
      mapContext.manager
        .getComputedStyle()
        .then((style) => setMiniMapStyle(style.style));
    }
  }, [mapContext.manager, basemaps]);

  // Why do this twice?
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
      if (!sector) {
        throw new Error("Sector not set");
      }
      if (geometryEditingState?.isNew !== true) {
        // if (style.isSmall) {
        props.onRequestStageChange(STAGES.LIST_SHAPES);
        // }
        return actions.clearSelection();
      }
      if (geometryEditingState?.isNew === true) {
        const feature = { ...geometryEditingState.feature! };
        feature.properties = {
          ...localStateToFeatureProperties(state),
          sector: sector.value || sector.label,
        };

        onChange({
          sectors: props.value!.sectors,
          collection: {
            ...props.value!.collection,
            features: [
              ...props.value!.collection.features,
              feature as Feature<Polygon, SectorFeatureProps>,
            ],
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
    } as Partial<MapboxOptions>;
  }, [style.isSmall]);

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
    mapContext,
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
                  ).features.filter(
                    (f) =>
                      f.properties?.sector === (sector!.value || sector!.label)
                  ),
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
    </>
  );

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
          {props.stage !== STAGES.CHOOSE_SECTORS &&
            props.stage !== STAGES.SHAPE_EDITOR &&
            props.stage !== STAGES.SECTOR_NAVIGATION &&
            props.stage !== STAGES.MOBILE_EDIT_PROPERTIES && (
              <h4
                className={`font-bold text-xl pb-4 ${!style.isSmall && "pt-6"}`}
              >
                {localizedSectorHeading || sector?.label || "$SECTOR"}
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
                alternateLanguageSettings={props.alternateLanguageSettings}
                componentSettingName={"beginBody"}
                componentSettings={props.componentSettings}
                required={false}
                formElementId={props.id}
                isInput={false}
                body={
                  props.componentSettings.beginBody ||
                  SpatialAccessPriority.defaultComponentSettings?.beginBody
                }
                editable={props.editable}
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
                  SpatialAccessPriority.defaultComponentSettings?.listShapesBody
                }
                editable={props.editable}
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
                  <div className="flex-1 text-right rtl:text-left">
                    <Trans ns="surveys">High</Trans>
                  </div>
                </div>

                {filteredFeatures.features.map((feature) => (
                  <React.Fragment key={feature.id}>
                    <button
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
                          actions.selectFeature(feature.id as string);
                        }
                      }}
                    >
                      {nameElementId ? feature.properties[nameElementId] : ""}
                    </button>
                    <div
                      className="h-full align-middle flex ltr:rounded-r rtl:rounded-l p-2 px-4"
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
                          onChange({
                            collection: updateFeatureInCollection(
                              feature.id as string,
                              {
                                props: {
                                  ...feature.properties,
                                  // @ts-ignore
                                  [priorityElementId]: value,
                                },
                              },
                              props.value?.collection ||
                                EMPTY_FEATURE_COLLECTION
                            ),
                            sectors: props.value?.sectors || [],
                          });
                        }}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div className="space-y-2 sm:space-y-0 sm:space-x-1 sm:rtl:space-x-reverse sm:flex sm:w-full">
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
                      <CheckIcon className="w-5 h-5" />
                      <span>
                        <Trans ns="surveys">Finish Sector</Trans>
                      </span>
                    </span>
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
              <SketchForm
                key={state.featureId}
                formElements={
                  (props.sketchClass?.form?.formElements || []).filter((el) =>
                    visibleInSector(el, props.componentSettings, sector)
                  ) as FormElementFullDetailsFragment[]
                }
                logicRules={props.sketchClass?.form?.logicRules || []}
                startingProperties={state}
                submissionAttempted={state.submissionAttempted}
                editable={props.editable}
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
                      sectors: props.value?.sectors || [],
                      collection: updateFeatureInCollection(
                        state.featureId as string,
                        {
                          props: {
                            ...newProperties,
                            sector: sector!.value || sector!.label,
                          },
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
                    }
                  }
                }}
                onRequestSubmit={() => {
                  // if (props.value?.collection.features?.length) {
                  // console.log("onSubmit");
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
              lazyLoadReady={
                !animating &&
                !debouncedAnimating &&
                (style.isSmall
                  ? props.stage === STAGES.MOBILE_DRAW_FIRST_SHAPE ||
                    props.stage === STAGES.MOBILE_EDIT_PROPERTIES ||
                    props.stage === STAGES.MOBILE_MAP_FEATURES ||
                    props.stage === STAGES.SHAPE_EDITOR
                  : props.stage !== STAGES.CHOOSE_SECTORS &&
                    props.stage !== STAGES.SECTOR_NAVIGATION)
              }
            />
            {props.stage !== STAGES.MOBILE_EDIT_PROPERTIES && (
              <MapPicker basemaps={basemaps}>{popupActions}</MapPicker>
            )}
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
        alternateLanguageSettings={props.alternateLanguageSettings}
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
  alternateLanguageSettings: { [lang: string]: { [key: string]: any } };
  map?: Map;
  bounds: BBox;
  enableDraw: () => void;
  disableDraw: () => void;
}) {
  const { t } = useTranslation("admin:surveys");
  const context = useContext(FormLanguageContext);
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
              prop="sectorOptions"
              componentSettings={props.componentSettings}
              alternateLanguageSettings={props.alternateLanguageSettings}
              onChange={updateComponentSetting(
                "sectorOptions",
                props.componentSettings,
                context?.lang.code,
                props.alternateLanguageSettings
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
): SpatialAccessPriorityInputLocalState {
  const state = {
    submissionAttempted: false,
    featureId,
    ...props,
  } as SpatialAccessPriorityInputLocalState;
  return state;
}

function localStateToFeatureProperties(
  state: SpatialAccessPriorityInputLocalState
) {
  const { submissionAttempted, featureId, ...props } = state;
  return props;
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

function ChildVisibilitySettings({
  childVisibilitySettings,
  updateComponentSetting,
  componentSettings,
  childId,
}: {
  childId: number;
  childVisibilitySettings: ChildVisibilitySetting;
  componentSettings: SpatialAccessPriorityProps;
  updateComponentSetting: (
    setting: string,

    currentSettings: any,
    language?: string | undefined,
    alternateLanguageSettings?: any
  ) => (value: any) => void;
}) {
  return (
    <>
      <FormEditorHeader className="mt-4">
        <Trans ns="admin:surveys">Sector Logic</Trans>
      </FormEditorHeader>
      <div className="p-3">
        <InputBlock
          labelType="small"
          title={<Trans ns="admin:surveys">Display based on sector</Trans>}
          input={
            <Switch
              isToggled={childVisibilitySettings.enabled}
              onClick={updateComponentSetting(
                `childVisibilitySettings.${childId}.enabled`,
                unArrayifySettings(componentSettings)
              )}
            />
          }
        />
        <p className="text-gray-500 text-sm">
          <Trans ns="admin:surveys">
            If enabled, this field will only be presented as an option for
            shapes representing the following sectors.
          </Trans>
        </p>
        <div className="mt-4">
          {(componentSettings.sectorOptions || []).map((s) => (
            <InputBlock
              key={s.label}
              labelType="small"
              input={
                <Switch
                  disabled={!childVisibilitySettings.enabled}
                  isToggled={
                    (childVisibilitySettings.sectors || []).indexOf(
                      s.value || s.label
                    ) !== -1
                  }
                  onClick={(toggled) => {
                    const sectors = childVisibilitySettings.sectors || [];
                    updateComponentSetting(
                      `childVisibilitySettings.${childId}.sectors`,
                      unArrayifySettings(componentSettings)
                    )(
                      toggled
                        ? [...sectors, s.value || s.label]
                        : sectors.filter((sec) => sec !== (s.value || s.label))
                    );
                  }}
                />
              }
              title={
                <span
                  className={
                    childVisibilitySettings.enabled ? "" : "text-gray-500"
                  }
                >
                  {s.label || s.value}
                </span>
              }
            />
          ))}
        </div>
      </div>
    </>
  );
}

type SubordinateVisibilitySetting = string[];

function SubordinateVisibilitySettings({
  visibilitySettings,
  updateComponentSetting,
  componentSettings,
  childId,
}: {
  childId: number;
  visibilitySettings: SubordinateVisibilitySetting;
  componentSettings: SpatialAccessPriorityProps;
  updateComponentSetting: (
    setting: string,

    currentSettings: any,
    language?: string | undefined,
    alternateLanguageSettings?: any
  ) => (value: any) => void;
}) {
  return (
    <>
      <FormEditorHeader className="mt-4">
        <Trans ns="admin:surveys">Sector-Specific Visibility</Trans>
      </FormEditorHeader>
      <div className="p-3">
        <p className="text-gray-500 text-sm">
          <Trans ns="admin:surveys">
            This question will only be shown for the following sectors
          </Trans>
        </p>
        <div className="mt-4">
          {(componentSettings.sectorOptions || []).map((s) => (
            <InputBlock
              key={s.label}
              labelType="small"
              input={
                <Switch
                  isToggled={
                    (visibilitySettings || []).indexOf(s.value || s.label) !==
                    -1
                  }
                  onClick={(toggled) => {
                    const sectors = visibilitySettings || [];
                    updateComponentSetting(
                      `subordinateVisibilitySettings.${childId}`,
                      unArrayifySettings(componentSettings)
                    )(
                      toggled
                        ? [...visibilitySettings, s.value || s.label]
                        : sectors.filter((sec) => sec !== (s.value || s.label))
                    );
                  }}
                />
              }
              title={s.label || s.value}
            />
          ))}
        </div>
      </div>
    </>
  );
}

// In-situ fix for data corrupted by https://github.com/seasketch/next/issues/339
// Using lodash.set was assuming updating a value like childVisibilitySettings.72 should create or update
// an array, setting array index 72 to a value. Instead, we want it to treat childVisibilitySettings as an
// object. This is fixed by using lodash.setWith, but current data needs to be fixed by this function.
function unArrayifySettings(settings?: SpatialAccessPriorityProps) {
  if (
    settings &&
    (Array.isArray(settings.childVisibilitySettings) ||
      Array.isArray(settings.subordinateVisibilitySettings))
  ) {
    const newSettings = { ...settings };
    if (
      newSettings.childVisibilitySettings &&
      Array.isArray(newSettings.childVisibilitySettings)
    ) {
      newSettings.childVisibilitySettings = unArrayify(
        newSettings.childVisibilitySettings
      );
    }
    if (
      newSettings.subordinateVisibilitySettings &&
      Array.isArray(newSettings.subordinateVisibilitySettings)
    ) {
      newSettings.subordinateVisibilitySettings = unArrayify(
        newSettings.subordinateVisibilitySettings
      );
    }
    return newSettings;
  } else if (
    Object.values(settings?.subordinateVisibilitySettings || {}).length ||
    Object.values(settings?.childVisibilitySettings || {}).length
  ) {
    const newSettings = { ...settings };
    const visibilitySettings = { ...newSettings.subordinateVisibilitySettings };
    const childVisibilitySettings = { ...newSettings.childVisibilitySettings };
    for (const key in visibilitySettings) {
      if (visibilitySettings[key] === null) {
        delete visibilitySettings[key];
      }
    }
    for (const key in childVisibilitySettings) {
      if (childVisibilitySettings[key] === null) {
        delete childVisibilitySettings[key];
      }
    }
    newSettings.subordinateVisibilitySettings = visibilitySettings;
    newSettings.childVisibilitySettings = childVisibilitySettings;
    return newSettings;
  } else {
    return settings;
  }
}

function unArrayify(values: (number | null | undefined)[]) {
  const pojo: { [key: number]: any } = {};
  for (var i = 0; i < values.length; i++) {
    if (values[i] !== null && values[i] !== undefined) {
      pojo[i] = values[i];
    }
  }
  return pojo;
}

SpatialAccessPriority.ChildOptions = (props) => {
  if (
    props.child.typeId === "FeatureName" ||
    props.child.typeId === "SAPRange"
  ) {
    return null;
  }

  const childVisibilitySettings = (props.componentSettings
    ?.childVisibilitySettings || {})[props.child.id] || {
    enabled: false,
    sectors: [],
  };

  const subordinateVisibilitySettings =
    (props.componentSettings?.subordinateVisibilitySettings || {})[
      props.child.id
    ] || [];

  if (!props.child.subordinateTo) {
    return (
      <ChildVisibilitySettings
        key={props.child.id}
        childId={props.child.id}
        componentSettings={props.componentSettings}
        childVisibilitySettings={childVisibilitySettings}
        updateComponentSetting={props.updateComponentSetting}
      />
    );
  } else {
    return (
      <SubordinateVisibilitySettings
        key={props.child.id}
        childId={props.child.id}
        componentSettings={props.componentSettings}
        visibilitySettings={subordinateVisibilitySettings}
        updateComponentSetting={props.updateComponentSetting}
      />
    );
  }
};

function visibleInSector(
  el: Pick<FormElementDetailsFragment, "id">,
  componentSettings: Pick<
    SpatialAccessPriorityProps,
    "childVisibilitySettings"
  >,
  sector?: { label: string; value?: string } | null
) {
  if (
    componentSettings.childVisibilitySettings &&
    componentSettings.childVisibilitySettings[el.id]
  ) {
    const childVisibilitySettings =
      componentSettings.childVisibilitySettings[el.id];
    if (childVisibilitySettings.enabled) {
      if (
        sector &&
        (childVisibilitySettings.sectors || []).indexOf(
          sector.value || sector.label
        ) !== -1
      ) {
        return true;
      }
      return false;
    } else {
      return true;
    }
  } else {
    return true;
  }
}

SpatialAccessPriority.adminValueInput = function (props) {
  return <ChoiceAdminValueInput {...props} optionsProp="sectorOptions" />;
};

SpatialAccessPriority.ResponseGridCell = function ({
  value,
  componentSettings,
}) {
  return (
    <div className="space-x-1">
      {(componentSettings.sectorOptions || [])
        .filter(
          (o) =>
            ((value || {}).sectors || []).indexOf(o.value || o.label) !== -1
        )
        .map((option) => (
          <Badge key={option.value || option.label} variant="error">
            {option.label}
          </Badge>
        ))}
    </div>
  );
};

export default SpatialAccessPriority;
