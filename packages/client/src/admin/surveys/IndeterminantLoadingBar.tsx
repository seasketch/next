import { useContext } from "react";
import { SurveyStyleContext } from "../../surveys/appearance";

require("./IndeterminantLoadingBar.css");

export default function IndeterminantLoadingBar({
  className,
}: {
  className?: string;
}) {
  const style = useContext(SurveyStyleContext);
  return (
    <div className={`indeterminantSlider rounded ${className}`}>
      <div
        className={`line opacity-30`}
        style={{ backgroundColor: style.secondaryColor }}
      ></div>
      <div
        className="subline inc"
        style={{ backgroundColor: style.secondaryColor }}
      ></div>
      <div
        className="subline dec"
        style={{ backgroundColor: style.secondaryColor }}
      ></div>
    </div>
  );
}
