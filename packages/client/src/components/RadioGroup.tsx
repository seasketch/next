import { MutationResult } from "@apollo/client";
import React, { ReactNode, useEffect, useState } from "react";
import Spinner from "./Spinner";

interface RadioItem<T> {
  value: T;
  label: string;
  description?: string;
  children?: React.ReactNode;
}

interface RadioGroupProps<T> {
  items: RadioItem<T>[];
  onChange?: (value: T) => void;
  value: T;
  legend?: string | ReactNode;
  error?: string;
  state?: "SAVED" | "SAVING" | "NONE";
  className?: string;
}

export default function RadioGroup<T>(props: RadioGroupProps<T>) {
  const [showSaved, setShowSaved] = useState(true);
  const state = props.state || "NONE";
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
    <fieldset className={props.className}>
      <legend className="block text-sm font-medium leading-5 text-gray-700 mb-2 relative">
        {props.legend}
        <div
          className={`absolute inset-y-0 -mr-10 right-0 pr-3 flex items-center pointer-events-none transition-opacity duration-500 ${
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
          className={`absolute inset-y-0  -mr-10 right-0 pr-3 flex items-center pointer-events-none transition-opacity duration-500 ${
            state && state === "SAVED" && showSaved && !props.error
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
        {props.error && (
          <div className="absolute inset-y-0 -mr-10 right-0 pr-3 flex items-center pointer-events-none">
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
      </legend>

      {props.error && <p className="text-red-800">{props.error}</p>}
      <div className="bg-white rounded-md -space-y-px">
        {/* <!-- On: "bg-indigo-50 border-indigo-200 z-10", Off: "border-gray-200" --> */}
        {props.items.map((item, i) => (
          <div
            key={`radio-${i}`}
            className={`relative border ${
              i === 0
                ? "rounded-tl-md rounded-tr-md"
                : i === props.items.length - 1
                ? "rounded-bl-md rounded-br-md"
                : ""
            } p-4 flex ${
              props.value === item.value
                ? "bg-cool-gray-50 border-cool-gray-300 z-10"
                : "border-gray-200"
            }`}
          >
            <div className="flex items-center h-5">
              <input
                id={`${props.legend || ""}-item-${item.value}`}
                name={`${props.legend || ""}-item-${item.value}`}
                type="radio"
                className="focus:ring-blue-300 h-4 w-4 text-primary-500 cursor-pointer border-gray-300"
                checked={props.value === item.value}
                onChange={() => {
                  if (props.onChange) {
                    props.onChange(item.value);
                  }
                }}
              />
            </div>
            <label
              htmlFor={`${props.legend || ""}-item-${item.value}`}
              className="ml-3 flex flex-col cursor-pointer"
            >
              {/* <!-- On: "text-indigo-900", Off: "text-gray-900" --> */}
              <span className="block text-sm font-medium">{item.label}</span>
              {/* <!-- On: "text-indigo-700", Off: "text-gray-500" --> */}
              <span className="block text-sm text-gray-500">
                {item.description}
              </span>
              <div
                className="cursor-default"
                onClick={(e) => e.preventDefault()}
              >
                {item.children}
              </div>
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

interface MutableRadioGroupProps {
  mutate: (options: any) => Promise<any>;
  mutationStatus: MutationResult<any>;
  propName: string;
  /** variables that should always be assigned when calling mutation */
  variables?: any;
}

export function MutableRadioGroup<T>(
  props: MutableRadioGroupProps & RadioGroupProps<T>
) {
  const [state, setState] = useState<T>(props.value);
  useEffect(() => {
    if (!props.mutationStatus.loading && props.value !== state) {
      setState(props.value);
    }
  }, [props.value, props.mutationStatus]);

  return (
    <form>
      <RadioGroup
        value={state}
        items={props.items}
        legend={props.legend}
        onChange={(value) => {
          setState(value);
          props.mutate({
            variables: {
              ...props.variables,
              [props.propName]: value,
            },
          });
        }}
        error={props.mutationStatus.error?.message}
        state={
          props.mutationStatus.called
            ? props.mutationStatus.loading
              ? "SAVING"
              : "SAVED"
            : "NONE"
        }
      />
    </form>
  );
}
