import React, { FunctionComponent, ReactNode } from "react";

interface WarningProps {
  disabled?: boolean;
  className?: string;
  level?: "info" | "warning" | "error";
  children?: ReactNode;
}

const Warning: FunctionComponent<WarningProps> = ({
  className,
  children,
  disabled,
  level,
}) => {
  let borderColor = "border-yellow-400";
  let bgColor = "bg-yellow-50";
  let svgColor = "text-yellow-400";
  let textColor = "text-yellow-700";
  if (disabled) {
    borderColor = "border-gray-400";
    bgColor = "bg-gray-50";
    svgColor = "text-gray-400";
    textColor = "text-gray-700";
  } else if (level === "error") {
    borderColor = "border-red-400";
    bgColor = "bg-red-50";
    svgColor = "text-red-400";
    textColor = "text-red-700";
  } else if (level === "info") {
    borderColor = "border-primary-300";
    bgColor = "bg-white";
    svgColor = "text-primary-500";
    textColor = "text-gray-800";
  }

  return (
    <div
      className={`${borderColor} ${bgColor} border-l-4 p-4 mt-2 ${className}`}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          {level === "info" ? (
            <Info className={svgColor} />
          ) : level === "error" ? (
            <ErrorIcon className={svgColor} />
          ) : (
            <Exclamation className={svgColor} />
          )}
        </div>
        <div className="ml-3">
          <p className={`text-sm leading-5 ${textColor}`}>{children}</p>
        </div>
      </div>
    </div>
  );
};

function Info(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      className={`h-5 w-5 ${props.className}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function Exclamation(props: { className?: string }) {
  return (
    <svg
      className={`h-5 w-5 ${props.className}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ErrorIcon(props: { className?: string }) {
  return (
    <svg
      className={`h-5 w-5 ${props.className}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default Warning;
