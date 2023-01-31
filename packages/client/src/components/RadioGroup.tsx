import { MutationResult } from "@apollo/client";
import React, { ReactNode, useEffect, useState } from "react";
import { MutationStateIndicator } from "./MutationStateIndicator";

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
  return (
    <fieldset className={props.className}>
      <legend className="block text-sm font-medium leading-5 text-gray-700 mb-2 relative">
        {props.legend}
        <MutationStateIndicator
          state={props.state}
          error={Boolean(props.error)}
        />
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
