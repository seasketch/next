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
import { questionBodyFromMarkdown } from "./fromMarkdown";

export type MultiSpatialInputProps = {};

/**
 * Displays a rich text section
 */
const MultiSpatialInput: FormElementComponent<
  MultiSpatialInputProps,
  { userGeom: Feature }
> = (props) => {
  const { t } = useTranslation("admin:surveys");
  return (
    <>
      <div className="mb-5">
        <FormElementBody
          required={props.isRequired}
          formElementId={props.id}
          isInput={true}
          body={props.body}
          editable={props.editable}
        />
      </div>
      <FormElementEditorPortal
        render={(
          updateBaseSetting,
          updateSetting,
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
              </div>
            </>
          );
        }}
      />
    </>
  );
};

MultiSpatialInput.label = <Trans ns="admin:surveys">Multiple Locations</Trans>;
MultiSpatialInput.description = (
  <Trans ns="admin:surveys">Collect spatial features with attributes</Trans>
);
// eslint-disable-next-line i18next/no-literal-string
MultiSpatialInput.defaultBody = questionBodyFromMarkdown(`
# Where have you seen this species?
`);

MultiSpatialInput.icon = ({ componentSettings, sketchClass }) => {
  const Icon = Icons[sketchClass?.geometryType || SketchGeometryType.Polygon];
  return (
    <div className="bg-red-500 w-full h-full font-bold text-center flex justify-center items-center  italic text-white relative">
      <Icon multi={true} className="text-white w-5 h-6" />
    </div>
  );
};

export default MultiSpatialInput;
