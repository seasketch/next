import { Trans } from "react-i18next";
import TextInput from "../components/TextInput";
import { FormElementBody, FormElementProps } from "./FormElement";

export type ShortTextProps = {
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
};

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
      <FormElementBody body={JSON.parse(props.body.toString())} />
      <div className="w-full md:w-96 max-w-full">
        <TextInput
          error={props.submissionAttempted ? errors : undefined}
          value={props.value || ""}
          label=""
          onChange={(v) => props.onChange(v, !!errors)}
          name={`form-element-${props.id}-text-input`}
          required={props.isRequired}
          autoFocus={true}
          placeholder={props.componentSettings.placeholder}
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
