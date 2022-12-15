import { useContext } from "react";
import Button, { ButtonProps } from "../components/Button";
import { FormElementLayoutContext } from "./SurveyAppLayout";

export default function SurveyButton(
  props: ButtonProps & { secondary?: boolean }
) {
  const style = useContext(FormElementLayoutContext).style;
  let buttonClassName = props.buttonClassName || "";
  if (props.secondary) {
    buttonClassName += " opacity-80";
  }
  return (
    <Button
      backgroundColor={props.secondary ? "#fff" : style.secondaryColor}
      {...props}
      buttonClassName={buttonClassName}
    />
  );
}
