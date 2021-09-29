import { Trans } from "react-i18next";
import TextInput from "../components/TextInput";
import { FormElementBody, FormElementProps } from "./FormElement";

export type ShortTextProps = {
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  /**
   * Enable admins to provide common values
   * https://developers.google.com/web/updates/2015/06/checkout-faster-with-autofill
   */
  name?: string;
};

/**
 * Simplest of input FormElements, takes a single line of text. Wraps TextInput component
 */
export default function ShortText(
  props: FormElementProps<ShortTextProps, string>
) {
  const errors = validateShortTextInput(
    props.value,
    props.isRequired,
    props.componentSettings
  );

  return (
    <>
      <FormElementBody
        isInput={true}
        body={props.body}
        required={props.isRequired}
      />
      <div className="w-full md:w-96 max-w-full form-element-short-text pt-1">
        <TextInput
          error={props.submissionAttempted ? errors : undefined}
          value={props.value || ""}
          label=""
          onChange={(v) => props.onChange(v, !!errors)}
          name={
            props.componentSettings.name ||
            `form-element-${props.id}-text-input`
          }
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
