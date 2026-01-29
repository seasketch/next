import { createContext, useContext, useMemo } from "react";
import {
  ReportContextSketchDetailsFragment,
  Sketch,
  SketchGeometryType,
  useSubjectReportContextQuery,
} from "../../generated/graphql";
import { MetricSubjectFragment } from "overlay-engine";
import { BaseReportContext } from "./BaseReportContext";

type SubjectReportContextValue = {
  /**
   * Whether the sketch is a collection
   */
  isCollection: boolean;
  sketch: ReportContextSketchDetailsFragment;
  childSketches: Pick<Sketch, "id" | "name" | "sketchClassId">[];
  siblingSketches: Pick<Sketch, "id" | "name" | "sketchClassId">[];
  relatedFragments: MetricSubjectFragment[];
};

export const SubjectReportContext = createContext<
  | SubjectReportContextValue
  | { data?: SubjectReportContextValue; loading: boolean }
>({ data: undefined, loading: true });

export function SubjectReportContextProvider({
  children,
  sketchId,
}: {
  children: React.ReactNode;
  sketchId: number;
}) {
  const { data, loading } = useSubjectReportContextQuery({
    variables: {
      sketchId: sketchId,
    },
  });
  const value = useMemo<SubjectReportContextValue | undefined>(() => {
    if (data) {
      if (!data.sketch) {
        throw new Error("Sketch not found");
      }
      if (!data.sketch.sketchClass) {
        throw new Error("Sketch class not found");
      }
      return {
        sketch: data.sketch,
        childSketches: data.sketch.children || [],
        siblingSketches: data.sketch.siblings || [],
        relatedFragments:
          (data.sketch.relatedFragments as MetricSubjectFragment[]) || [],
        isCollection:
          data.sketch.sketchClass?.geometryType ===
          SketchGeometryType.Collection,
      };
    }
    return undefined;
  }, [data]);

  const baseContext = useContext(BaseReportContext);
  return (
    <SubjectReportContext.Provider value={{ data: value, loading }}>
      {loading || baseContext.loading ? <div></div> : children}
    </SubjectReportContext.Provider>
  );
}

export function useSubjectReportContext(): SubjectReportContextValue {
  const context = useContext(SubjectReportContext);
  if (!context) {
    throw new Error("SubjectReportContext not found");
  }
  if ("loading" in context) {
    if (context.loading) {
      throw new Error(
        "SubjectReportContext data still loading. Report rendering should be deferred until the data is loaded."
      );
    } else {
      return context.data!;
    }
  } else {
    return context;
  }
}
