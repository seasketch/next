import { ExclamationIcon, ScaleIcon } from "@heroicons/react/outline";
import {
  LocationMarkerIcon,
  MapIcon,
  PlusCircleIcon,
} from "@heroicons/react/solid";
import { AnimatePresence, motion } from "framer-motion";
import {
  BBox,
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Polygon,
} from "geojson";
import { LngLatBoundsLike, Map } from "mapbox-gl";
import { features } from "process";
import { useContext, useEffect, useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import { components } from ".";
import BasemapMultiSelectInput from "../admin/surveys/BasemapMultiSelectInput";
import BoundsInput from "../admin/surveys/BoundsInput";
import useMapEssentials from "../admin/surveys/useMapEssentials";
import Button from "../components/Button";
import MapboxMap from "../components/MapboxMap";
import SketchGeometryTypeSelector, {
  Icons,
} from "../components/SketchGeometryTypeSelector";
import { useMapContext } from "../dataLayers/MapContextManager";
import {
  BasemapControl,
  ResetView,
  ZoomToFeature,
} from "../draw/DigitizingActionsPopup";
import useMapboxGLDraw, {
  DigitizingState,
  EMPTY_FEATURE_COLLECTION,
} from "../draw/useMapboxGLDraw";
import {
  FormElementFullDetailsFragment,
  FormElementLayout,
  SketchGeometryType,
} from "../generated/graphql";
import { SurveyStyleContext } from "../surveys/appearance";
import FormElementFactory from "../surveys/FormElementFactory";
import { SurveyLayoutContext } from "../surveys/SurveyAppLayout";
import SurveyButton from "../surveys/SurveyButton";
import DigitizingTools from "./DigitizingTools";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  sortFormElements,
  SurveyMapPortal,
  SurveyMapPortalContext,
} from "./FormElement";
import FormElementOptionsInput, {
  FormElementOption,
} from "./FormElementOptionsInput";
import fromMarkdown, { questionBodyFromMarkdown } from "./fromMarkdown";
import OptionPicker from "./OptionPicker";
// import SpatialInputMap, { defaultStartingBounds } from "./SpatialInputMap";

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
  listShapesBody?: any;
  startingBounds?: BBox;
  basemaps?: number[];
};
type SectorFeatureProps = { sector: string; [key: string]: any };
type FC = FeatureCollection<Polygon, SectorFeatureProps>;
const SpatialAccessPriority: FormElementComponent<
  SpatialAccessPriorityProps,
  {
    collection: FC;
    sectors: string[];
  }
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

  const [geometryEditingState, setGeometryEditingState] = useState<{
    isNew: boolean;
    feature?: Feature<any>;
  } | null>(null);
  const [responseState, setResponseState] = useState<ResponseState>({
    submissionAttempted: false,
  });

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
    console.log("extending feature", feature.properties, opts);
    props.onChange(
      {
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
      },
      false
    );
  }

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

  useEffect(() => {
    if (responseState.featureId && geometryEditingState?.isNew !== true) {
      updateFeatureValue(responseState.featureId as string, {
        props: responseStateToProps(
          sector!.value || sector!.label,
          responseState
        ),
      });
    }
  }, [responseState]);

  const formElements = useMemo<FormElementFullDetailsFragment[]>(() => {
    return sortFormElements(props.sketchClass!.form!.formElements!);
  }, [props.sketchClass!.form?.formElements]);

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
    kinks,
    selection,
  } = useMapboxGLDraw(
    mapContext.manager?.map,
    props.sketchClass!.geometryType,
    // null,
    filteredFeatures,
    (newVal) => {
      if (
        digitizingState === DigitizingState.UNFINISHED ||
        digitizingState === DigitizingState.CREATE
      ) {
        setGeometryEditingState((prev) => {
          if (prev) {
            return {
              ...prev,
              feature: newVal || undefined,
            };
          } else {
            return {
              isNew: false,
              feature: newVal || undefined,
            };
          }
        });
      } else if (newVal) {
        updateFeatureValue(newVal.id as string, {
          geometry: newVal,
        });
      }
      if (props.stage === STAGES.DRAWING_INTRO) {
        props.onRequestStageChange(STAGES.SHAPE_EDITOR);
      }
    }
  );

  useEffect(() => {
    if (
      (props.stage === STAGES.DRAWING_INTRO ||
        props.stage === STAGES.MOBILE_DRAW_FIRST_SHAPE) &&
      mapContext.manager?.map
    ) {
      // setTimeout(() => {
      create(true);
      // }, 200);
    }
    if (mapContext.manager?.map) {
      mapContext.manager.map.resize();
    }
  }, [props.stage, mapContext.manager?.map]);

  useEffect(() => {
    if (selection) {
      if (responseState.featureId !== selection.id) {
        let properties = {};
        if (geometryEditingState?.isNew !== true) {
          const feature = props.value!.collection.features.find(
            (f) => f.id === selection.id
          );
          properties = feature?.properties || {};
        }
        setResponseState(
          propsToResponseState(selection.id as string, properties)
        );
        if (props.stage === STAGES.LIST_SHAPES) {
          props.onRequestStageChange(STAGES.SHAPE_EDITOR);
        }
      }
    } else {
      if (props.stage === STAGES.SHAPE_EDITOR) {
        props.onRequestStageChange(STAGES.LIST_SHAPES);
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

  return (
    <>
      <AnimatePresence
        initial={false}
        exitBeforeEnter={true}
        custom={context.navigatingBackwards}
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
          custom={context.navigatingBackwards}
          className="relative"
          variants={{
            exit: (direction: boolean) => ({
              opacity: 0,
              translateY: direction ? 100 : -100,
              position: "relative",
            }),
            enter: (direction: boolean) => ({
              opacity: 0,
              translateY: direction ? -100 : 100,
              position: "relative",
            }),
            show: () => ({
              opacity: 1,
              translateY: 0,
              position: "relative",
            }),
          }}
          transition={{
            duration: 0.3,
          }}
          key={props.stage}
          initial="enter"
          animate="show"
          exit="exit"
        >
          {props.stage !== STAGES.CHOOSE_SECTORS &&
            props.stage !== STAGES.SHAPE_EDITOR && (
              <h4
                className={`font-bold text-xl pb-4 ${!style.isSmall && "pt-6"}`}
              >
                {sector?.label || "$SECTOR"}
              </h4>
            )}
          {props.stage === STAGES.CHOOSE_SECTORS && (
            <div className="mb-5">
              <FormElementBody
                required={props.isRequired}
                formElementId={props.id}
                isInput={true}
                body={props.body}
                editable={props.editable}
              />
              {!props.componentSettings.sectorOptions?.length && (
                <div className="rounded p-4 mt-4 bg-yellow-400 bg-opacity-60 text-black text-sm">
                  <ExclamationIcon className="w-6 h-6 inline mr-2" />
                  <Trans ns="admin:surveys">
                    This stage will be skipped if no sector options are
                    specified.
                  </Trans>
                </div>
              )}
              <OptionPicker
                options={props.componentSettings.sectorOptions || []}
                multi={true}
                onChange={(sectors) => {
                  props.onChange(
                    {
                      collection:
                        props.value?.collection ||
                        (EMPTY_FEATURE_COLLECTION as FC),
                      sectors,
                    },
                    false
                  );
                }}
                value={props.value?.sectors || []}
              />
              <SurveyButton
                className={`transition-opacity duration-300 ${
                  !props.value?.sectors?.length ? "opacity-0" : "opacity-100"
                }`}
                disabled={!props.value?.sectors?.length}
                label={t("Next")}
                onClick={() => {
                  if (!props.value) {
                    throw new Error("No sectors selected");
                  }
                  const nextSector = props.componentSettings.sectorOptions!.find(
                    (s) => (s.value || s.label) === props.value!.sectors[0]
                  );
                  if (!nextSector) {
                    throw new Error(
                      `Cannot find next sector ${props.value.sectors[0]}`
                    );
                  }
                  setSector(nextSector);
                  const hasFeatures = !!props.value!.collection.features.find(
                    (f) =>
                      f.properties.sector ===
                      (nextSector.value || nextSector.label)
                  );
                  if (hasFeatures) {
                    props.onRequestStageChange(STAGES.LIST_SHAPES);
                  } else {
                    props.onRequestStageChange(STAGES.DRAWING_INTRO);
                  }
                }}
              />
            </div>
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
              <ul className="p-5">
                {filteredFeatures.features.map((feature) => (
                  <li className="list-disc" key={feature.id}>
                    {
                      feature.properties[
                        formElements.find((el) => el.typeId === "FeatureName")!
                          .id
                      ]
                    }
                  </li>
                ))}
              </ul>
              <SurveyButton
                label={t("New Shape")}
                onClick={() => {
                  setResponseState({ submissionAttempted: false });
                  props.onRequestStageChange(STAGES.SHAPE_EDITOR);
                  create(true);
                }}
              />
            </>
          )}
          {props.stage === STAGES.SHAPE_EDITOR && (
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
                      (props.value?.collection.features.length || 0) + 1
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
              <SurveyButton
                label={t("Save")}
                onClick={() => {
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
                  } else if (!geometryEditingState?.feature) {
                    setResponseState((prev) => ({
                      ...prev,
                      submissionAttempted: true,
                    }));
                    window.alert(
                      t("You must finish drawing a shape on the map first.")
                    );
                  } else {
                    if (!sector) {
                      throw new Error("Sector not set");
                    }
                    const feature = { ...geometryEditingState.feature };
                    feature.properties = {
                      ...responseStateToProps(
                        sector.value || sector.label,
                        responseState
                      ),
                    };

                    props.onChange(
                      {
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
                      },
                      false
                    );
                    props.onRequestStageChange(STAGES.LIST_SHAPES);
                    setGeometryEditingState(null);
                    setResponseState({ submissionAttempted: false });
                  }
                }}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {props.stage !== STAGES.CHOOSE_SECTORS && (
        <SurveyMapPortal mapContext={mapContext}>
          <div className="flex items-center justify-center w-full h-full">
            <DigitizingTools
              multiFeature={true}
              state={digitizingState}
              geometryType={props.sketchClass!.geometryType}
              topologyErrors={kinks.features.length > 0}
              onRequestEdit={actions.edit}
              onRequestFinishEditing={actions.finishEditing}
              onRequestDelete={() => {
                if (
                  window.confirm(
                    t("Are you sure you want to delete this shape?", {
                      ns: "surveys",
                    })
                  )
                ) {
                  actions.reset();
                }
              }}
              onRequestSubmit={() => {
                // if (props.value?.collection.features?.length) {
                console.log("onSubmit");
                // props.onSubmit();
                // }
              }}
            >
              {/* <PreviousQuestion
                phoneOnly={true}
                onClick={props.onRequestPrevious}
              />
              <NextQuestion
                phoneOnly={true}
                onClick={props.onRequestNext}
                disabled={
                  props.isRequired && !props.value?.collection.features.length
                }
              /> */}
              <ResetView map={mapContext.manager?.map!} bounds={bounds} />
              {/* <ZoomToFeature
                map={mapContext.manager?.map!}
                feature={props.value?.collection.features[0]}
                isSmall={style.isSmall}
                geometryType={props.sketchClass!.geometryType}
              /> */}
              <BasemapControl
                basemaps={basemaps}
                afterChange={() => {
                  // updateMiniBasemap
                }}
              />
            </DigitizingTools>
            <MapboxMap
              hideDrawControls
              className="w-full h-full absolute top-0 bottom-0"
              initOptions={{
                logoPosition: "bottom-left",
                attributionControl: !style.isSmall,
              }}
            />
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
};

enum STAGES {
  CHOOSE_SECTORS,
  DRAWING_INTRO,
  SHAPE_EDITOR,
  LIST_SHAPES,
  MOBILE_DRAW_FIRST_SHAPE,
  MOBILE_EDIT_PROPERTIES,
  MOBILE_MAP_FEATURES,
}

SpatialAccessPriority.stages = STAGES;

SpatialAccessPriority.getLayout = (
  stage,
  componentSettings,
  defaultLayout,
  isSmall
) => {
  if (stage === STAGES.CHOOSE_SECTORS) {
    // default to admin-setting, or setting from previous questions
    return defaultLayout;
  } else {
    if (isSmall) {
      if (
        stage === STAGES.MOBILE_DRAW_FIRST_SHAPE ||
        stage === STAGES.MOBILE_MAP_FEATURES
      ) {
        return FormElementLayout.MapFullscreen;
      } else if (stage === STAGES.MOBILE_EDIT_PROPERTIES) {
        // Will need to add an option for a header map
        return FormElementLayout.Top;
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

export default SpatialAccessPriority;
