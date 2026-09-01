import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  TemporalClock,
  TemporalInterval,
  TemporalPrecision,
} from "@seasketch/geostats-types";
import { MapManagerContext, MapOverlayContext } from "./MapContextManager";
import {
  VisibleTemporalSource,
  collectVisibleTemporalSources,
  coverageKey,
  domainForSources,
  instantClockForStep,
  reconcileClock,
  resolutionForSources,
  shouldShowTimeSlider,
  supportedViewResolutionsForSources,
  tocIdsHiddenByClock,
  viewResolutionsThatFit,
} from "./mapTemporal";

export type MapTemporalStateValue = {
  /**
   * True only under MapTemporalStateProvider. Stable for the life of a map
   * so MapboxMap can mount TimeSlider without subscribing to clock ticks.
   */
  enabled: boolean;
  /** null when the timeslider should be hidden. */
  clock: TemporalClock | null;
  domain: TemporalInterval | null;
  resolution: TemporalPrecision | null;
  availableResolutions: TemporalPrecision[];
  temporalSources: VisibleTemporalSource[];
  /** Filtered row counts per table + step, from the last `when.step` query. */
  queryStepCounts: { [tableStableId: string]: { [step: string]: number } };
  /** Distinct data-table `/query` errors for the current clock / resolution. */
  queryErrors: string[];
  setClock: (clock: TemporalClock) => void;
  setViewResolution: (resolution: TemporalPrecision) => void;
};

const noop = () => {};
const EMPTY_CLOCK_HIDDEN_TOC_IDS: string[] = [];

/** Stable boolean so MapboxMap can mount TimeSlider without clock updates. */
export const MapTemporalEnabledContext = createContext(false);

/**
 * Clock-hidden membership changes less often than the clock itself (and may
 * never change for feature/band time). Keep consumers such as the legend and
 * interactivity manager off the per-tick clock context.
 */
export const MapClockHiddenTocIdsContext = createContext<string[]>(
  EMPTY_CLOCK_HIDDEN_TOC_IDS
);

export const MapTemporalStateContext = createContext<MapTemporalStateValue>({
  enabled: false,
  clock: null,
  domain: null,
  resolution: null,
  availableResolutions: [],
  temporalSources: [],
  queryStepCounts: {},
  queryErrors: [],
  setClock: noop,
  setViewResolution: noop,
});

