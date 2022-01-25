import { colord } from "colord";
import { FunctionComponent, MouseEventHandler, useContext } from "react";
import { SurveyLayoutContext } from "../surveys/SurveyAppLayout";

export default function SurveyInputButton({
  label,
  Icon,
  onClick,
  selected,
  className,
  iconPlacement,
  disabled,
}: {
  label: string;
  Icon?: FunctionComponent<{ className?: string }>;
  onClick?: MouseEventHandler;
  selected: boolean;
  className?: string;
  iconPlacement?: "right" | "left";
  disabled?: boolean;
}) {
  const style = useContext(SurveyLayoutContext).style;
  return (
    <button
      disabled={disabled}
      title={label}
      onClick={onClick}
      className={`border rounded transition-transform duration-200 transform inline-flex items-center ${
        style.isDark ? "bg-white" : "bg-black"
      } bg-opacity-5 hover:bg-opacity-10 hover:bg-white px-4 py-2 ${
        Icon &&
        (iconPlacement === "left"
          ? "ltr:pl-10 ltr:pr-6 rtl:pr-10"
          : "ltr:pr-10 rtl:pl-10 rtl:pr-6")
      } ${selected ? style.secondaryTextClass : style.textClass} ${className} ${
        disabled ? "opacity-50" : "active:scale-125"
      }`}
      style={
        selected
          ? {
              background: `linear-gradient(${style.secondaryColor}, ${style.secondaryColor2})`,
            }
          : {
              background: colord(style.backgroundColor).alpha(0.8).toHex(),
            }
      }
    >
      <span>{label}</span>
      {Icon && (
        <Icon
          className={`w-5 h-5 absolute ${
            iconPlacement === "left"
              ? "ltr:left-3 rtl:right-3"
              : "ltr:right-3 rtl:left-3"
          }`}
        />
      )}
    </button>
  );
}
