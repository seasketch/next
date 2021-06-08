import React from "react";

export default function Spinner(props: {
  svgClassName?: string;
  className?: string;
  style?: React.CSSProperties;
  color?: "white" | "grey";
  large?: boolean;
  mini?: boolean;
}) {
  return (
    <div
      style={props.style}
      className={`ml-3 inline-block inset-y-0 items-center pointer-events-none transition-opacity duration-500 opacity-50 ${props.className}`}
    >
      <svg
        className={`animate-spin ${
          props.large ? "h-8 w-8" : props.mini ? "h-3 w-3" : "h-5 w-5"
        } ${props.color === "white" ? "text-white" : "text-gray-500"}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </div>
  );
}
