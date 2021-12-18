import { ExclamationIcon, ScaleIcon } from "@heroicons/react/outline";
import {
  LocationMarkerIcon,
  MapIcon,
  PlusCircleIcon,
} from "@heroicons/react/solid";
import { AnimatePresence, motion } from "framer-motion";
import { BBox, Feature, FeatureCollection } from "geojson";
import { LngLatBoundsLike, Map } from "mapbox-gl";
import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import BasemapMultiSelectInput from "../admin/surveys/BasemapMultiSelectInput";
import BoundsInput from "../admin/surveys/BoundsInput";
import Button from "../components/Button";
import MapboxMap from "../components/MapboxMap";
import SketchGeometryTypeSelector, {
  Icons,
} from "../components/SketchGeometryTypeSelector";
import { useMapContext } from "../dataLayers/MapContextManager";
import { EMPTY_FEATURE_COLLECTION } from "../draw/useMapboxGLDraw";
import { FormElementLayout, SketchGeometryType } from "../generated/graphql";
import { SurveyStyleContext } from "../surveys/appearance";
import { SurveyLayoutContext } from "../surveys/SurveyAppLayout";
import SurveyButton from "../surveys/SurveyButton";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyMapPortal,
  SurveyMapPortalContext,
} from "./FormElement";
import FormElementOptionsInput, {
  FormElementOption,
} from "./FormElementOptionsInput";
import fromMarkdown, { questionBodyFromMarkdown } from "./fromMarkdown";
import OptionPicker from "./OptionPicker";
import SpatialInputMap, { defaultStartingBounds } from "./SpatialInputMap";

export type SpatialAcessPriorityProps = {
  sectorOptions?: FormElementOption[];
  beginBody?: any;
  listShapesBody?: any;
  startingBounds?: BBox;
  basemaps?: number[];
};

const SpatialAcessPriority: FormElementComponent<
  SpatialAcessPriorityProps,
  { collection: FeatureCollection<any>; sectors: string[] }
> = (props) => {
  const { t } = useTranslation("admin:surveys");
  const context = useContext(SurveyLayoutContext);
  const style = context.style;
  const [sector, setSector] = useState(
    props.componentSettings.sectorOptions
      ? props.componentSettings.sectorOptions[0]
      : null
  );

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

  const [drawControls, setDrawControls] = useState<{
    map: Map;
    initialBounds: BBox;
    enable: () => void;
    disable: () => void;
  } | null>(null);

  return (
    <>
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
                This stage will be skipped if no sector options are specified.
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
                    props.value?.collection || EMPTY_FEATURE_COLLECTION,
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
              props.onRequestStageChange(STAGES.DRAWING_INTRO);
            }}
          />
        </div>
      )}
      {(props.stage === STAGES.DRAWING_INTRO ||
        props.stage === STAGES.MOBILE_DRAW_FIRST_SHAPE) && (
        <>
          {!style.isSmall && (
            <motion.h4
              variants={{
                exit: (direction: boolean) => ({
                  opacity: 0,
                }),
                enter: (direction: boolean) => ({
                  opacity: 0,
                }),
                show: () => ({
                  opacity: 1,
                }),
              }}
              transition={{
                delay: 0.3,
                duration: 0,
              }}
              className={`font-bold text-xl p-4 pt-6 -ml-5 -mr-5 -mt-5 mb-5 ${style.secondaryTextClass}`}
              style={{
                backgroundColor: style.secondaryColor,
                background: `linear-gradient(180deg, ${style.secondaryColor} 50%, ${style.secondaryColor2} 100%)`,
              }}
            >
              {" "}
              {sector?.label || "$SECTOR"}
            </motion.h4>
          )}
          <FormElementBody
            componentSettingName={"beginBody"}
            componentSettings={props.componentSettings}
            required={false}
            formElementId={props.id}
            isInput={false}
            body={
              props.componentSettings.beginBody ||
              SpatialAcessPriority.defaultComponentSettings?.beginBody
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
        <FormElementBody
          required={false}
          componentSettings={props.componentSettings}
          componentSettingName={"listShapesBody"}
          formElementId={props.id}
          isInput={false}
          body={
            props.componentSettings.listShapesBody ||
            SpatialAcessPriority.defaultComponentSettings?.listShapesBody
          }
          editable={true}
        />
      )}
      {props.stage !== STAGES.CHOOSE_SECTORS && (
        <SpatialInputMap
          componentSettings={props.componentSettings}
          basemapIds={props.componentSettings.basemaps}
          startingBounds={props.componentSettings.startingBounds}
          geometryType={props.sketchClass!.geometryType}
          onLoad={(map, enable, disable, initialBounds) => {
            setDrawControls({ map, enable, disable, initialBounds });
          }}
        />
      )}
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
                    List sector options below to collect data related to
                    different ocean uses. If no sectors are provided then the
                    sectors question will be skipped and only a single set of
                    shapes will be collected.
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
                value={
                  props.componentSettings.startingBounds ||
                  drawControls?.initialBounds
                }
                map={drawControls?.map || undefined}
                onBeforeInput={drawControls?.disable}
                onAfterInput={drawControls?.enable}
                onChange={updateComponentSetting(
                  "startingBounds",
                  props.componentSettings
                )}
              />
            </>
          );
        }}
      />
    </>
  );
};

SpatialAcessPriority.label = (
  <Trans ns="admin:surveys">Spatial Access Priority</Trans>
);
SpatialAcessPriority.description = (
  <Trans ns="admin:surveys">Prioritize use by location</Trans>
);
// eslint-disable-next-line i18next/no-literal-string
SpatialAcessPriority.defaultBody = questionBodyFromMarkdown(`
# What sectors do you represent?

For each selection, you will be asked to draw and prioritize valued areas.
`);

SpatialAcessPriority.icon = ({ componentSettings, sketchClass }) => {
  const Icon = Icons[sketchClass?.geometryType || SketchGeometryType.Polygon];
  return (
    <div className="bg-red-500 w-full h-full font-bold text-center flex justify-center items-center  italic text-white relative">
      <ScaleIcon className="text-white w-5 h-6" />
      {/* <Icon multi={true} className="text-white w-5 h-6" /> */}
    </div>
  );
};

SpatialAcessPriority.defaultComponentSettings = {
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

const STAGES = {
  CHOOSE_SECTORS: 0,
  DRAWING_INTRO: 1,
  SHAPE_EDITOR: 2,
  LIST_SHAPES: 3,
  MOBILE_DRAW_FIRST_SHAPE: 4,
  MOBILE_EDIT_PROPERTIES: 5,
  MOBILE_MAP_FEATURES: 6,
} as const;

SpatialAcessPriority.stages = STAGES;

SpatialAcessPriority.getLayout = (
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

export default SpatialAcessPriority;
