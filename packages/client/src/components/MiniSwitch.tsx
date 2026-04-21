import React, { useEffect, useState } from "react";

export interface MiniSwitchProps {
  isToggled?: boolean;
  // disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function MiniSwitch(props: MiniSwitchProps) {
  const [enableTransitions, setEnableTransitions] = useState(false);

  useEffect(() => {
    setEnableTransitions(true);
  }, []);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!props.isToggled}
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
        } absolute h-4 w-9 mx-auto rounded-full ${
          enableTransitions
            ? "transition-colors ease-in-out duration-200"
            : ""
        }`}
      ></span>
      <span
        aria-hidden="true"
        className={`${
          props.isToggled ? "translate-x-5" : "translate-x-0"
        } absolute left-0 inline-block h-5 w-5 border border-gray-200 rounded-full bg-white shadow transform ring-0 ${
          enableTransitions
            ? "transition-transform ease-in-out duration-200"
            : ""
        }`}
      ></span>
    </button>
  );
}
