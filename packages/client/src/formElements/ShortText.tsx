import { Trans, useTranslation } from "react-i18next";
import InputBlock from "../components/InputBlock";
import MutationStatusIndicator from "../components/MutationStatusIndicator";
import Switch from "../components/Switch";
import TextInput from "../components/TextInput";
import { useUpdateFormElementMutation } from "../generated/graphql";
import {
  FormElementBody,
  FormElementEditorPortal,
  FormElementProps,
  useUpdateFormElement,
} from "./FormElement";

export type ShortTextProps = {
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  /**
   * Enable admins to provide common values
   * https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete#values
   */
  autocomplete?: string;
};

/**
 * Simplest of input FormElements, takes a single line of text. Wraps TextInput component
 */
export default function ShortText(
  props: FormElementProps<ShortTextProps, string>
) {
  const { t } = useTranslation("surveys");
  const errors = validateShortTextInput(
    props.value,
    props.isRequired,
    props.componentSettings
  );
  const [updateSettings, mutationState] = useUpdateFormElement(props);
  return (
    <>
      <FormElementBody
        formElementId={props.id}
        isInput={true}
        body={props.body}
        required={props.isRequired}
        editable={props.editable}
      />
      <div className="w-full md:w-96 max-w-full form-element-short-text pt-1">
        <TextInput
          error={props.submissionAttempted ? errors : undefined}
          value={props.value || ""}
          label=""
          onChange={(v) => props.onChange(v, !!errors)}
          name={
            props.componentSettings.autocomplete ||
            `form-element-${props.id}-text-input`
          }
          autocomplete={props.componentSettings.autocomplete}
          required={props.isRequired}
          autoFocus={true}
          placeholder={props.componentSettings.placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              props.onSubmit();
            }
          }}
        />
      </div>
      <FormElementEditorPortal
        render={(updateSettings) => {
          return (
            <div className="text-sm">
              <InputBlock
                title={t("Required", { ns: "admin:surveys" })}
                input={
                  <Switch
                    isToggled={props.isRequired}
                    onClick={(isRequired) =>
                      updateSettings({
                        isRequired,
                      })
                    }
                  />
                }
              />
              <TextInput
                label={t("Autocomplete ID")}
                name="autocomplete"
                placeholder={"name, fname, email, etc"}
                value={props.componentSettings.autocomplete || ""}
                onChange={(value) =>
                  updateSettings({
                    componentSettings: {
                      ...props.componentSettings,
                      autocomplete: value,
                    },
                  })
                }
                description={
                  <Trans ns="admin:surveys">
                    Giving this input a{" "}
                    <a
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                      href="https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete#values"
                    >
                      standard autocomplete attribute
                    </a>{" "}
                    can simplify tedious entries
                  </Trans>
                }
              />
            </div>
          );
        }}
      />
    </>
  );
}

export function validateShortTextInput(
  text: string | undefined,
  required: boolean,
  { minLength, maxLength }: ShortTextProps
) {
  if (required && (!text || text.length < 1)) {
    return <Trans>Required field</Trans>;
  }
  if (text && minLength && text.length < minLength) {
    return <Trans>Input must be greater than {minLength} characters</Trans>;
  }
  if (text && maxLength && text.length > maxLength) {
    return <Trans>Input must be less than {maxLength} characters</Trans>;
  }
}
