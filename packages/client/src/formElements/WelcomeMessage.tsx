import { useHistory } from "react-router";
import Button from "../components/Button";
import { FormElementBody, FormElementProps } from "./FormElement";

/**
 * Displays rich text at the begining of a survey. Only one WelcomeMessage should be
 * added to form
 */
export default function WelcomeMessage(
  props: FormElementProps<{ beginButtonText: string }>
) {
  return (
    <>
      <FormElementBody isInput={false} body={props.body} />
      <Button
        autofocus
        className="mt-6"
        onClick={props.onSubmit}
        label={
          props.componentSettings.beginButtonText?.length
            ? props.componentSettings.beginButtonText
            : ""
        }
        primary
      />
    </>
  );
}
