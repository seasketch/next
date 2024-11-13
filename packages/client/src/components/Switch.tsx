import React from "react";

export interface SwitchProps {
  isToggled?: boolean;
  disabled?: boolean;
  onClick?: (val: boolean, e?: React.MouseEvent<any, MouseEvent>) => void;
  className?: string;
  toggleColor?: string;
}

export default function Switch(props: SwitchProps) {
  const toggleColor = props.toggleColor || "rgb(46, 115, 182)";
  return (
    <div
      className={`inline-flex items-center ${props.disabled && "opacity-75"}`}
    >
      <span
        aria-checked={props.isToggled}
        onClick={(e) => {
          if (props.onClick && !props.disabled) {
            props.onClick(!props.isToggled, e);
          }
          e.preventDefault();
          e.stopPropagation();
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (
            !props.disabled &&
            props.onClick &&
            (e.key === "Enter" || e.key === " ")
          ) {
            props.onClick(!props.isToggled);
            e.preventDefault();
          }
        }}
        role="switch"
        aria-readonly={!!props.disabled}
        tabIndex={0}
        style={{
          backgroundColor: !!props.isToggled ? toggleColor : "rgba(0,0,0,0.18)",
        }}
        className={`inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full ${
          !props.disabled && "cursor-pointer"
        } transition-colors ease-in-out duration-200 focus:outline-none ${
          !props.disabled && "focus:ring"
        } ${props.className}`}
      >
        <span
          aria-hidden="true"
          className={`${
            !!props.isToggled
              ? "translate-x-5 rtl:-translate-x-5"
              : "translate-x-0"
          } inline-block h-5 w-5 rounded-full bg-white shadow transform transition ease-in-out duration-200`}
        ></span>
      </span>
    </div>
  );
}
