import React from "react";

export interface SwitchProps {
  isToggled?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function Switch(props: SwitchProps) {
  return (
    <div
      className={`inline-flex items-center ${props.disabled && "opacity-75"}`}
    >
      <span
        aria-checked={props.isToggled}
        onClick={props.onClick}
        onKeyDown={(e) => {
          if (props.onClick && (e.key === "Enter" || e.key === " ")) {
            props.onClick();
            e.preventDefault();
          }
        }}
        role="switch"
        aria-readonly={!!props.disabled}
        tabIndex={0}
        className={`${
          !!props.isToggled ? "bg-primary-500" : "bg-gray-200"
        } inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full ${
          !props.disabled && "cursor-pointer"
        } transition-colors ease-in-out duration-200 focus:outline-none ${
          !props.disabled && "focus:ring"
        } ${props.className}`}
      >
        <span
          aria-hidden="true"
          className={`${
            !!props.isToggled ? "translate-x-5" : "translate-x-0"
          } inline-block h-5 w-5 rounded-full bg-white shadow transform transition ease-in-out duration-200`}
        ></span>
      </span>
    </div>
  );
}
