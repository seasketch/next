import { FormElementProps } from "../formElements/FormElement";
import { Trans } from "react-i18next";
import { components } from "../formElements";
import { SketchClassDetailsFragment } from "../generated/graphql";

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
}: FormElementProps<any> & {
  typeName: string;
  sketchClass?: SketchClassDetailsFragment | undefined | null;
}) {
  if (typeName in components) {
    const Component = components[typeName];
    return (
      <Component
        value={value}
        componentSettings={componentSettings}
        autoFocus={
          formElementData.autoFocus === undefined
            ? true
            : formElementData.autoFocus
        }
        {...formElementData}
      />
    );
  } else {
    return (
      <Trans values={{ typeName }} ns="errors">
        Missing form element type {{ typeName }}
      </Trans>
    );
  }
}
