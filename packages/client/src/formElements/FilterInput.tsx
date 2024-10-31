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
    <div>
      <fieldset>
        <legend>
          <Trans ns="sketching">Select cells where this property is</Trans>
        </legend>

        <div>
          <input
            type="radio"
            id="true"
            name="true"
            value="true"
            checked={value === true}
            onChange={handleChange}
          />
          <label htmlFor="true">
            <Trans ns="sketching">True</Trans> (
            {metadata.values["true"].toLocaleString()})
          </label>
        </div>

        <div>
          <input
            type="radio"
            id="false"
            name="false"
            value="false"
            checked={value === false}
            onChange={handleChange}
          />
          <label htmlFor="false">
            <Trans ns="sketching">False</Trans> (
            {metadata.values["false"].toLocaleString()})
          </label>
        </div>
      </fieldset>
    </div>
  );
}
