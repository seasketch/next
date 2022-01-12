// import Color from "color";
import React, { CSSProperties, useState, useEffect } from "react";
import { Link, useHistory } from "react-router-dom";
import { colord, extend } from "colord";
import { ChevronDownIcon } from "@heroicons/react/outline";

export interface ButtonProps {
  /** DOM Attribute */
  name?: string;
  /* Disables user interaction */
  disabled?: boolean;
  /* Event handler */
  onClick?: () => void;
  /* Text label for the button */
  label: string | React.ReactNode;
  /* Primary action. Uses a darker color */
  primary?: boolean;
  /* Override default styles */
  className?: string;
  /* Displays a loading indicator */
  loading?: boolean;
  /** Render a <label /> with htmlFor set */
  labelFor?: string;
  /* Id for targetting specific buttons */
  id?: string;
  href?: string;
  mailTo?: string;
  children?: React.ReactNode;
  autofocus?: boolean;
  /* Override default styles on button */
  buttonClassName?: string;
  small?: boolean;
  title?: string;
  innerRef?: React.MutableRefObject<any>;
  type?: "submit" | "button" | "reset";
  /* hex or rgb */
  backgroundColor?: string;
  shadowSize?: "shadow-sm" | "shadow" | "shadow-md" | "shadow-lg" | "shadow-xl";
  segmentItems?: string[];
  onSegmentClick?: (index: number) => void;
}

export default function Button(props: ButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const fn = () => {
      setDropdownOpen(false);
    };
    if (dropdownOpen) {
      document.body.addEventListener("click", fn);
    }
    return () => document.body.removeEventListener("click", fn);
  }, [dropdownOpen]);

  let C = (props: any) => <div {...props} />;
  const history = useHistory();
  let onClick = props.onClick;
  if (props.href) {
    let href = props.href;
    if (props.mailTo) {
      // eslint-disable-next-line i18next/no-literal-string
      href = `mailto:${props.mailTo}`;
    }
    C = (props) => <Link {...props} to={href} />;
  }
  // if (props.href) {
  //   onClick = () => {
  //     history.push(props.href!);
  //   };
  // }
  // if (props.mailTo) {
  //   onClick = () => {
  //     // eslint-disable-next-line i18next/no-literal-string
  //     window.location.href = `mailto:${props.mailTo}`;
  //   };
  // }
  let label: string | React.ReactNode = props.label;
  if (props.children) {
    label = props.children;
  }
  // eslint-disable-next-line i18next/no-literal-string
  const buttonClassName = `select-none ${
    props.disabled
      ? "opacity-75 pointer-events-none"
      : props.loading
      ? "pointer-events-none"
      : "cursor-pointer"
  } inline-flex items-center ${
    props.small ? "px-2 py-0.5" : "px-4 py-2"
  } border border-gray-300 text-sm leading-5 font-medium ${
    props.small ? "rounded" : "rounded-md"
  } ${
    props.primary
      ? // eslint-disable-next-line i18next/no-literal-string
        `btn-primary text-white bg-primary-500 focus:outline-none focus:border-primary-600 focus:shadow-outline-blue active:bg-primary-600`
      : // eslint-disable-next-line i18next/no-literal-string
        `text-gray-700 ${
          props.disabled ? "bg-gray-100" : "bg-white"
        } hover:text-gray-500 focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50`
  } focus:outline-none  transition ease-in-out duration-150 ${
    props.segmentItems && "pr-10"
  }`;
  const spinner = (
    <div
      className={`ml-3 inline-block inset-y-0 items-center pointer-events-none transition-opacity duration-500 opacity-50`}
    >
      <svg
        className={`animate-spin h-5 w-5 ${
          props.primary ? "text-white" : "text-gray-500"
        }`}
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

  let style: CSSProperties = {};
  if (props.backgroundColor) {
    const bg = colord(props.backgroundColor);
    // eslint-disable-next-line i18next/no-literal-string
    style.background = `linear-gradient(180deg, ${
      props.backgroundColor
    } 50%, ${bg.darken(0.1).saturate(0.1).toHex()} 100%)`;
    // style.backgroundColor = props.backgroundColor;
    if (bg.isDark()) {
      style.color = "white";
    } else {
      style.color = "black";
    }

    style.border = "none";
  }

  return (
    <C
      title={props.title}
      className={`inline-flex relative ${props.shadowSize || "shadow-sm"} ${
        props.className
      }`}
      onClick={props.disabled ? undefined : onClick}
      id={props.id}
    >
      {props.labelFor ? (
        <label
          htmlFor={props.labelFor}
          className={`${buttonClassName} ${props.buttonClassName}`}
        >
          {label}
          {props.loading && spinner}
        </label>
      ) : (
        <button
          name={props.name}
          type={props.type || "button"}
          ref={props.innerRef}
          autoFocus={props.autofocus}
          className={`${buttonClassName} ${props.buttonClassName}`}
          style={style}
        >
          {label}
          {props.loading && spinner}
          {props.segmentItems && (
            <div
              className="border-l border-black border-opacity-10 pr-2 absolute right-0 top-0 pl-2 h-9 hover:bg-black hover:bg-opacity-5 flex items-center rounded-r"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDropdownOpen(!dropdownOpen);
              }}
            >
              <ChevronDownIcon className="w-4 h-4" />
              {dropdownOpen && (
                <nav className="bg-white rounded shadow absolute right-0 top-full mt-2 z-10 w-content overflow-hidden">
                  {props.segmentItems.map((i, n) => (
                    <div
                      className="px-4 py-3 text-sm font-light hover:bg-gray-100 whitespace-nowrap text-left"
                      key={i}
                      onClick={() => {
                        if (props.onSegmentClick) {
                          props.onSegmentClick(n);
                        }
                      }}
                    >
                      {i}
                    </div>
                  ))}
                </nav>
              )}
            </div>
          )}
        </button>
      )}
    </C>
  );
}
