import { FlagIcon } from "@heroicons/react/outline";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import InputBlock from "../components/InputBlock";
import NumberInput from "../components/NumberInput";
import Switch from "../components/Switch";
import TextInput from "../components/TextInput";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import fromMarkdown, { questionBodyFromMarkdown } from "./fromMarkdown";

export type FeatureNameProps = {
  generatedNamePrefix: string;
};

/**
 * Simplest of input FormElements, takes a single line of text. Wraps TextInput component
 */
const FeatureName: FormElementComponent<FeatureNameProps, string> = (props) => {
  const { t } = useTranslation("surveys");
  const [val, setVal] = useState(
    props.value ||
      (props.componentSettings.generatedNamePrefix || "Location") +
        ` ${props.featureNumber.toLocaleString()}`
  );
  const [errors, setErrors] = useState((val && val.length > 0) || false);
  useEffect(() => {
    setErrors((val && val.length > 0) || false);
  }, [props.componentSettings, props.isRequired, val]);
  useEffect(() => {
    if (props.editable) {
      setVal(
        (props.componentSettings.generatedNamePrefix || "Location") +
          ` ${props.featureNumber.toLocaleString()}`
      );
    }
  }, [props.componentSettings.generatedNamePrefix, props.editable]);

  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={true}
        body={props.body}
        required={props.isRequired}
        editable={props.editable}
      />
      <div
        className="w-full md:w-96 max-w-full form-element-short-text pt-1"
        style={{ height: 68 }}
      >
        <TextInput
          error={
            props.submissionAttempted && errors
              ? t("Required", { ns: "surveys" })
              : undefined
          }
          value={val}
          label=""
          onChange={(v) => {
            const e = (v && v.length > 0) || false;
            setVal(v);
            props.onChange(v, e ? true : false);
          }}
          name={`FeatureName`}
          autocomplete={"none"}
          required={true}
          autoFocus={true}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              props.onSubmit();
            }
          }}
        />
      </div>
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return (
            <>
              {props.sketchClass && (
                <TextInput
                  label={t("Generated Name Prefix")}
                  name="generatedNamePrefix"
                  description={t(
                    "A name will be generated for each new feature (e.g. Location 4) which can be changed by the user. The prefix will be joined with a localized number."
                  )}
                  value={props.componentSettings.generatedNamePrefix || ""}
                  onChange={updateComponentSetting(
                    "generatedNamePrefix",
                    props.componentSettings
                  )}
                />
              )}
            </>
          );
        }}
      />
    </>
  );
};

FeatureName.templatesOnly = true;
FeatureName.defaultComponentSettings = {
  generatedNamePrefix: "Location",
};
FeatureName.label = <Trans>Location Name</Trans>;
FeatureName.description = <Trans>Name for a spatial feature</Trans>;
FeatureName.defaultBody = questionBodyFromMarkdown(`
# Location Name
`);

FeatureName.icon = () => (
  <div className="bg-blue-700 w-full h-full font-bold text-center flex justify-center items-center text-white">
    <FlagIcon className="text-white w-6 h-6" />
  </div>
);

export default FeatureName;
