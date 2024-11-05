import { FilterIcon } from "@heroicons/react/outline";
import { ChangeEventHandler, useCallback, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import Switch from "../components/Switch";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import * as Slider from "@radix-ui/react-slider";
import {
  FilterGeostatsAttribute,
  FilterInputValue,
  useFilterContext,
} from "./FilterInputContext";

export type FilterInputProps = {
  attribute: string;
};

const FilterInput: FormElementComponent<FilterInputProps, FilterInputValue> = (
  props
) => {
  const { t } = useTranslation("surveys");
  const { error, loading, metadata } = useFilterContext(
    props.componentSettings.attribute
  );

  const handleChange = useCallback(
    (value: Partial<FilterInputValue>) => {
      const newState = {
        ...(props.value as FilterInputValue),
        ...value,
      } as FilterInputValue;
      if (props.onChange) {
        props.onChange(newState, false, false);
      }
    },
    [props.onChange, props.value]
  );

  return (
    <>
      <div
        className="w-full flex items-center h-0 justify-end relative overflow-visible z-10 mt-2"
        style={{
          minHeight: 28,
        }}
      >
        {!Boolean(props.value?.selected) && (
          <div className="flex-1 prosemirror-body">
            <h1 data-question="yes">{props.body.content[0].content[0].text}</h1>
          </div>
        )}
        <Switch
          disabled={loading}
          className="transform scale-75"
          isToggled={Boolean(props.value?.selected)}
          onClick={(val) => {
            if (
              metadata?.type === "boolean" &&
              val === true &&
              !("booleanState" in (props.value || {}))
            ) {
              handleChange({
                selected: val,
                booleanState: true,
              });
            } else {
              handleChange({
                selected: val,
              });
            }
          }}
        />
      </div>

      <>
        {Boolean(props.value?.selected) && (
          <div style={{ marginTop: -10, marginBottom: 10 }}>
            <FormElementBody
              formElementId={props.id}
              isInput={true}
              body={props.body}
              required={props.isRequired}
              editable={props.editable && Boolean(props.value?.selected)}
              alternateLanguageSettings={props.alternateLanguageSettings}
            />
            {metadata?.type === "boolean" && (
              <BooleanInput
                metadata={metadata}
                value={props.value?.booleanState || false}
                onChange={(value) => {
                  handleChange({
                    booleanState: value === true,
                  });
                }}
              />
            )}
            {metadata?.type === "number" && (
              <NumberConfig
                metadata={metadata}
                value={[
                  props.value?.numberState?.min || metadata.min || 0,
                  props.value?.numberState?.max || metadata.max || 1,
                ]}
                onChange={(value) => {
                  handleChange({
                    numberState: {
                      min: value[0],
                      max: value[1],
                    },
                  });
                }}
              />
            )}
            {metadata?.type === "string" && (
              <StringConfig
                metadata={metadata}
                value={props.value?.stringState || []}
                onChange={(value) => {
                  handleChange({
                    stringState: value,
                  });
                }}
              />
            )}
          </div>
        )}

        {/* {props.value?.selected && (
          <div className="block sm:inline-block">
            <div className="py-4 pb-6 space-y-2 flex flex-col">
              {props.componentSettings.attribute}
            </div>
          </div>
        )} */}
      </>

      <FormElementEditorPortal
        render={(updateBaseSetting, updateComponentSetting) => {
          return <></>;
        }}
      />
    </>
  );
};

FilterInput.label = <Trans ns="admin:surveys">Filter Input</Trans>;
FilterInput.description = (
  <Trans ns="admin:surveys">Filter planning units by attribute</Trans>
);
FilterInput.defaultBody = questionBodyFromMarkdown(`
# 
`);
FilterInput.defaultComponentSettings = {
  attribute: "",
};
FilterInput.advanceAutomatically = false;

FilterInput.icon = () => (
  <div className="bg-blue-600 w-full h-full font-bold text-center flex justify-center items-center  italic text-white">
    <FilterIcon className="w-5 h-5" />
  </div>
);

FilterInput.templatesOnly = true;

export default FilterInput;

export function BooleanInput({
  metadata,
  value,
  onChange,
}: {
  metadata: FilterGeostatsAttribute;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const handleChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (e) => {
      onChange(e.target.value === "true");
    },
    [onChange]
  );

  return (
    <div className="text-sm my-2">
      <fieldset>
        <legend className="mb-1">
          <Trans ns="sketching">Select cells where this property is</Trans>
        </legend>

        <div
          className={`flex w-48 space-x-2 items-center py-1 px-2 rounded border border-opacity-0 ${
            value === true
              ? "bg-blue-50 border-blue-200 border-opacity-100"
              : ""
          }`}
        >
          <input
            type="radio"
            id={metadata.attribute}
            name={metadata.attribute}
            value="true"
            checked={Boolean(value)}
            onChange={handleChange}
          />
          <label htmlFor={metadata.attribute} className="cursor-pointer">
            <Trans ns="sketching">True</Trans> (
            {metadata.values["true"].toLocaleString()})
          </label>
        </div>

        <div
          className={`flex w-48 space-x-2 items-center py-1 px-2 rounded border border-opacity-0 ${
            value === false
              ? "bg-blue-50 border-blue-200 border-opacity-100"
              : ""
          }`}
        >
          <input
            type="radio"
            id={metadata.attribute + "false"}
            name={metadata.attribute}
            value="false"
            checked={!Boolean(value)}
            onChange={handleChange}
          />
          <label
            htmlFor={metadata.attribute + "false"}
            className="cursor-pointer"
          >
            <Trans ns="sketching">False</Trans> (
            {metadata.values["false"].toLocaleString()})
          </label>
        </div>
      </fieldset>
    </div>
  );
}

export function NumberConfig({
  metadata,
  value,
  onChange,
}: {
  metadata: FilterGeostatsAttribute;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}) {
  const min = metadata.min || 0;
  const max = metadata.max || 1;
  return (
    <div>
      {/* histogram */}
      {metadata.stats?.histogram && (
        <Histogram
          data={metadata.stats?.histogram}
          min={value[0]}
          max={value[1]}
        />
      )}
      <Slider.Root
        className="relative flex items-center select-none touch-none w-full h-5 -top-1.5 -ml-1"
        value={[value[0] || min, value[1] || max]}
        max={max}
        min={min}
        step={(max - min) / 50}
        onValueChange={onChange}
      >
        <Slider.Track className="bg-black relative grow rounded-full h-1">
          <Slider.Range className="absolute bg-white rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb
          className="block w-3 h-3 bg-primary-300 shadow rounded-full hover:bg-primary-400 focus:outline-none -mt-0.5"
          aria-label="Min Value"
        />
        <Slider.Thumb
          className="block w-3 h-3 bg-primary-300 shadow rounded-full hover:bg-primary-400 focus:outline-none -mt-0.5"
          aria-label="Max Value"
        />
      </Slider.Root>
      <div className="flex bg-black -mt-2">
        <input
          className="bg-gray-100"
          type="number"
          value={value[0]}
          max={max}
        />
        <input
          className="bg-gray-100"
          type="number"
          value={value[1]}
          min={min}
        />
      </div>
    </div>
  );
}

function Histogram({
  data,
  ...props
}: {
  data: (number | null)[][];
  min: number;
  max: number;
}) {
  const max = useMemo(() => {
    return Math.max(...data.map((d) => d[1] || 0));
  }, [data]);

  return (
    <div className="w-full h-12 flex items-baseline mt-2">
      {data.map((d, i) => {
        // const value = d[0];
        const count = d[1];
        const height = count ? `${(count / max) * 100}%` : "0%";
        return (
          <div
            key={i}
            className={
              typeof d[0] === "number" && d[0] >= props.min && d[0] < props.max
                ? "bg-primary-500"
                : "bg-primary-500 bg-opacity-50"
            }
            style={{ height, width: "2%" }}
          ></div>
        );
      })}
    </div>
  );
}

export function StringConfig({
  value,
  metadata,
  onChange,
}: {
  metadata: FilterGeostatsAttribute;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div>
      <p className="text-xs py-2 text-gray-500">
        <Trans ns="sketching">
          Select options to limit cells to those with matching values
        </Trans>
      </p>
      <select
        onChange={(e) => {
          const values = Array.from(e.target.selectedOptions).map(
            (option) => option.value
          );
          onChange(values);
        }}
        multiple
        value={value || []}
        className="w-full text-sm p-2"
        style={{ height: Object.keys(metadata.values).length * 18 + 14 }}
      >
        {Object.keys(metadata.values).map((key) => (
          <option key={key} className="flex" value={key}>
            {key} - {/* eslint-disable-next-line i18next/no-literal-string */}
            {metadata.values[key].toLocaleString()} cells
          </option>
        ))}
      </select>
    </div>
  );
}
