import {
  GeostatsAttribute,
  NumericGeostatsAttribute,
} from "@seasketch/geostats-types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { FilterLayerManager } from "./FilterLayerManager";
import { MapContext } from "../dataLayers/MapContextManager";
import { FormElementDetailsFragment } from "../generated/graphql";

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

export type FilterInputValue = {
  selected: boolean;
  numberState?: {
    min?: number;
    max?: number;
  };
  stringState?: string[];
  booleanState?: boolean;
};

export const FilterInputServiceContext = createContext<{
  metadata?: FilterServiceMetadata;
  loading: boolean;
  error?: Error;
  getAttributeDetails: (attribute: string) => null | FilterGeostatsAttribute;
}>({
  loading: false,
  getAttributeDetails: () => null,
});

export function FilterInputServiceContextProvider({
  children,
  serviceLocation,
  startingProperties,
  formElements,
}: {
  children: React.ReactNode;
  serviceLocation?: string;
  startingProperties?: { [key: string]: FilterInputValue };
  formElements: Pick<
    FormElementDetailsFragment,
    "id" | "componentSettings" | "typeId"
  >[];
}) {
  const [state, setState] = useState<{
    metadata?: FilterServiceMetadata;
    loading: boolean;
    error?: Error;
  }>({
    loading: false,
  });

  const mapContext = useContext(MapContext);

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
        setState((prev) => {
          return {
            ...prev,
            metadata,
            loading: false,
          };
        });
      })
      .catch((error) => {
        setState((prev) => ({ ...prev, error, loading: false }));
      });
  }, [serviceLocation]);

  const [filterLayerManager, setFilterLayerManager] = useState<
    FilterLayerManager | undefined
  >();

  useEffect(() => {
    if (mapContext.manager && state.metadata && serviceLocation) {
      const mngr = new FilterLayerManager(
        serviceLocation,
        state.metadata,
        mapContext.manager,
        filterStateToSearchString(startingProperties || {})
      );
      setFilterLayerManager(mngr);
      return () => {
        mngr.destroy();
      };
    }
  }, [mapContext.manager, state.metadata, serviceLocation]);

  const value = useMemo(() => {
    return {
      ...state,
      getAttributeDetails,
    };
  }, [state, getAttributeDetails]);

  useEffect(() => {
    if (startingProperties && state.metadata) {
      if (filterLayerManager) {
        filterLayerManager.updateFilter(
          filterStateToSearchString(
            filterDefaults(
              initialFilterState(startingProperties, formElements),
              state.metadata
            )
          )
        );
      }
    }
  }, [startingProperties, state.metadata, filterLayerManager, formElements]);

  return (
    <FilterInputServiceContext.Provider value={value}>
      {children}
    </FilterInputServiceContext.Provider>
  );
}

export function useFilterContext(attribute: string) {
  const context = useContext(FilterInputServiceContext);
  const metadata = context.getAttributeDetails(attribute);
  return {
    metadata,
    loading: context.loading,
    error: context.error,
  };
}

type FilterState = { [key: string]: FilterInputValue };

/**
 * References attributes.json to determine if filter state is matching defaults.
 * If so, the filter state should be simplified or removed from the filtered
 * state.
 * For example, if a number filter is set to a threshold minimum but the maximum
 * is just set to the maximum in the attributes data, remove the max setting.
 * @param filterParams FilterState
 * @returns FilterState
 */
function filterDefaults(
  filterParams: FilterState,
  metadata: FilterServiceMetadata
): FilterState {
  const attributes = metadata.attributes;
  const output: FilterState = {};
  for (const key in filterParams) {
    const attr = attributes.find((a) => a.attribute === key);
    const state = filterParams[key];
    if (!attr) {
      throw new Error(`Attribute ${key} not found in metadata`);
    }
    if (!state.selected) {
      continue;
    }
    if (attr.type === "number") {
      const filter = state.numberState;
      if (!filter) {
        continue;
      }
      if (filter.min !== attr.min && filter.max !== attr.max) {
        output[key] = state;
      } else if (filter.min !== attr.min) {
        output[key] = {
          ...state,
          numberState: {
            min: filter.min,
          },
        };
      } else if (filter.max !== attr.max) {
        output[key] = {
          ...state,
          numberState: {
            max: filter.max,
          },
        };
      } else {
        continue;
      }
    } else if (attr.type === "string") {
      const filter = state.stringState;
      if (!filter) {
        continue;
      }
      if (
        filter.length &&
        filter.length !== Object.keys(attr.values || {}).length
      ) {
        output[key] = state;
      }
    } else if (attr.type === "boolean") {
      const filter = state.booleanState;
      if (filter !== undefined) {
        output[key] = state;
      }
    }
  }
  return output;
}

export function filterStateToSearchString(filters: FilterState) {
  const state: {
    [attribute: string]:
      | {
          min?: number;
          max?: number;
        }
      | { choices: string[] }
      | { bool: boolean };
  } = {};
  for (const attr in filters) {
    const filter = filters[attr];
    if (filter.selected) {
      if ("numberState" in filter) {
        state[attr] = filter.numberState!;
      } else if ("stringState" in filter) {
        state[attr] = { choices: filter.stringState || [] };
      } else if (
        "booleanState" in filter &&
        filter.booleanState !== undefined
      ) {
        state[attr] = { bool: filter.booleanState || false };
      }
    }
  }
  if (Object.keys(state).length === 0) {
    return "";
  } else {
    // eslint-disable-next-line i18next/no-literal-string
    return encodeURIComponent(JSON.stringify(state));
  }
}

function initialFilterState(
  values: {
    [key: string]: FilterInputValue;
  },
  formElements: Pick<
    FormElementDetailsFragment,
    "id" | "componentSettings" | "typeId"
  >[]
): FilterState {
  const state: FilterState = {};
  if (!values) {
    return {};
  } else {
    for (const key in values) {
      const element = formElements.find((e) => e.id === parseInt(key));
      if (
        values[key] &&
        element?.typeId === "FilterInput" &&
        element.componentSettings?.attribute
      ) {
        const value = values[key];
        if (
          value.selected &&
          ("numberState" in value ||
            "stringState" in value ||
            "booleanState" in value)
        ) {
          state[element.componentSettings.attribute] = value;
        }
      }
    }
  }
  return state;
}