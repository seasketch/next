import { createContext, useContext, useMemo } from "react";
import {
  BaseReportContextDocument,
  BaseReportContextQuery,
  BaseReportContextQueryVariables,
  Geography,
} from "../../generated/graphql";
import { ReportConfiguration } from "../cards/cards";
import { useQuery } from "@apollo/client";

type BaseReportContextValue = {
  report: ReportConfiguration;
  geographies: Pick<
    Geography,
    "id" | "name" | "translatedProps" | "stableIds"
  >[];
};

export const BaseReportContext = createContext<{
  data?: BaseReportContextValue;
  loading: boolean;
}>({ loading: true });

export function BaseReportContextProvider({
  children,
  reportId,
}: {
  children: React.ReactNode;
  reportId: number;
}) {
  const query = useQuery<BaseReportContextQuery, BaseReportContextQueryVariables>(
    BaseReportContextDocument,
    { variables: { reportId } }
  );

  const value = useMemo<BaseReportContextValue | undefined>(() => {
    if (query.data?.report) {
      return {
        report: query.data.report as unknown as ReportConfiguration,
        geographies: query.data.report.geographies || [],
      };
    } else {
      return undefined;
    }
  }, [query.data]);

  return (
    <BaseReportContext.Provider value={{ data: value, loading: query.loading }}>
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
