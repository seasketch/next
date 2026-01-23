import { hashMetricDependency, MetricDependency } from "overlay-engine";
import { createContext, useCallback, useEffect, useState } from "react";
import { CompatibleSpatialMetricDetailsFragment, useDraftReportDependenciesQuery } from "../generated/graphql";
import { extractMetricDependenciesFromReportBody, useReportContext } from "./ReportContext";
import { useGlobalErrorHandler } from "../components/GlobalErrorHandler";
import useDebounce from "../useDebounce";
import { ProsemirrorBodyJSON } from "./cards/cards";

export const DraftReportContext = createContext<{
  setDraftReportCardBody: (cardId: number, body: any) => void;
  clearDraftReportCardBody: () => void;
  additionalDependencies: MetricDependency[];
  setAdditionalDependencies: (dependencies: MetricDependency[]) => void;
  draftDependencyMetrics: CompatibleSpatialMetricDetailsFragment[];
}>({
  setDraftReportCardBody: () => { },
  clearDraftReportCardBody: () => { },
  additionalDependencies: [],
  setAdditionalDependencies: () => { },
  draftDependencyMetrics: [],
});

export const DraftReportContextProvider = ({ children }: { children: React.ReactNode }) => {

  const reportContext = useReportContext();
  const onError = useGlobalErrorHandler();

  const [additionalDependencies, setAdditionalDependencies] = useState<
    MetricDependency[]
  >([]);
  const draftDependenciesQuery = useDraftReportDependenciesQuery({
    variables: {
      input: {
        nodeDependencies: additionalDependencies.map((d) => ({
          ...d,
          hash: hashMetricDependency(d),
        })),
        sketchId: reportContext.selectedSketchId!,
      },
    },
    skip:
      !additionalDependencies ||
      additionalDependencies.length === 0 ||
      !reportContext.selectedSketchId,
    onError,
    fetchPolicy: "cache-and-network",
  });

  const debouncedDraftDependenciesData = useDebounce(
    draftDependenciesQuery.data,
    100
  );

  const [draftReportCardBody, setDraftReportCardBody] =
    useState<ProsemirrorBodyJSON | null>(null);

  const clearDraftReportCardBody = useCallback(() => {
    setDraftReportCardBody(null);
  }, [setDraftReportCardBody]);

  useEffect(() => {
    if (draftReportCardBody) {
      const deps = extractMetricDependenciesFromReportBody(draftReportCardBody);
      const metrics = reportContext.metrics;
      const hashesInMainReportRequest = new Set(
        metrics.map(
          (metric: CompatibleSpatialMetricDetailsFragment) =>
            metric.dependencyHash
        )
      );
      const hashesInDraft = new Set(deps.map((d) => hashMetricDependency(d)));

      const missingDependencies: (MetricDependency & { hash: string })[] = [];
      const missingHashes: string[] = [];
      for (const hash of hashesInDraft) {
        if (!hashesInMainReportRequest.has(hash)) {
          const dep = deps.find((d) => hashMetricDependency(d) === hash);
          if (!dep) {
            throw new Error(`Dependency not found in draft: ${hash}`);
          }
          missingHashes.push(hash);
          missingDependencies.push({
            ...dep,
            hash,
          });
        }
      }

      if (missingDependencies.length > 0) {
        setAdditionalDependencies((prev) => {
          // first, check if the dependencies are identical. If so, don't update
          const currentHashes = prev
            .map((d) => hashMetricDependency(d))
            .join(",");
          const newHashes = missingDependencies
            .map((d) => hashMetricDependency(d))
            .join(",");
          if (currentHashes === newHashes) {
            return prev;
          } else {
            return missingDependencies;
          }
        });
      } else {
        setAdditionalDependencies([]);
      }
    } else {
      setAdditionalDependencies([]);
    }
  }, [
    draftReportCardBody,
    setAdditionalDependencies,
    reportContext.metrics,
  ]);



  return (
    <DraftReportContext.Provider value={{ setDraftReportCardBody, clearDraftReportCardBody, additionalDependencies, setAdditionalDependencies, draftDependencyMetrics: [] }}>
      {children}
    </DraftReportContext.Provider>
  );
};