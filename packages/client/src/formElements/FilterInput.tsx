import { CheckIcon, FilterIcon } from "@heroicons/react/outline";
import {
  ChangeEventHandler,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import EditableResponseCell from "../admin/surveys/EditableResponseCell";
import Badge from "../components/Badge";
import Button from "../components/Button";
import InputBlock from "../components/InputBlock";
import Switch from "../components/Switch";
import useDialog from "../components/useDialog";
import {
  FormElementBody,
  FormElementComponent,
  FormElementEditorPortal,
  FormLanguageContext,
} from "./FormElement";
import { questionBodyFromMarkdown } from "./fromMarkdown";
import {
  GeostatsAttribute,
  NumericGeostatsAttribute,
} from "@seasketch/geostats-types";
import * as Slider from "@radix-ui/react-slider";

export type FilterGeostatsAttribute = Pick<
  GeostatsAttribute,
  "attribute" | "type" | "max" | "min" | "values"
> & {
  stats?: Pick<
    NumericGeostatsAttribute["stats"],
    "avg" | "stdev" | "histogram"
  >;
};

export type FilterServiceMetadata = {
  version: number;
  attributes: FilterGeostatsAttribute[];
};

export type FilterInputProps = {
  attribute: string;
};
export type FilterInputValue = {
  selected: boolean;
  numberState?: {
    min?: number;
    max?: number;
  };
  stringState?: string[];
  booleanState?: boolean;
};

const FilterInput: FormElementComponent<FilterInputProps, FilterInputValue> = (
  props
) => {
  const { t } = useTranslation("surveys");
  const { error, loading, metadata, setState } = useFilterContext(
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
      if (setState) {
        setState((prev) => {
          return {
            ...prev,
            ...value,
          };
        });
      }
    },
    [props.onChange, props.value, setState]
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
          className="transform scale-75"
          isToggled={Boolean(props.value?.selected)}
          onClick={(val) => {
            handleChange({
              selected: val,
            });
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

export const FilterInputServiceContext = createContext<{
  metadata?: FilterServiceMetadata;
  loading: boolean;
  error?: Error;
  getAttributeDetails: (attribute: string) => null | FilterGeostatsAttribute;
  filterState: { [key: string]: FilterInputValue };
  setFilterState: (
    attribute: string,
    setter: (prev: FilterInputValue) => FilterInputValue
  ) => void;
}>({
  loading: false,
  getAttributeDetails: () => null,
  filterState: {},
  setFilterState: () => {},
});

export function FilterInputServiceContextProvider({
  children,
  serviceLocation,
}: {
  children: React.ReactNode;
  serviceLocation?: string;
}) {
  const [state, setState] = useState<{
    metadata?: FilterServiceMetadata;
    loading: boolean;
    error?: Error;
    filterState: { [key: string]: FilterInputValue };
  }>({ loading: false, filterState: {} });

  const getAttributeDetails = useCallback(
    (attribute: string) => {
      return (
        state.metadata?.attributes.find((a) => a.attribute === attribute) ||
        null
      );
    },
    [state.metadata]
  );

  useEffect(() => {
    if (!serviceLocation) {
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));
    fetch(`${serviceLocation.replace(/\/$/, "")}/metadata`)
      .then((res) => res.json())
      .then((metadata: FilterServiceMetadata) => {
        setState((prev) => ({ ...prev, metadata, loading: false }));
      })
      .catch((error) => {
        setState((prev) => ({ ...prev, error, loading: false }));
      });
  }, [serviceLocation]);

  const value = useMemo(() => {
    return {
      ...state,
      getAttributeDetails,
      setFilterState: (
        attribute: string,
        setter: (prev: FilterInputValue) => FilterInputValue
      ) => {
        setState((prev) => ({
          ...prev,
          filterState: {
            ...prev.filterState,
            [attribute]: setter(prev.filterState[attribute] || {}),
          },
        }));
      },
    };
  }, [state, getAttributeDetails]);

  return (
    <FilterInputServiceContext.Provider value={value}>
      {children}
    </FilterInputServiceContext.Provider>
  );
}

function useFilterContext(attribute: string) {
  const context = useContext(FilterInputServiceContext);
  const metadata = context.getAttributeDetails(attribute);
  return {
    metadata,
    setState: (setter: (prev: FilterInputValue) => FilterInputValue) =>
      context.setFilterState(attribute, setter),
    state: context.filterState[attribute],
    loading: context.loading,
    error: context.error,
  };
}

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
            id="true"
            name="true"
            value="true"
            checked={value === true}
            onChange={handleChange}
          />
          <label htmlFor="true" className="cursor-pointer">
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
            id="false"
            name="false"
            value="false"
            checked={value === false}
            onChange={handleChange}
          />
          <label htmlFor="false" className="cursor-pointer">
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
          min={metadata.min || 0}
          max={metadata.max || 1}
        />
      )}
      <Slider.Root
        className="relative flex items-center select-none touch-none w-full h-5 -top-1.5"
        value={[value[0] || min, value[1] || max]}
        max={max}
        min={min}
        step={(max - min) / 100}
        onValueChange={onChange}
      >
        <Slider.Track className="bg-blackA7 relative grow rounded-full h-[3px]">
          <Slider.Range className="absolute bg-white rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb
          className="block w-3 h-3 bg-primary-500 shadow-[0_2px_10px] shadow-blackA4 rounded-[10px] hover:bg-violet3 focus:outline-none focus:shadow-[0_0_0_5px] focus:shadow-blackA5"
          aria-label="Volume"
        />
        <Slider.Thumb
          className="block w-3 h-3 bg-primary-500 shadow-[0_2px_10px] shadow-blackA4 rounded-[10px] hover:bg-violet3 focus:outline-none focus:shadow-[0_0_0_5px] focus:shadow-blackA5"
          aria-label="Volume"
        />
      </Slider.Root>
      <div className="flex bg-black -mt-2">
        <input className="bg-black" type="number" value={value[0]} max={max} />
        <input className="bg-black" type="number" value={value[1]} min={min} />
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
              d[0] && d[0] >= props.min && d[0] <= props.max
                ? "bg-primary-300"
                : "bg-primary-900"
            }
            style={{ height, width: "2%" }}
          ></div>
        );
      })}
    </div>
  );
}
