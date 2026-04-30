import { createContext, useContext, useMemo } from "react";
import {
  BaseDraftReportContextDocument,
  BaseDraftReportContextQuery,
  BaseReportContextDocument,
  BaseReportContextQuery,
  BaseReportContextQueryVariables,
  Geography,
  ReportContextSketchClassDetailsFragment,
} from "../../generated/graphql";
import { ReportConfiguration } from "../cards/cards";
import { useQuery } from "@apollo/client";

type BaseReportContextValue = {
  sketchClass: Pick<
    ReportContextSketchClassDetailsFragment,
    | "id"
    | "projectId"
    | "geometryType"
    | "form"
    | "clippingGeographies"
    | "project"
    | "validChildren"
  >;
  report: ReportConfiguration;
  geographies: Pick<Geography, "id" | "name" | "translatedProps" | "stableIds">[];
};

export const BaseReportContext = createContext<{
  data?: BaseReportContextValue;
  loading: boolean;
}>({ loading: true });

export function BaseReportContextProvider({
  children,
  sketchClassId,
  draft,
}: {
  children: React.ReactNode;
  sketchClassId: number;
  draft: boolean;
}) {
  const publishedQuery = useQuery<BaseReportContextQuery, BaseReportContextQueryVariables>(
    BaseReportContextDocument,
    { variables: { sketchClassId }, skip: draft }
  );
  const draftQuery = useQuery<BaseDraftReportContextQuery, BaseReportContextQueryVariables>(
    BaseDraftReportContextDocument,
    { variables: { sketchClassId }, skip: !draft }
  );

  const data = draft ? draftQuery.data : publishedQuery.data;
  const loading = draft ? draftQuery.loading : publishedQuery.loading;

  const value = useMemo<BaseReportContextValue | undefined>(() => {
    if (data) {
      if (!data.sketchClass) {
        throw new Error("Sketch class not found");
      }
      if (!data.sketchClass.project) {
        throw new Error("Project not found");
      }
      const report = draft
        ? (data as BaseDraftReportContextQuery).sketchClass?.draftReport
        : (data as BaseReportContextQuery).sketchClass?.report;
      return {
        sketchClass: data.sketchClass,
        report: report as unknown as ReportConfiguration,
        geographies: data.sketchClass?.project?.geographies || [],
      };
    } else {
      return undefined;
    }
  }, [data, draft]);

  return (
    <BaseReportContext.Provider value={{ data: value, loading }}>
      {children}
    </BaseReportContext.Provider>
  );
}

export function useBaseReportContext() {
  const context = useContext(BaseReportContext);
  if (!context) {
    throw new Error("BaseReportContext not found");
  }
  if (!context.data) {
    throw new Error(
      "BaseReportContext data still loading. Report rendering should be deferred until the data is loaded."
    );
  }
  return context.data!;
}
