import { useContext } from "react";
import Button, { ButtonProps } from "../components/Button";
import { SurveyLayoutContext } from "./SurveyAppLayout";

export default function SurveyButton(
  props: ButtonProps & { secondary?: boolean }
) {
  const style = useContext(SurveyLayoutContext).style;
  return (
    <Button
      backgroundColor={props.secondary ? "#fff" : style.secondaryColor}
      {...props}
      buttonClassName={props.secondary ? "opacity-80" : ""}
    />
  );
}
