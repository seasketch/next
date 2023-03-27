import { UserCircleIcon } from "@heroicons/react/solid";
import { useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import TextInput from "../components/TextInput";
import LocalizableTextInput from "../surveys/LocalizableTextInput";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  SurveyContext,
  useLocalizedComponentSetting,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";

export type NameProps = {
  placeholder?: string;
  facilitatorBody?: any;
};

export type NameType = { name: string; facilitator?: string };

/**
 * Name text input with validation. Automatically populates from profile
 * name if the user is logged in, or survey invite token. Also allows for
 * facilitated responses.
 */
const Name: FormElementComponent<NameProps, NameType> = (props) => {
  const { t } = useTranslation("surveys");
  const context = useContext(SurveyContext);
  const [val, setVal] = useState<NameType | undefined>({
    name: context?.bestName || "",
    facilitator: undefined,
    ...props.value,
  });
  if (!context) {
    throw new Error("SurveyContext not set");
  }

  const placeholder = useLocalizedComponentSetting("placeholder", props);

  useEffect(() => {
    if (
      (props.value === null || props.value === undefined) &&
      context.bestName
    ) {
      const newVal = { ...val!, name: context.bestName || "" };
      setVal(newVal);
      props.onChange(newVal, !validate(newVal, context.isFacilitatedResponse));
    }
  }, [context.bestName]);

  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={true}
        body={props.body}
        required={props.isRequired}
        editable={props.editable}
        alternateLanguageSettings={props.alternateLanguageSettings}
      />
      <div
        className="w-full md:w-96 max-w-full form-element-short-text pt-1 transition-all"
        style={{ height: 68 }}
      >
        <TextInput
          type="text"
          value={val?.name || ""}
          label=""
          onChange={(name) => {
            const newVal = { ...val!, name: name || "" };
            setVal(newVal);
            props.onChange(
              newVal,
              !validate(newVal, context.isFacilitatedResponse)
            );
          }}
          name={`form-element-${props.id}-name-input`}
          autocomplete="name"
          required={props.isRequired}
          autoFocus={props.autoFocus}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              props.onSubmit();
            }
          }}
        />
      </div>
      <div>
        {context.surveySupportsFacilitation &&
          (props.editable || context.isFacilitatedResponse) && (
            <div
              className={
                props.editable
                  ? `border p-4 rounded mb-4 -ml-4 border-opacity-20`
                  : ""
              }
            >
              {props.editable && (
                <p className="text-base italic mb-4">
                  <Trans ns="admin:surveys">
                    This content will only appear when a facilitator is filling
                    out a response for someone else. If the facilitator is
                    signed-in, it will be populated by their profile.
                  </Trans>
                </p>
              )}
              <FormElementBody
                formElementId={props.id}
                isInput={true}
                body={
                  props.componentSettings.facilitatorBody ||
                  Name.defaultComponentSettings?.facilitatorBody
                }
                required={props.isRequired}
                editable={props.editable}
                componentSettings={props.componentSettings}
                componentSettingName="facilitatorBody"
                alternateLanguageSettings={props.alternateLanguageSettings}
              />
              <div
                className="w-full md:w-96 max-w-full form-element-short-text pt-1 transition-all"
                style={{ height: 68 }}
              >
                <TextInput
                  type="text"
                  value={props.value?.facilitator || ""}
                  label=""
                  name={`form-element-${props.id}-facilitator-input`}
                  // autocomplete="name"
                  required={props.isRequired}
                  onChange={(value) => {
                    const newVal = { ...val!, facilitator: value || "" };
                    setVal(newVal);
                    props.onChange(
                      newVal,
                      !validate(newVal, context.isFacilitatedResponse)
                    );
                  }}
                />
              </div>
            </div>
          )}
      </div>
      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting, updateSurvey) => {
          return (
            <>
              <p className="text-sm text-gray-500">
                <Trans ns="admin:surveys">
                  This input will be populated with the user's login information
                  if available
                </Trans>
              </p>
              <InputBlock
                labelType="small"
                title={t("Show Facilitation Option", { ns: "admin:surveys" })}
                input={
                  <Switch
                    isToggled={context.surveySupportsFacilitation}
                    onClick={(val) =>
                      updateSurvey({ showFacilitationOption: val })
                    }
                  />
                }
              />
              <p className="text-sm text-gray-500">
                <Trans ns="admin:surveys">
                  If a response is created with facilitation enabled, the user
                  will be given the option to specify both a respondent and
                  facilitator name. Facilitation can be enabled from dropdown
                  button on the Welcome page.
                </Trans>
              </p>{" "}
              <LocalizableTextInput
                label={t("Placeholder", { ns: "admin:surveys" })}
                name="placeholder"
                value={placeholder || ""}
                onChange={updateComponentSetting(
                  "placeholder",
                  props.componentSettings,
                  context.lang.code,
                  props.alternateLanguageSettings
                )}
              />
            </>
          );
        }}
      />
    </>
  );
};

Name.label = <Trans ns="admin:surveys">Name</Trans>;
Name.description = <Trans ns="admin:surveys">Name of respondent</Trans>;
Name.defaultBody = questionBodyFromMarkdown(`
# What is your name?
`);
Name.defaultExportId = "name";
Name.defaultComponentSettings = {
  facilitatorBody: questionBodyFromMarkdown(`
# Facilitator name

Name of the person recording information for the respondent named above
`),
};

function validate(state: NameType, facilitated: boolean) {
  if (facilitated && (!state.facilitator || state.facilitator.length === 0)) {
    return false;
  }
  if (state.name.length === 0) {
    return false;
  }
  return true;
}

Name.icon = () => (
  <div className="bg-gray-600 w-full h-full font-bold text-center flex justify-center items-center italic">
    {/* eslint-disable-next-line i18next/no-literal-string */}
    <UserCircleIcon style={{ color: "#bbd0dd" }} className="w-2/3 h-2/3" />
  </div>
);

export default Name;
