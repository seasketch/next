import {
  Metric,
  MetricTypeMap,
  SourceType,
  subjectIsFragment,
} from "overlay-engine";
import { LocalMetric, useReportContext } from "../ReportContext";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  MetricSourceType,
  SpatialMetricDependency,
  SpatialMetricState,
} from "../../generated/graphql";

let idCounter = 0;

function createStableId() {
  if (idCounter === Number.MAX_SAFE_INTEGER) {
    idCounter = 0;
  }
  return idCounter++;
}

/**
 * useMetrics provides an interface for Report Cards to request the data they
 * need in order to render and visualize results. useMetrics will register these
 * metric dependencies with the ReportContext, which will take responsibility
 * for retrieving those metrics from the SeaSketch app server (or using web
 * workers someday when we support offline reports).
 *
 * @param options
 * @returns
 */
export function useMetrics<
  T extends keyof MetricTypeMap | Metric["type"]
>(options: {
  type: T;
  geographyIds?: number[];
  includeSiblings?: boolean;
  layers?: {
    stableId: string;
    groupBy?: string;
    sourceUrl: string;
    sourceType: SourceType;
  }[];
}) {
  const reportContext = useReportContext();

  // Create a stable numeric ID that never changes for this hook instance
  const stableId = useRef(createStableId()).current;

  useEffect(() => {
    if (!reportContext.sketch?.id) {
      return;
    }

    const dependencies: SpatialMetricDependency[] = [];
    // Create a dependency object that matches SpatialMetricDependency
    if (Array.isArray(options.layers) && options.layers.length > 0) {
      for (const layer of options.layers) {
        dependencies.push({
          type: options.type,
          sketchId: reportContext.sketch?.id,
          geographyIds: options.geographyIds || [],
          includeSiblings: options.includeSiblings || false,
          stableId: layer.stableId,
          groupBy: layer.groupBy,
          sourceUrl: layer.sourceUrl,
          sourceType: convertSourceType(layer.sourceType),
        });
      }
    } else {
      dependencies.push({
        type: options.type,
        sketchId: reportContext.sketch?.id,
        geographyIds: options.geographyIds || [],
        includeSiblings: options.includeSiblings || false,
      });
    }

    for (const dependency of dependencies) {
      reportContext.addMetricDependency(stableId, dependency);
    }

    // Cleanup function to remove the dependency when the component unmounts
    return () => {
      for (const dependency of dependencies) {
        reportContext.removeMetricDependency(stableId, dependency);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.type,
    options.geographyIds,
    options.includeSiblings,
    stableId,
    reportContext.sketch?.id,
  ]);

  const fragmentIds = useMemo(() => {
    return reportContext.relatedFragments.map((f) => f.hash);
  }, [reportContext.relatedFragments]);

  const data = useMemo(() => {
    return reportContext.metrics.filter((m) => {
      if (m.type !== options.type) {
        return false;
      }
      if (subjectIsFragment(m.subject)) {
        if (!fragmentIds.includes(m.subject.hash)) {
          return false;
        }
      } else {
        if (!(options.geographyIds || []).includes(m.subject.id)) {
          return false;
        }
      }
      // check for matching stableId, groupBy, etc.
      if (options.layers) {
        // check that the metric matches one of the layers
        const matchingLayer = options.layers.find((l) => {
          return (
            l.stableId === m.stableId && matchingGroupBy(l.groupBy, m.groupBy)
          );
        });
        if (!matchingLayer) {
          return false;
        }
      }
      return true;
    });
  }, [reportContext.metrics, fragmentIds, options]);

  const errors = useMemo(() => {
    const errors = data
      .filter((m) => m.state === SpatialMetricState.Error)
      .map((m) => m.errorMessage || "Unknown error");

    return errors;
  }, [data]);

  return {
    data: data as unknown as MetricTypeMap[T][] &
      Pick<LocalMetric, "id" | "state" | "errorMessage">[],
    loading:
      // data.length === 0 ||
      data.filter((m) => m.state !== SpatialMetricState.Complete).length > 0,
    errors,
  };
}

function convertSourceType(sourceType: SourceType): MetricSourceType {
  switch (sourceType.toUpperCase()) {
    case "FLAT_GEOBUF":
      return MetricSourceType.FlatGeobuf;
    case "GEOJSON":
      return MetricSourceType.GeoJson;
    case "GEOTIFF":
      return MetricSourceType.GeoTiff;
    case "REPORTING_FLATGEOBUF_V1":
      return MetricSourceType.FlatGeobuf;
    default:
      throw new Error(`Unknown source type: ${sourceType}`);
  }
}

function matchingGroupBy(
  layerGroupBy: string | undefined | null,
  metricGroupBy: string | undefined | null
): boolean {
  if (layerGroupBy === metricGroupBy) {
    return true;
  } else if (
    Boolean(layerGroupBy) === false &&
    Boolean(metricGroupBy) === false
  ) {
    return true;
  } else {
    return false;
  }
}
