import { useContext } from "react";
import Button, { ButtonProps } from "../components/Button";
import { SurveyLayoutContext } from "./SurveyAppLayout";

export default function SurveyButton(props: ButtonProps) {
  const style = useContext(SurveyLayoutContext).style;
  return <Button backgroundColor={style.secondaryColor} {...props} />;
}
