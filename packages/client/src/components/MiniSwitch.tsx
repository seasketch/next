import React from "react";

export interface MiniSwitchProps {
  isToggled?: boolean;
  // disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function MiniSwitch(props: MiniSwitchProps) {
  return (
    <button
      type="button"
      aria-pressed="false"
      className={`flex-shrink-0 group relative rounded-full inline-flex items-center justify-center h-5 w-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-300 ${props.className}`}
      onClick={props.onClick}
      onKeyDown={(e) => {
        if (props.onClick && (e.key === "Enter" || e.key === " ")) {
          props.onClick();
          e.preventDefault();
        }
      }}
    >
      <span
        aria-hidden="true"
        className={`${
          props.isToggled ? "bg-primary-500" : "bg-gray-200"
        } absolute h-4 w-9 mx-auto rounded-full transition-colors ease-in-out duration-200`}
      ></span>
      <span
        aria-hidden="true"
        className={`${
          props.isToggled ? "translate-x-0" : "translate-x-5"
        }  absolute left-0 inline-block h-5 w-5 border border-gray-200 rounded-full bg-white shadow transform ring-0 transition-transform ease-in-out duration-200`}
      ></span>
    </button>
  );
}
