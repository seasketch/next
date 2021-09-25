import { useHistory } from "react-router";
import Button from "../components/Button";
import { FormElementBody, FormElementProps } from "./FormElement";

export default function WelcomeMessage(
  props: FormElementProps<{ beginButtonText: "" }>
) {
  const history = useHistory();
  return (
    <>
      <FormElementBody body={JSON.parse(props.body.toString())} />
      <Button
        className="mt-6"
        href={"./1"}
        label={props.componentSettings.beginButtonText || ""}
        primary
      />
    </>
  );
}
