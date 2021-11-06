import { FunctionComponent, MouseEventHandler, useContext } from "react";
import { SurveyStyleContext } from "../surveys/appearance";

export default function SurveyButton({
  label,
  Icon,
  onClick,
  selected,
  className,
  iconPlacement,
}: {
  label: string;
  Icon?: FunctionComponent<{ className?: string }>;
  onClick?: MouseEventHandler;
  selected: boolean;
  className?: string;
  iconPlacement?: "right" | "left";
}) {
  const style = useContext(SurveyStyleContext);
  return (
    <button
      title={label}
      onClick={onClick}
      className={`border rounded transition-all duration-200 active:scale-125 transform inline-flex items-center ${
        style.isDark ? "bg-white" : "bg-black"
      } bg-opacity-5 hover:bg-opacity-10 hover:bg-white px-4 py-2 ${
        Icon && (iconPlacement === "left" ? "pl-10 pr-6" : "pr-10")
      } ${selected ? style.secondaryTextClass : style.textClass} ${className}`}
      style={
        selected
          ? {
              background: `linear-gradient(${style.secondaryColor}, ${style.secondaryColor2})`,
            }
          : {}
      }
    >
      <span>{label}</span>
      {Icon && (
        <Icon
          className={`w-5 h-5 absolute ${
            iconPlacement === "left" ? "left-3" : "right-3"
          }`}
        />
      )}
    </button>
  );
}
