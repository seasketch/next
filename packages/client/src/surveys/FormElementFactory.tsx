import { FormElementProps } from "../formElements/FormElement";
import { Trans } from "react-i18next";
import { components } from "../formElements";

/**
 * Returns the appropriate component for a given FormElement config based on type.componentName
 * @param param0
 * @returns FormElement component
 */
export default function FormElementFactory({
  typeName,
  componentSettings,
  value,
  ...formElementData
}: Pick<
  FormElementProps<any>,
  | "body"
  | "id"
  | "componentSettings"
  | "isRequired"
  | "submissionAttempted"
  | "value"
  | "onChange"
  | "onSubmit"
  | "editable"
> & {
  typeName: string;
}) {
  if (typeName in components) {
    const Component = components[typeName];
    return (
      <Component
        value={value}
        componentSettings={componentSettings}
        {...formElementData}
      />
    );
  } else {
    return <Trans ns="errors">missing form element type {typeName}</Trans>;
  }
}
