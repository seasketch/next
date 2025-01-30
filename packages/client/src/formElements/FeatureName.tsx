import { FlagIcon } from "@heroicons/react/outline";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import TextInput from "../components/TextInput";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";

export type FeatureNameProps = {
  generatedNamePrefix: string;
};

/**
 * Simplest of input FormElements, takes a single line of text. Wraps TextInput component
 */
const FeatureName: FormElementComponent<FeatureNameProps, string> = (props) => {
  const { t } = useTranslation("surveys");
  const [val, setVal] = useState(props.value);

  useEffect(() => {
    if (props.value === undefined && !props.isSketchWorkflow) {
      const value = `${
        props.componentSettings.generatedNamePrefix || "Location"
      } ${props.featureNumber.toLocaleString()}`;
      props.onChange(value, false);
      setVal(value);
    } else if (props.value !== val) {
      setVal(props.value);
    }
  }, [props.value]);

  const [errors, setErrors] = useState(!(val && val.length > 0));
  useEffect(() => {
    setErrors(!(val && val.length > 0));
  }, [props.componentSettings, props.isRequired, val]);
  useEffect(() => {
    if (props.editable && !props.isSketchWorkflow) {
      setVal(
        (props.componentSettings.generatedNamePrefix || "Location") +
          ` ${props.featureNumber.toLocaleString()}`
      );
    }
  }, [props.componentSettings.generatedNamePrefix, props.editable]);

  return (
    <>
      {props.isSketchWorkflow && true ? (
        <span className="ProseMirrorBody required input">
          <h1 data-question="yes">
            <Trans ns="sketching">Name</Trans>
          </h1>
        </span>
      ) : (
        <FormElementBody
          formElementId={props.id}
          isInput={true}
          body={props.body}
          required={props.isRequired}
          editable={props.editable}
          alternateLanguageSettings={props.alternateLanguageSettings}
        />
      )}

      <div
        className="w-full md:w-96 max-w-full form-element-short-text pt-1"
        style={{ height: 68 }}
      >
        <TextInput
          placeholder={
            props.submissionAttempted && errors
              ? t("Required", { ns: "surveys" })
              : undefined
          }
          error={props.submissionAttempted && errors ? " " : undefined}
          value={val || ""}
          label=""
          onChange={(v) => {
            const e = !(v && v.length > 0);
            setVal(v);
            props.onChange(v, e ? true : false);
          }}
          name={`FeatureName`}
          autocomplete={"none"}
          required={true}
          autoFocus={props.autoFocus}
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
                  label={t("Generated Name Prefix", { ns: "admin:surveys" })}
                  name="generatedNamePrefix"
                  description={
                    <Trans
                      ns="admin:surveys"
                      i18nKey="FeatureNameGenerationDescription"
                    >
                      A name will be generated for each new feature (e.g.
                      Location 4) which can be changed by the user. The prefix
                      will be joined with a localized number.
                    </Trans>
                  }
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
FeatureName.label = <Trans ns="admin:surveys">Location Name</Trans>;
FeatureName.description = (
  <Trans ns="admin:surveys">Name for a spatial feature</Trans>
);
FeatureName.defaultBody = questionBodyFromMarkdown(`
# Location Name
`);

FeatureName.icon = () => (
  <div className="bg-blue-700 w-full h-full font-bold text-center flex justify-center items-center text-white">
    <FlagIcon className="text-white w-6 h-6" />
  </div>
);

export default FeatureName;
