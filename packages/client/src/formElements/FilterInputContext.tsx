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
import useDebounce from "../useDebounce";

// TODO: this should be derived from the metadata once the service is updated
export type Stop = {
  h3Resolution: number;
  zoomLevel: number;
  gridSize: number;
};

/**
 * These stops represent the zoom levels at which each h3 resolution should be
 * displayed. The algorithm will fill in the gaps, starting at the highest zoom
 * level and working its way down to MIN_ZOOM.
 */
export const stops: Stop[] = [
  { h3Resolution: 11, zoomLevel: 14, gridSize: 44 },
  { h3Resolution: 10, zoomLevel: 13, gridSize: 116 },
  { h3Resolution: 9, zoomLevel: 12, gridSize: 306 },
  { h3Resolution: 8, zoomLevel: 10, gridSize: 810 },
  { h3Resolution: 7, zoomLevel: 8, gridSize: 2100 },
  { h3Resolution: 6, zoomLevel: 6, gridSize: 5700 },
].sort((a, b) => b.zoomLevel - a.zoomLevel);

export function zoomToStop(zoom: number, stops: Stop[]): Stop {
  let stop = stops[0];
  for (let i = 0; i < stops.length; i++) {
    if (zoom > stops[i].zoomLevel) {
      break;
    }
    stop = stops[i];
  }
  return stop;
}

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
  attribute: string;
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
  updatingCount: boolean;
  count: number;
  fullCellCount: number;
  stopInformation?: {
    resolution: number;
    area: number;
    unit: string;
  };
  opacity: number;
  setOpacity: (opacity: number) => void;
}>({
  loading: false,
  getAttributeDetails: () => null,
  updatingCount: true,
  count: 0,
  fullCellCount: 0,
  opacity: 1,
  setOpacity: () => {},
});

export function FilterInputServiceContextProvider({
  children,
  serviceLocation,
  startingProperties,
  formElements,
  skipMap,
}: {
  children: React.ReactNode;
  serviceLocation?: string;
  startingProperties?: { [key: string]: FilterInputValue };
  formElements: Pick<
    FormElementDetailsFragment,
    "id" | "componentSettings" | "typeId"
  >[];
  skipMap?: boolean;
}) {
  const [state, setState] = useState<{
    metadata?: FilterServiceMetadata;
    loading: boolean;
    error?: Error;
    updatingCount: boolean;
    count: number;
    fullCellCount: number;
    filterString: string;
    opacity: number;
  }>({
    loading: false,
    updatingCount: true,
    count: 0,
    fullCellCount: 0,
    filterString: "",
    opacity: 1,
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
          const count =
            // @ts-ignore
            metadata.attributes.find((a) => a.attribute === "id")?.count || 0;
          return {
            ...prev,
            metadata,
            loading: false,
            fullCellCount: count,
            count,
            updatingCount: false,
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
    if (mapContext.manager && state.metadata && serviceLocation && !skipMap) {
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

  const [zoom, setZoom] = useState(0);
  useEffect(() => {
    const map = mapContext.manager?.map;
    if (map) {
      const listener = () => {
        setZoom(map.getZoom());
      };
      map.on("zoom", listener);
      return () => {
        map.off("zoom", listener);
      };
    }
  }, [mapContext.manager?.map]);

  const stopInformation = useMemo(() => {
    const stop = zoomToStop(Math.floor(zoom), stops);
    return {
      resolution: stop.h3Resolution,
      area: stop.gridSize > 1000 ? stop.gridSize / 1000 : stop.gridSize,
      unit: stop.gridSize > 1000 ? "kilometer" : "meter",
    };
  }, [zoom]);

  const value = useMemo(() => {
    return {
      ...state,
      getAttributeDetails,
      stopInformation,
      setOpacity: (val: number) => {
        setState((prev) => ({
          ...prev,
          opacity: val,
        }));
        filterLayerManager?.setOpacity(val);
      },
    };
  }, [state, getAttributeDetails, stopInformation, filterLayerManager]);

  const debouncedStartingProperties = useDebounce(startingProperties, 100);

  useEffect(() => {
    if (debouncedStartingProperties && state.metadata) {
      if (filterLayerManager) {
        const filterString = filterStateToSearchString(
          filterDefaults(
            initialFilterState(debouncedStartingProperties, formElements),
            state.metadata
          )
        );
        filterLayerManager.updateFilter(filterString);
        if (filterString === state.filterString) {
          // do nothing
        } else if (filterString.length === 0) {
          setState((prev) => ({
            ...prev,
            updatingCount: false,
            count: prev.fullCellCount,
            filterString: "",
          }));
        } else if (serviceLocation) {
          setState((prev) => ({
            ...prev,
            updatingCount: true,
            filterString,
          }));
          fetch(
            `${serviceLocation.replace(/\/$/, "")}/count?filter=${filterString}`
          )
            .then((res) => res.json())
            .then((data) => {
              setState((prev) => ({
                ...prev,
                updatingCount: false,
                count: data.count,
              }));
            })
            .catch((error) => {
              setState((prev) => ({
                ...prev,
                updatingCount: false,
                error,
              }));
            });
        }
      }
    }
  }, [
    debouncedStartingProperties,
    state.metadata,
    filterLayerManager,
    formElements,
    serviceLocation,
  ]);

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
    if (filter && filter.selected) {
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
