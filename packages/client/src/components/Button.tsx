import React from "react";
import { useHistory } from "react-router-dom";

export interface ButtonProps {
  /* Disables user interaction */
  disabled?: boolean;
  /* Event handler */
  onClick?: () => void;
  /* Text label for the button */
  label: string;
  /* Primary action. Uses a darker color */
  primary?: boolean;
  /* Override default styles */
  className?: string;
  /* Displays a loading indicator */
  loading?: boolean;
  /** Render a <label /> with htmlFor set */
  labelFor?: string;
  href?: string;
  children?: React.ReactNode;
}

export default function Button(props: ButtonProps) {
  const history = useHistory();
  let onClick = props.onClick;
  if (props.href) {
    onClick = () => {
      history.push(props.href!);
    };
  }
  let label: string | React.ReactNode = props.label;
  if (props.children) {
    label = props.children;
  }
  const buttonClassName = `select-none ${
    props.disabled
      ? "opacity-75 pointer-events-none"
      : props.loading
      ? "pointer-events-none"
      : "cursor-pointer"
  } inline-flex items-center px-4 py-2 border border-gray-300 text-sm leading-5 font-medium rounded-md ${
    props.primary
      ? `text-white bg-primary-500 focus:outline-none focus:border-primary-600 focus:shadow-outline-blue active:bg-primary-600`
      : `text-gray-700 ${
          props.disabled ? "bg-gray-100" : "bg-white"
        } hover:text-gray-500 focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50`
  } focus:outline-none  transition ease-in-out duration-150`;
  const spinner = (
    <div
      className={`ml-3 inline-block inset-y-0 items-center pointer-events-none transition-opacity duration-500 opacity-50`}
    >
      <svg
        className="animate-spin h-5 w-5 text-gray-500"
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
  return (
    <span
      className={`inline-flex rounded-md shadow-sm ${props.className}`}
      onClick={props.disabled ? undefined : onClick}
    >
      {props.labelFor ? (
        <label htmlFor={props.labelFor} className={buttonClassName}>
          {label}
          {props.loading && spinner}
        </label>
      ) : (
        <button className={buttonClassName}>
          {label}
          {props.loading && spinner}
        </button>
      )}
    </span>
  );
}
