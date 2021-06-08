import React, { useState, useEffect, KeyboardEvent } from "react";

export interface TextInputOptions {
  /** Required id of input. Also referenced by labels. */
  id: string;
  /** This is a _controlled_ input so a value is required. */
  value: string;
  /** Label displayed above the input */
  label: string;
  /** Appears below the label */
  description?: string | React.ReactNode;
  /** Validation error */
  error?: string;
  placeholder?: string;
  required?: boolean;
  state?: "SAVING" | "SAVED" | "NONE";
  disabled?: boolean;
  onChange?: (value: string) => any;
  inputChildNode?: React.ReactNode;
  autoFocus?: boolean;
  onKeyDown?: (e: KeyboardEvent) => void;
  type?: "text" | "email";
}

export default function TextInput(props: TextInputOptions) {
  const {
    id,
    value,
    error,
    placeholder,
    label,
    required,
    disabled,
    description,
    onChange,
    state,
    onKeyDown,
    type,
  } = props;
  const [showSaved, setShowSaved] = useState(true);
  useEffect(() => {
    if (state === "SAVED" && showSaved) {
      const timeout = setTimeout(() => {
        setShowSaved(false);
      }, 1000);
      return () => {
        clearTimeout(timeout);
      };
    } else if (state !== "SAVED") {
      setShowSaved(true);
    }
  }, [state]);

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium leading-5 text-gray-700"
      >
        {label}
        {/* {required && " *"} */}
      </label>

      <div className="mt-1 relative rounded-md shadow-sm">
        <input
          autoFocus={!!props.autoFocus}
          type={props.type || "text"}
          id={id}
          onKeyDown={onKeyDown}
          onChange={(e) => onChange && onChange(e.target.value)}
          disabled={disabled}
          required={required}
          className={`block w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 ${
            error || state === "SAVING" || (state === "SAVED" && showSaved)
              ? `pr-10`
              : `pr-4`
          } ${
            error &&
            "border-red-300 text-red-900 placeholder-red-300 focus:border-red-300 focus:shadow-outline-red"
          } ${disabled && "text-gray-500 bg-gray-100"}`}
          placeholder={placeholder}
          value={value}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : ""}
        />
        {props.inputChildNode}

        <div
          className={`absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none transition-opacity duration-500 ${
            state && state === "SAVING" ? "opacity-100" : "opacity-0"
          }`}
        >
          <svg
            className="animate-spin h-5 w-5 text-gray-500 opacity-25"
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

        <div
          className={`absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none transition-opacity duration-500 ${
            state && state === "SAVED" && showSaved
              ? "opacity-100"
              : "opacity-0"
          }`}
        >
          <svg
            className="h-5 w-5 text-primary-500"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        {error && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600" id={`${id}-error`}>
          {error}
        </p>
      )}
      {description && (
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      )}
    </div>
  );
}
