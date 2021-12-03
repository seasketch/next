import { ExclamationIcon, ScaleIcon } from "@heroicons/react/outline";
import {
  LocationMarkerIcon,
  MapIcon,
  PlusCircleIcon,
} from "@heroicons/react/solid";
import { Feature } from "geojson";
import { Trans, useTranslation } from "react-i18next";
import SketchGeometryTypeSelector, {
  Icons,
} from "../components/SketchGeometryTypeSelector";
import { SketchGeometryType } from "../generated/graphql";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import FormElementOptionsInput, {
  FormElementOption,
} from "./FormElementOptionsInput";
import fromMarkdown, { questionBodyFromMarkdown } from "./fromMarkdown";
import OptionPicker from "./OptionPicker";

export type SpatialAcessPriorityProps = {
  sectorOptions?: FormElementOption[];
  beginBody?: any;
  listShapesBody?: any;
};

/**
 * Displays a rich text section
 */
const SpatialAcessPriority: FormElementComponent<
  SpatialAcessPriorityProps,
  { userGeom?: Feature; sectors?: string[] }
> = (props) => {
  const { t } = useTranslation("admin:surveys");
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
                  ...props.value,
                  sectors,
                },
                false
              );
            }}
            value={props.value?.sectors || []}
          />
        </div>
      )}
      {props.stage === STAGES.DRAWING_INTRO && (
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
      <FormElementEditorPortal
        render={(
          updateBaseSetting,
          updateComponentSetting,
          updateSurveySettings,
          updateSketchClass
        ) => {
          return (
            <>
              {/* <div>
                <h4 className="block text-sm font-medium leading-5 text-gray-800">
                  {t("Geometry Type")}
                </h4>
                <p className="text-sm text-gray-500 mb-2 mt-1">
                  <Trans ns="admin:surveys">
                    Geometry type cannot be changed after responses are
                    collected
                  </Trans>
                </p>
                <SketchGeometryTypeSelector
                  value={props.sketchClass!.geometryType}
                  onChange={(geometryType) =>
                    updateSketchClass({
                      geometryType,
                    })
                  }
                  simpleFeatures
                />
              </div> */}

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
} as const;

SpatialAcessPriority.stages = STAGES;

export default SpatialAcessPriority;