export default function MapTemporalStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const overlay = useContext(MapOverlayContext);
  const { manager } = useContext(MapManagerContext);
  const [clock, setClockState] = useState<TemporalClock | null>(null);
  const [userResolution, setUserResolution] =
    useState<TemporalPrecision | null>(null);
  const [queryStepCounts, setQueryStepCounts] = useState<{
    [tableStableId: string]: { [step: string]: number };
  }>({});
  const [queryErrors, setQueryErrors] = useState<string[]>([]);
  const previousIdsRef = useRef<string[]>([]);

  const temporalSources = useMemo(
    () =>
      collectVisibleTemporalSources(
        overlay.layerStatesByTocStaticId,
        overlay.tableOfContentsItems,
        overlay.dataLayers,
        overlay.dataSources
      ),
    [
      overlay.layerStatesByTocStaticId,
      overlay.tableOfContentsItems,
      overlay.dataLayers,
      overlay.dataSources,
    ]
  );

  const sourcesSignature = useMemo(
    () =>
      temporalSources
        .map(
          (source) =>
            // eslint-disable-next-line i18next/no-literal-string
            `${source.tocStableId}:${source.tableStableId || ""}:${coverageKey(
              source.temporal.coverage
            )}:${source.temporal.granularity}:${
              source.temporal.defaultViewResolution ||
              source.temporal.nativeResolution
            }`
        )
        .join(";"),
    [temporalSources]
  );

  const showSlider = useMemo(
    () => shouldShowTimeSlider(temporalSources),
    [temporalSources]
  );
  const domain = useMemo(
    () => (showSlider ? domainForSources(temporalSources) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showSlider, sourcesSignature]
  );
  const availableResolutions = useMemo(() => {
    if (!showSlider || !domain) return [];
    return viewResolutionsThatFit(
      domain,
      supportedViewResolutionsForSources(temporalSources)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSlider, domain, sourcesSignature]);
  const autoResolution = useMemo(
    () => (showSlider ? resolutionForSources(temporalSources) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showSlider, sourcesSignature]
  );
  const resolution = useMemo(() => {
    if (!showSlider) return null;
    if (userResolution && availableResolutions.indexOf(userResolution) !== -1) {
      return userResolution;
    }
    if (autoResolution && availableResolutions.indexOf(autoResolution) !== -1) {
      return autoResolution;
    }
    return availableResolutions[0] || autoResolution;
  }, [showSlider, userResolution, availableResolutions, autoResolution]);

  useEffect(() => {
    if (!showSlider || !domain || !resolution) {
      previousIdsRef.current = temporalSources.map((s) => s.tocStableId);
      setClockState(null);
      return;
    }
    const previousIds = previousIdsRef.current;
    setClockState((prev) =>
      reconcileClock(prev, domain, resolution, previousIds, temporalSources)
    );
    previousIdsRef.current = temporalSources.map((s) => s.tocStableId);
    // sourcesSignature stands in for temporalSources identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSlider, domain, resolution, sourcesSignature]);

  const nextClockHiddenTocIds = useMemo(
    () =>
      clock && showSlider
        ? tocIdsHiddenByClock(temporalSources, clock)
        : EMPTY_CLOCK_HIDDEN_TOC_IDS,
    [clock, showSlider, temporalSources]
  );
  const clockHiddenSignature = nextClockHiddenTocIds.join("\u0000");
  const clockHiddenTocIds = useMemo(
    () => nextClockHiddenTocIds,
    // Keep identity stable when the clock changes but hidden membership does
    // not. Consumers intentionally depend on the semantic signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clockHiddenSignature]
  );

  useEffect(() => {
    if (!manager) return;
    manager.setTemporallyFilteredTocItems(clockHiddenTocIds);
  }, [manager, clockHiddenTocIds]);

  useEffect(() => {
    if (!manager) return;
    manager.setTemporalClock(showSlider ? clock : null);
  }, [manager, showSlider, clock]);

  useEffect(() => {
    if (!manager) return;
    setQueryStepCounts(manager.getDataTableSeriesCounts());
    setQueryErrors(manager.getDataTableQueryErrors());
    manager.setOnDataTableSeriesCountsChange(setQueryStepCounts);
    manager.setOnDataTableQueryErrorsChange(setQueryErrors);
    return () => {
      manager.setOnDataTableSeriesCountsChange(null);
      manager.setOnDataTableQueryErrorsChange(null);
    };
  }, [manager]);

  useEffect(() => {
    return () => {
      manager?.setTemporallyFilteredTocItems([]);
    };
  }, [manager]);

  const setClock = useCallback((next: TemporalClock) => {
    setClockState(next);
  }, []);

  const setViewResolution = useCallback(
    (next: TemporalPrecision) => {
      setUserResolution(next);
      setClockState((prev) => {
        if (!domain) {
          return prev;
        }
        if (prev && prev.start) {
          return {
            ...prev,
            viewResolution: next,
            end:
              prev.mode === "window"
                ? prev.end
                : instantClockForStep(prev.start, next)?.end || prev.end,
          };
        }
        return reconcileClock(prev, domain, next, [], temporalSources);
      });
    },
    [domain, temporalSources]
  );

  const value = useMemo<MapTemporalStateValue>(
    () => ({
      enabled: true,
      clock: showSlider ? clock : null,
      domain: showSlider ? domain : null,
      resolution: showSlider ? resolution : null,
      availableResolutions: showSlider ? availableResolutions : [],
      temporalSources,
      queryStepCounts,
      queryErrors,
      setClock,
      setViewResolution,
    }),
    [
      showSlider,
      clock,
      domain,
      resolution,
      availableResolutions,
      temporalSources,
      queryStepCounts,
      queryErrors,
      setClock,
      setViewResolution,
    ]
  );

  return (
    <MapTemporalEnabledContext.Provider value={true}>
      <MapClockHiddenTocIdsContext.Provider value={clockHiddenTocIds}>
        <MapTemporalStateContext.Provider value={value}>
          {children}
        </MapTemporalStateContext.Provider>
      </MapClockHiddenTocIdsContext.Provider>
    </MapTemporalEnabledContext.Provider>
  );
}
