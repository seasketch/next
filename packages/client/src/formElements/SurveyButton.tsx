import { FunctionComponent, MouseEventHandler, useContext } from "react";
import { SurveyStyleContext } from "../surveys/appearance";

export default function SurveyButton({
  label,
  Icon,
  onClick,
  selected,
  className,
}: {
  label: string;
  Icon?: FunctionComponent<{ className?: string }>;
  onClick?: MouseEventHandler;
  selected: boolean;
  className?: string;
}) {
  const style = useContext(SurveyStyleContext);
  return (
    <button
      title={label}
      onClick={onClick}
      className={`border rounded transition-all duration-200 active:scale-125 transform inline-flex items-center ${
        style.isDark ? "bg-white" : "bg-black"
      } bg-opacity-5 hover:bg-opacity-10 hover:bg-white px-4 py-2 ${
        selected ? style.secondaryTextClass : style.textClass
      } ${className}`}
      style={
        selected
          ? {
              background: `linear-gradient(${style.secondaryColor}, ${style.secondaryColor2})`,
            }
          : {}
      }
    >
      <span>{label}</span>
      {Icon && <Icon className="w-5 h-5 ml-2" />}
    </button>
  );
}
